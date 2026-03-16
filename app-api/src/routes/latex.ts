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
  templateDirAbs: string;
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
    templateSource: string;
    wantOnlyBody: boolean;
    baseLatex?: string;
    files?: IncomingAttachment[];
  }): Promise<{ latex?: string; message?: string }> {
    const { prompt, templateId, templateSource, wantOnlyBody, baseLatex, files } = args;

    // Build content with files
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
          userContent.push(extracted);
        }
      }
    }

    // System Prompt - UPDATED FOR HYBRID MODE
    const system = [
      "You are BetterNotes AI, an expert academic assistant FOCUSED on generating LaTeX documents.",
      "Your goal is ALWAYS to help the user create or refine a LaTeX document.",
      "- If the user provides a topic, subject, or request (e.g., 'History of Spain', 'Formula sheet'), use the available TEMPLATE to GENERATE the document IMMEDIATELY.",
      "- Do NOT ask for more details ('what kind of document?'). The template IS the kind of document.",
      "- Only ask for clarification if the request is completely empty or nonsensical.",
      "- If the user says 'give me the latex' or 'use selected template', generate it based on previous context or a generic example if context is missing.",
      "- If output is a document, it MUST be valid LaTeX.",
      "- Use standard packages. Avoid exotic ones.",
      "- Never output triple backticks (```).",
      "CRITICAL: Do NOT use environments like 'example', 'theorem', 'proof' unless defined in the template. Use \\textbf{Example:} or \\section*{Example} instead.",
      "CRITICAL: If the template ALREADY defines 'definition', 'theorem', or 'example' (look for \\newtheorem), USE THEM. Do NOT re-define them (no \\newtheorem{definition}).",
      "CRITICAL: If the template uses `tcolorbox`, `tikz` or specific colors, PRESERVE THEM. Do not replace them with standard LaTeX.",
      "CRITICAL: Use \\verify{...} instead of \\check{...} for solution verification steps.",
    ].join(" ");

    const messages: { role: "system" | "assistant" | "user"; content: any }[] = [{ role: "system", content: system }];

    // Construct User Message
    let textPrompt = "";
    if (typeof baseLatex === "string" && baseLatex.trim()) {
      messages.push({ role: "assistant", content: baseLatex });
      textPrompt = [
        `Revise the previous LaTeX above according to: ${prompt}.`,
        "Return the FULL updated document.",
        "Preserve the current structure/style unless the user explicitly asks to change it.",
        "Apply the requested edit explicitly (add/remove/modify content in the LaTeX source).",
        "Do NOT return the same document unchanged unless the request is already fully satisfied.",
      ].join(" ");
    } else if (wantOnlyBody) {
      textPrompt = [
        `We will insert your output into a LaTeX template (templateId="${templateId}").`,
        "Return ONLY the body/content to be inserted at the placeholder.",
        `IMPORTANT: The user wants a document about: '${prompt}'. GENERATE IT NOW.`,
        "Generate REALISTIC, HIGH-QUALITY CONTENT for this topic.",
        "",
        "=== TEMPLATE (style ref) ===",
        templateSource,
        "",
        "=== USER REQUEST ===",
        prompt,
      ].join("\n");
    } else {
      textPrompt = [
        `Create a complete LaTeX document based on templateId="${templateId}".`,
        "Ensure the final output is a complete compilable .tex file.",
        `The user wants a document about: '${prompt}'. GENERATE IT NOW.`,
        "",
        "=== TEMPLATE ===",
        templateSource,
        "",
        "=== USER REQUEST ===",
        prompt,
        "",
        "If the user is NOT asking for a document and just chatting (e.g. 'hi'), reply with a polite text message.",
        "BUT if the user implies a document (e.g. 'history', 'physics', 'make it'), GENERATE THE LATEX.",
      ].join("\n");
    }

    if (fileTextContext) {
      textPrompt += `\n\n[Attached File Content]:\n${fileTextContext}`;
    }

    userContent[0].text = textPrompt;
    messages.push({ role: "user", content: userContent });

    const resp = await deps.openai.chat.completions.create({
      model: deps.openaiModel, // Must support vision (gpt-4o)
      temperature: 0.2,
      messages: messages as any,
    });

    const out = resp.choices?.[0]?.message?.content ?? "";
    const cleanOut = stripMarkdownFences(out);

    // Heuristic: Is it LaTeX or Message?
    // If it contains \documentclass or \begin{document} or looks like body content for the template (harder to detect)
    // But if we asked for "body only", it might not have documentclass. 
    // Let's assume if it contains latex commands like \section or \item or \begin, it is latex. (Simple heuristic)
    // OR if we explicitly asked for chat (which we didn't, we left it to AI).

    // Better heuristic: If it starts with typical chat words "Hello", "Sure", "I can help", it might be chat, UNLESS it's followed by latex.
    // Let's check if it compiles? No too expensive.

    // If user asked for body only, it's almost certainly LaTeX unless ignored.
    // If full doc, look for \documentclass.

    if (cleanOut.includes("\\documentclass") || cleanOut.includes("\\begin{document}") || (wantOnlyBody && (cleanOut.includes("\\section") || cleanOut.includes("\\item")))) {
      return { latex: applyLatexFallbacks(cleanOut) };
    }

    // If it's short and no latex syntax, assume message?
    if (!cleanOut.includes("\\") && cleanOut.length < 500) {
      return { message: cleanOut };
    }

    // Default to LaTeX if unsure, or treat as message if it really doesn't look like LaTeX
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

      if (!prompt && files.length === 0) return res.status(400).json({ ok: false, error: "Missing 'prompt' or 'files'." });

      const { source: templateSource } = loadTemplateOrThrow(deps.templateDirAbs, templateId);
      const placeholder = findPlaceholder(templateSource);
      const wantOnlyBody = !hasBaseLatex && Boolean(placeholder);

      const result = await generateLatexFromPrompt({
        prompt,
        templateId,
        templateSource,
        wantOnlyBody,
        baseLatex: hasBaseLatex ? baseLatexTrimmed.trim() : undefined,
        files
      });

      if (result.message) {
        return res.json({ ok: true, message: result.message });
      }

      const generated = result.latex || "";
      const latexRaw = wantOnlyBody && placeholder ? templateSource.replace(placeholder, generated) : generated;
      const latex = applyLatexFallbacks(latexRaw);

      return res.json({ ok: true, latex, usedTemplateId: templateId });
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
        "You MUST return a valid JSON object with ONE of these three structures:",
        "  1. { \"files\": { \"path\": \"content\", ... } }  — when generating or updating the document.",
        "  2. { \"message\": \"...\" }  — for casual chat that does not need document generation.",
        "  3. { \"questions\": [ { \"id\": \"q1\", \"question\": \"...\", \"options\": [\"A\", \"B\", \"C\"] }, ... ] }  — ONLY when critical information is missing and you cannot produce quality content without it (e.g. the user asked to summarise a file but its content was not provided). Keep it to at most 3 focused questions with 2-4 short options each.",
        "IMPORTANT: Never generate placeholder or skeleton LaTeX when information is missing — use questions instead.",
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
