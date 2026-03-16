// app-api/src/routes/latex.ts
import express from "express";
import OpenAI from "openai";
import path from "path";
import { loadTemplateOrThrow, findPlaceholder, loadMultiFileTemplate } from "../lib/templates";
import { applyLatexFallbacks, stripMarkdownFences, compileLatexToPdf, compileMultiFileProject } from "../lib/latex";
import { trimHugeLog } from "../lib/errors";

type LatexDeps = {
  openai: OpenAI;
  openaiModel: string;
  templateDirAbs: string; // kept for backward compat but no longer used for generation
  latexTimeoutMs: number;
};

type IncomingAttachment = {
  type: string;
  url?: string;
  data?: string;
  name: string;
  mimeType?: string;
};

const MAX_FILE_CONTEXT_CHARS = 12000;
const MAX_TOTAL_FILE_CONTEXT_CHARS = 45000;

function getFileExt(fileName: string) {
  return path.extname(fileName || "").toLowerCase();
}

function isImageAttachment(file: IncomingAttachment) {
  const mime = (file.mimeType ?? "").toLowerCase();
  const ext = getFileExt(file.name);
  return (
    file.type === "image" ||
    mime.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"].includes(ext)
  );
}

function looksLikeTextFile(file: IncomingAttachment, mimeType: string | null) {
  const mime = (mimeType ?? file.mimeType ?? "").toLowerCase();
  const ext = getFileExt(file.name);
  if (mime.startsWith("text/")) return true;
  return [
    ".txt",
    ".md",
    ".csv",
    ".tex",
    ".json",
    ".yaml",
    ".yml",
    ".xml",
    ".html",
    ".log",
    ".tsv",
  ].includes(ext);
}

function parseDataInput(rawData: string): { buffer: Buffer; mimeType: string | null } {
  const data = (rawData || "").trim();
  if (!data) throw new Error("Empty attachment payload.");

  if (data.startsWith("data:")) {
    const commaIdx = data.indexOf(",");
    if (commaIdx === -1) throw new Error("Malformed data URL.");

    const header = data.slice(5, commaIdx);
    const payload = data.slice(commaIdx + 1);
    const [mimePart] = header.split(";");
    const mimeType = mimePart?.trim() || null;
    const isBase64 = header.includes(";base64");
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return { buffer, mimeType };
  }

  return { buffer: Buffer.from(data, "base64"), mimeType: null };
}

async function loadAttachmentBytes(file: IncomingAttachment): Promise<{ buffer: Buffer; mimeType: string | null }> {
  if (file.data) return parseDataInput(file.data);

  if (file.url) {
    const r = await fetch(file.url);
    if (!r.ok) throw new Error(`Could not fetch file (${r.status}).`);

    const contentType = (r.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase() || null;
    const arr = await r.arrayBuffer();
    return { buffer: Buffer.from(arr), mimeType: contentType };
  }

  throw new Error("File has no url or data.");
}

async function extractReadableText(file: IncomingAttachment, buffer: Buffer, mimeType: string | null) {
  const ext = getFileExt(file.name);
  const mime = (mimeType ?? file.mimeType ?? "").toLowerCase();

  if (looksLikeTextFile(file, mimeType)) {
    return buffer.toString("utf8");
  }

  if (mime === "application/pdf" || ext === ".pdf") {
    const pdfParse = require("pdf-parse") as (input: Buffer) => Promise<{ text?: string }>;
    const result = await pdfParse(buffer);
    return (result?.text ?? "").trim();
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    const mammoth = require("mammoth") as {
      extractRawText: (args: { buffer: Buffer }) => Promise<{ value?: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    return (result?.value ?? "").trim();
  }

  throw new Error("Unsupported file type. Use image, PDF, DOCX, TXT, MD, or CSV.");
}

export function createLatexRouter(deps: LatexDeps) {
  const router = express.Router();

  async function extractFileContent(file: IncomingAttachment): Promise<string | { type: "image_url"; image_url: { url: string } }> {
    if (isImageAttachment(file)) {
      return {
        type: "image_url",
        image_url: {
          url: file.url || file.data || "",
        },
      };
    }

    try {
      const { buffer, mimeType } = await loadAttachmentBytes(file);
      const text = await extractReadableText(file, buffer, mimeType);
      const normalized = (text || "").replace(/\u0000/g, "").trim();

      if (!normalized) {
        return `\n=== FILE: ${file.name} ===\n[No readable text found in this file.]\n==================\n`;
      }

      const clipped =
        normalized.length > MAX_FILE_CONTEXT_CHARS
          ? `${normalized.slice(0, MAX_FILE_CONTEXT_CHARS)}\n[Attachment truncated to fit model context.]`
          : normalized;

      return `\n=== FILE: ${file.name} ===\n${clipped}\n==================\n`;
    } catch (err: any) {
      const message = err?.message ? String(err.message) : "Unknown extraction error";
      return `\n=== FILE: ${file.name} ===\n[Could not extract text: ${message}]\n==================\n`;
    }
  }

  async function generateLatexFromPrompt(args: {
    prompt: string;
    templateId: string;
    baseLatex?: string;
    files?: IncomingAttachment[];
  }): Promise<{ latex?: string; message?: string }> {
    const { prompt, templateId, baseLatex, files } = args;

    // Build file context
    const userContent: any[] = [{ type: "text", text: "" }];
    let fileTextContext = "";
    let remainingFileBudget = MAX_TOTAL_FILE_CONTEXT_CHARS;

    if (files && files.length > 0) {
      for (const f of files) {
        const extracted = await extractFileContent(f);
        if (typeof extracted === "string") {
          if (remainingFileBudget <= 0) continue;
          const clipped =
            extracted.length > remainingFileBudget
              ? `${extracted.slice(0, remainingFileBudget)}\n[More attachment context was omitted due to token limits.]\n`
              : extracted;
          fileTextContext += clipped;
          remainingFileBudget -= clipped.length;
        } else {
          userContent.push(extracted); // image
        }
      }
    }

    const system = [
      "You are BetterNotes AI, an expert academic assistant specialised in generating LaTeX documents.",
      "Your ONLY output is either a complete, compilable LaTeX document OR a short plain-text message (never both).",
      "RULES:",
      "- If the request implies a document topic (e.g. 'calculus', 'thermodynamics', 'generate notes'), output a COMPLETE .tex file — no explanations, no markdown, no triple backticks.",
      "- If the user is just chatting (e.g. 'hi', 'thanks'), reply with a short plain-text message only.",
      "- NEVER redefine environments (\\newtheorem, \\newcommand) that are already defined in the provided preamble.",
      "- NEVER output triple backticks (```).",
      "- Use ONLY standard packages. Do not add \\usepackage commands — the preamble already contains all necessary packages.",
      "- Use \\verify{...} (not \\check{...}) for solution verification steps in problem sheets.",
      "- In regular text (titles, headings, sentences), use \\& for ampersand, not bare &. Bare & is only valid inside tabular/array environments.",
      "- NEVER nest display math environments: do not put \\begin{equation*} or \\begin{align*} inside \\[ ... \\], and do not put \\begin{equation*} inside \\begin{align*}.",
      "- Always close every \\begin{env} with a matching \\end{env} before closing the enclosing environment.",
    ].join(" ");

    const messages: { role: "system" | "assistant" | "user"; content: any }[] = [
      { role: "system", content: system },
    ];

    let textPrompt = "";

    if (typeof baseLatex === "string" && baseLatex.trim()) {
      // ── REFINEMENT MODE: user wants to edit an existing document ──────────
      messages.push({ role: "assistant", content: baseLatex });
      textPrompt = [
        `Revise the LaTeX document above according to this request: "${prompt}"`,
        "Return the FULL updated document (same preamble and structure).",
        "Apply the change explicitly — do NOT return the document unchanged.",
        "Preserve the style, preamble, and layout unless the user explicitly asks to change them.",
      ].join(" ");
    } else {
      // ── GENERATION MODE: new document from template instructions ──────────
      const template = getTemplateOrThrow(templateId);

      textPrompt = [
        `User request: "${prompt}"`,
        "",
        "Decision: if this is casual conversation (e.g. 'hi', 'thanks', 'how are you'), reply with ONLY a short plain-text message.",
        "Otherwise (any academic or document topic), generate a COMPLETE LaTeX document using the template below.",
        "",
        `Template style: ${template.id}`,
        "",
        "=== REQUIRED PREAMBLE (copy this VERBATIM before \\begin{document}) ===",
        template.preamble,
        "",
        "=== STYLE GUIDE (follow these rules exactly) ===",
        template.styleGuide,
        "",
        "=== STRUCTURE EXAMPLE (use this as a structural reference, NOT as content to copy) ===",
        template.structureExample,
        "",
        "Now generate the complete .tex document. Fill it with REAL, DETAILED, HIGH-QUALITY academic content about the requested topic.",
        "Do NOT copy the example content — create original content relevant to the user's topic.",
      ].join("\n");
    }

    if (fileTextContext) {
      textPrompt += `\n\n=== ATTACHED FILE CONTENT (extract relevant information) ===\n${fileTextContext}`;
    }

    userContent[0].text = textPrompt;
    messages.push({ role: "user", content: userContent });

    const resp = await deps.openai.chat.completions.create({
      model: deps.openaiModel,
      temperature: 0.2,
      messages: messages as any,
    });

    const out = resp.choices?.[0]?.message?.content ?? "";
    const cleanOut = stripMarkdownFences(out);

    // Classify: LaTeX document or plain-text message?
    const looksLikeLatex =
      cleanOut.includes("\\documentclass") ||
      cleanOut.includes("\\begin{document}") ||
      cleanOut.includes("\\section") ||
      cleanOut.includes("\\begin{");

    if (looksLikeLatex) {
      let latex = cleanOut;
      // If AI omitted the preamble (starts with \begin{document} but no \documentclass),
      // auto-prepend the template preamble so the document always compiles.
      if (!baseLatex && !latex.includes("\\documentclass")) {
        const tmpl = getTemplateOrThrow(templateId);
        latex = `${tmpl.preamble}\n\n${latex}`;
      }
      return { latex: applyLatexFallbacks(latex) };
    }

    // Short response with no LaTeX commands → treat as chat message
    if (!cleanOut.includes("\\") && cleanOut.length < 600) {
      return { message: cleanOut };
    }

    // Default: treat as LaTeX if it has any backslash commands
    if (cleanOut.includes("\\")) return { latex: applyLatexFallbacks(cleanOut) };

    return { message: cleanOut };
  }

  async function fixLatexWithLog(args: { latex: string; log: string }): Promise<string> {
    const { latex, log } = args;

    const system = [
      "You are BetterNotes AI.",
      "You must output ONLY LaTeX source (no Markdown, no explanations).",
      "Fix the LaTeX so it compiles with pdflatex.",
      "Make the smallest changes necessary.",
      "Never output triple backticks.",
      "CRITICAL: If the error is 'Environment ... undefined', REPLACE that environment with a standard one (like 'itemize' or just \\textbf{Title}) or remove it. Do not try to define new environments in the body.",
      "CRITICAL: If the error is 'Command ... already defined', REMOVE the re-definition (e.g. \\newcommand, \\newtheorem) that caused it.",
    ].join(" ");

    const user = [
      "The LaTeX compilation failed. Fix the LaTeX based on the compiler log.",
      "Return the FULL corrected LaTeX document.",
      "",
      "=== LATEX ===",
      latex,
      "",
      "=== COMPILER LOG ===",
      log,
    ].join("\n");

    const resp = await deps.openai.chat.completions.create({
      model: deps.openaiModel,
      temperature: 0.1,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const out = resp.choices?.[0]?.message?.content ?? "";
    return stripMarkdownFences(out);
  }

  // Simple heuristic: detect casual chat before hitting the AI
  function isCasualChat(prompt: string): string | null {
    const p = prompt.trim().toLowerCase().replace(/[!?.]+$/, "");
    const CHAT_PATTERNS = [
      /^(hi|hello|hey|hola|howdy|good\s+\w+|greetings)$/i,
      /^(thanks|thank\s+you|thx|ty|cheers|gracias)$/i,
      /^(bye|goodbye|ciao|see\s+ya)$/i,
      /^(how\s+are\s+you|how's\s+it\s+going|what's\s+up|wassup|sup)$/i,
      /^(ok|okay|sure|great|awesome|cool|nice|perfect|got\s+it|understood)$/i,
      /^(yes|no|yeah|nope|yep)$/i,
    ];
    if (CHAT_PATTERNS.some(rx => rx.test(p))) {
      return "Hello! I'm BetterNotes AI. Share a topic and I'll generate a LaTeX document for you! 📝";
    }
    return null;
  }

  // POST /latex/generate-latex
  router.post("/generate-latex", async (req, res) => {
    try {
      const prompt = String(req.body?.prompt ?? "").trim();
      const templateId = String(req.body?.templateId ?? "2cols_portrait").trim();
      const baseLatexTrimmed = String(req.body?.baseLatex ?? "");
      const hasBaseLatex = baseLatexTrimmed.trim().length > 0;
      const files: IncomingAttachment[] = Array.isArray(req.body?.files)
        ? req.body.files
          .filter((f: any) => f && typeof f === "object")
          .map((f: any) => ({
            type: String(f.type ?? "document"),
            url: typeof f.url === "string" ? f.url : undefined,
            data: typeof f.data === "string" ? f.data : undefined,
            name: typeof f.name === "string" && f.name.trim() ? f.name : "attachment",
            mimeType: typeof f.mimeType === "string" ? f.mimeType : undefined,
          }))
        : [];

      // Short-circuit: casual chat without a document topic
      if (prompt && files.length === 0 && !hasBaseLatex) {
        const chatReply = isCasualChat(prompt);
        if (chatReply) return res.json({ ok: true, message: chatReply });
      }

      if (!prompt && files.length === 0) {
        return res.status(400).json({ ok: false, error: "Missing 'prompt' or 'files'." });
      }

      const result = await generateLatexFromPrompt({
        prompt,
        templateId,
        baseLatex: hasBaseLatex ? baseLatexTrimmed.trim() : undefined,
        files,
      });

      if (result.message) {
        return res.json({ ok: true, message: result.message });
      }

      return res.json({ ok: true, latex: result.latex ?? "", usedTemplateId: templateId });
    } catch (e: any) {
      const status = Number(e?.statusCode ?? 500);
      return res.status(status).json({ ok: false, error: e?.message ?? "Server error" });
    }
  });

  // POST /latex/compile
  router.post("/compile", async (req, res) => {
    try {
      const latexRaw = String(req.body?.latex ?? "");
      if (!latexRaw.trim()) return res.status(400).json({ ok: false, error: "Missing 'latex'." });

      const { pdf } = await compileLatexToPdf(latexRaw, { timeoutMs: deps.latexTimeoutMs });

      res.setHeader("Content-Type", "application/pdf");
      return res.status(200).send(pdf);
    } catch (e: any) {
      const status = Number(e?.statusCode ?? 400);
      const log = typeof e?.log === "string" ? trimHugeLog(e.log) : undefined;
      const code = typeof e?.code === "string" ? e.code : undefined;
      const message = typeof e?.message === "string" ? e.message : "Compilation failed.";

      return res.status(status).json({ ok: false, error: message, code, log });
    }
  });

  // POST /latex/fix-latex
  router.post("/fix-latex", async (req, res) => {
    try {
      const latex = String(req.body?.latex ?? "");
      const log = String(req.body?.log ?? "");
      if (!latex.trim()) return res.status(400).json({ ok: false, error: "Missing 'latex'." });
      if (!log.trim()) return res.status(400).json({ ok: false, error: "Missing 'log'." });

      const fixedLatex = await fixLatexWithLog({ latex, log });
      if (!fixedLatex.trim()) return res.status(500).json({ ok: false, error: "Fix returned empty LaTeX." });

      return res.json({ ok: true, fixedLatex: applyLatexFallbacks(fixedLatex) });
    } catch (e: any) {
      const status = Number(e?.statusCode ?? 500);
      return res.status(status).json({ ok: false, error: e?.message ?? "Server error" });
    }
  });

  // POST /latex/compile-project
  // Multi-file LaTeX project compilation
  router.post("/compile-project", async (req, res) => {
    try {
      const files = req.body?.files;
      const mainFile = String(req.body?.mainFile ?? "main.tex").trim();

      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ ok: false, error: "Missing 'files' array." });
      }

      // Validate file objects
      for (const f of files) {
        if (!f.path || typeof f.path !== "string") {
          return res.status(400).json({ ok: false, error: "Each file must have a 'path' string." });
        }
        if (typeof f.content !== "string") {
          return res.status(400).json({ ok: false, error: `File "${f.path}" is missing 'content'.` });
        }
      }

      const { pdf } = await compileMultiFileProject(files, mainFile, {
        timeoutMs: deps.latexTimeoutMs,
      });

      res.setHeader("Content-Type", "application/pdf");
      return res.status(200).send(pdf);
    } catch (e: any) {
      const status = Number(e?.statusCode ?? 400);
      const log = typeof e?.log === "string" ? trimHugeLog(e.log) : undefined;
      const code = typeof e?.code === "string" ? e.code : undefined;
      const message = typeof e?.message === "string" ? e.message : "Project compilation failed.";

      return res.status(status).json({ ok: false, error: message, code, log });
    }
  });

  // POST /latex/generate-project
  // Multi-file LaTeX project generation (long template)
  router.post("/generate-project", async (req, res) => {
    try {
      const prompt = String(req.body?.prompt ?? "").trim();
      const existingFiles: Record<string, string> = req.body?.existingFiles ?? {};
      const files: IncomingAttachment[] = Array.isArray(req.body?.files)
        ? req.body.files
            .filter((f: any) => f && typeof f === "object")
            .map((f: any) => ({
              type: String(f.type ?? "document"),
              url: typeof f.url === "string" ? f.url : undefined,
              data: typeof f.data === "string" ? f.data : undefined,
              name: typeof f.name === "string" && f.name.trim() ? f.name : "attachment",
              mimeType: typeof f.mimeType === "string" ? f.mimeType : undefined,
            }))
        : [];

      if (!prompt && files.length === 0) {
        return res.status(400).json({ ok: false, error: "Missing 'prompt' or 'files'." });
      }

      // Load multi-file template as context for the AI
      const templateDir = path.join(deps.templateDirAbs, "longTemplate");
      const templateFiles = loadMultiFileTemplate(templateDir);

      // Extract text from attached files (PDFs, docs, etc.)
      const userContent: any[] = [{ type: "text", text: "" }];
      let fileTextContext = "";
      let remainingFileBudget = MAX_TOTAL_FILE_CONTEXT_CHARS;

      if (files.length > 0) {
        for (const f of files) {
          const extracted = await extractFileContent(f);
          if (typeof extracted === "string") {
            if (remainingFileBudget <= 0) continue;
            const clipped =
              extracted.length > remainingFileBudget
                ? `${extracted.slice(0, remainingFileBudget)}\n[More attachment context was omitted due to token limits.]\n`
                : extracted;
            fileTextContext += clipped;
            remainingFileBudget -= clipped.length;
          } else {
            userContent.push(extracted);
          }
        }
      }

      // Determine if this is an edit (existing files have content) or first generation
      const hasExistingContent = Object.values(existingFiles).some((v) => v.trim().length > 100);

      // Build template context string for the AI
      const templateCtx = Object.entries(templateFiles)
        .map(([p, c]) => `=== ${p} ===\n${c.slice(0, 2000)}`)
        .join("\n\n");

      // System prompt for multi-file project generation
      const system = [
        "You are BetterNotes AI, an expert academic assistant that generates multi-file LaTeX projects.",
        "You MUST return a valid JSON object with the structure: { \"files\": { \"path\": \"content\", ... } }",
        "Do NOT return anything outside the JSON object. No markdown fences, no explanations before or after.",
        "",
        "PROJECT STRUCTURE:",
        "- main.tex: The root document. Uses \\documentclass[12pt,a4paper]{report}, \\input{packages}, \\begin{document}, \\input{Chapters/first_pages}, then \\input{Chapters/...} for each chapter, \\input{Chapters/Conclusions}, \\bibliographystyle{plain}, \\bibliography{references}, \\end{document}.",
        "- packages.tex: All \\usepackage declarations. Include amsmath, amsthm, amssymb, graphicx, hyperref, booktabs, enumitem, xcolor, fancyhdr, titlesec, geometry, and any others needed.",
        "- Chapters/first_pages.tex: Title page with \\begin{titlepage}...\\end{titlepage}, table of contents, page counter reset. IMPORTANT: infer the document title from the user's topic (e.g. 'Thermodynamics', 'World War II', 'Quantum Mechanics'). Infer the department/faculty from the subject field (e.g. 'Department of Physics', 'Department of History'). Keep author as 'Your Name' and professor as 'Your Professor' as placeholders. Always end the title page with: {\\large \\textbf{Document generated with BetterNotes AI} \\par}.",
        "- Chapters/N-Name.tex: Each chapter file. Use \\chapter{Title} at the top, then \\section{}, \\subsection{} etc.",
        "- Chapters/Conclusions.tex: Final chapter with conclusions/summary.",
        "- references.bib: BibTeX entries if citations are used (use \\cite{key} in chapters).",
        "",
        "RULES:",
        "- Decide the number of chapters dynamically based on the content. A short topic might need 3-4 chapters, a full course 6-10+.",
        "- Name chapter files as: Chapters/1-Introduction.tex, Chapters/2-TopicName.tex, etc.",
        "- main.tex MUST have \\input{} for every chapter file you create, in order.",
        "- Generate REALISTIC, DETAILED, HIGH-QUALITY academic content. Not placeholders or TODOs.",
        "- Use \\includegraphics{Figures/<name>} if the user has images available.",
        "- Use theorem, definition, lemma, example environments (they are defined in packages.tex).",
        "- Do NOT re-define \\newtheorem environments in chapter files.",
        "- Always return ALL project files in the JSON (main.tex, packages.tex, all chapters, references.bib, first_pages, Conclusions).",
        "- If the user mentions images, reference them with \\includegraphics{Figures/<name>}.",
      ].join("\n");

      let textPrompt: string;

      if (hasExistingContent) {
        // Edit mode: user wants to modify existing project
        const existingCtx = Object.entries(existingFiles)
          .filter(([, c]) => c.trim())
          .map(([p, c]) => `=== ${p} ===\n${c}`)
          .join("\n\n");

        textPrompt = [
          "The user has an existing multi-file LaTeX project and wants to modify it.",
          "Return ONLY the files that need to change in the JSON response.",
          "Do NOT return unchanged files.",
          "",
          "=== CURRENT PROJECT FILES ===",
          existingCtx,
          "",
          "=== USER REQUEST ===",
          prompt,
        ].join("\n");
      } else {
        // First generation
        textPrompt = [
          "Generate a complete multi-file LaTeX project about the following topic.",
          "Use the template structure shown below as a REFERENCE for style and formatting.",
          "",
          "=== TEMPLATE REFERENCE ===",
          templateCtx,
          "",
          "=== USER REQUEST ===",
          prompt,
          "",
          "Remember: Return ONLY a JSON object { \"files\": { ... } } with all project files.",
          "If the user is NOT asking for a document and just chatting (e.g. 'hi'), return { \"message\": \"your reply\" } instead.",
        ].join("\n");
      }

      if (fileTextContext) {
        textPrompt += `\n\n[Attached File Content — use this as SOURCE MATERIAL for the chapters]:\n${fileTextContext}`;
      }

      userContent[0].text = textPrompt;

      const resp = await deps.openai.chat.completions.create({
        model: deps.openaiModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ] as any,
      });

      const out = resp.choices?.[0]?.message?.content ?? "";

      // Parse JSON response
      let parsed: any;
      try {
        // Strip markdown fences if present
        const cleaned = stripMarkdownFences(out).trim();
        parsed = JSON.parse(cleaned);
      } catch {
        // Try to extract JSON from the response
        const jsonMatch = out.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            return res.status(422).json({ ok: false, error: "AI returned invalid JSON.", raw: out.slice(0, 500) });
          }
        } else {
          return res.status(422).json({ ok: false, error: "AI did not return JSON.", raw: out.slice(0, 500) });
        }
      }

      // Handle chat message response
      if (parsed.message && !parsed.files) {
        return res.json({ ok: true, message: parsed.message });
      }

      if (!parsed.files || typeof parsed.files !== "object") {
        return res.status(422).json({ ok: false, error: "AI response missing 'files' object.", raw: out.slice(0, 500) });
      }

      // Apply LaTeX fallbacks to each .tex file
      const resultFiles: Record<string, string> = {};
      for (const [filePath, content] of Object.entries(parsed.files)) {
        if (typeof content !== "string") continue;
        if (filePath.endsWith(".tex")) {
          resultFiles[filePath] = applyLatexFallbacks(content);
        } else {
          resultFiles[filePath] = content;
        }
      }

      return res.json({ ok: true, files: resultFiles });
    } catch (e: any) {
      const status = Number(e?.statusCode ?? 500);
      return res.status(status).json({ ok: false, error: e?.message ?? "Server error" });
    }
  });

  return router;
}
