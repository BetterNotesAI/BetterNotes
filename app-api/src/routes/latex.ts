import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { AIProvider, AttachmentInput } from '../lib/ai/types';
import { getTemplateOrThrow, TEMPLATE_DEFINITIONS } from '../lib/templates';
import { compileLatexToPdf, applyLatexFallbacks, compileMultiFileProject, type ProjectFile } from '../lib/latex';
import { trimHugeLog } from '../lib/errors';
import { processAttachments } from '../lib/attachments';
import { recordModelUsage } from '../lib/usage/tracker';
import { getUsageContext } from '../lib/usage/context';
import { markdownToLatexDoc } from '../lib/markdown-to-latex';
import { buildExtendedLectureNotesProjectFiles } from '../lib/templates/extended_lecture_notes_project';

// Descriptions used by the AI to pick the best template automatically.
const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  '2cols_portrait':       'Two-column portrait cheat sheet — best for formulas, definitions, key concepts, quick reference cards',
  'landscape_3col_maths': 'Compact 3-column landscape — ultra-dense math reference layout for large formula collections and calculus/algebra summaries',
  'clean_3cols_landscape': 'Clean 3-column landscape — readable cheatsheet layout with section strips, balanced spacing, concise formulas and tables',
  'study_form':           'Three-column portrait cheat sheet — compact formulas, short definitions, quick conditions and problem-solving reminders',
  'lecture_notes':        'Extended lecture notes with chapter-oriented structure and long-form sections — best for complete topic development',
  'classic_lecture_notes': 'Classic multi-page lecture notes — traditional structure with learning objectives, worked examples, theorem/definition blocks, and a summary',
};

function buildExtendedLectureProjectWithImages(
  latexSource: string,
  imageFiles: Array<{ filename: string; buffer: Buffer }>
): ProjectFile[] {
  const projectFiles = buildExtendedLectureNotesProjectFiles(latexSource);
  for (const image of imageFiles) {
    const binaryContent = image.buffer.toString('base64');
    projectFiles.push({
      path: image.filename,
      content: binaryContent,
      isBinary: true,
    });
    projectFiles.push({
      path: `Figures/${image.filename}`,
      content: binaryContent,
      isBinary: true,
    });
  }
  return projectFiles;
}

async function pickTemplate(prompt: string): Promise<string> {
  const fallback = '2cols_portrait';
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const selectorModel = process.env.OPENAI_TEMPLATE_SELECTOR_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5.4-nano';
    const ids = Object.keys(TEMPLATE_DESCRIPTIONS);
    const list = ids.map((id) => `- ${id}: ${TEMPLATE_DESCRIPTIONS[id]}`).join('\n');
    const resp = await openai.chat.completions.create({
      model: selectorModel,
      max_tokens: 20,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You are a template selector. Given a document request, reply with ONLY the template id that best fits.\nAvailable templates:\n${list}\n\nReply with exactly one id and nothing else.`,
        },
        { role: 'user', content: prompt },
      ],
    });

    await recordModelUsage({
      provider: 'openai',
      model: selectorModel,
      usage: resp.usage,
      feature: 'template_select',
      metadata: { template_candidates: ids.length },
    });

    const chosen = resp.choices[0]?.message?.content?.trim() ?? '';
    return ids.includes(chosen) ? chosen : fallback;
  } catch {
    return fallback;
  }
}

export interface LatexRouterOptions {
  aiProvider: AIProvider;
  latexTimeoutMs: number;
}

export function createLatexRouter(opts: LatexRouterOptions): Router {
  const router = Router();
  const { aiProvider, latexTimeoutMs } = opts;

  // ─── POST /latex/generate-and-compile ───────────────────────────────────────
  // Generates LaTeX via AI, compiles it, returns PDF as binary.
  // On compile failure: attempts one AI fix + recompile.
  router.post('/generate-and-compile', async (req: Request, res: Response) => {
    try {
      const { prompt, templateId, baseLatex, files } = req.body as {
        prompt?: string;
        templateId?: string;
        baseLatex?: string;
        files?: AttachmentInput[];
      };

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ ok: false, error: 'prompt is required' });
        return;
      }
      if (!templateId || typeof templateId !== 'string') {
        res.status(400).json({ ok: false, error: 'templateId is required' });
        return;
      }

      // Auto mode: let AI pick the best template from the active set
      const resolvedTemplateId = templateId === 'auto'
        ? await pickTemplate(prompt)
        : templateId;

      const template = getTemplateOrThrow(resolvedTemplateId);

      // Step 1: Download and process attachments (extract text from PDFs/DOCX, encode images)
      const processedFiles = await processAttachments(files ?? []);

      // Build the image file list for compileLatexToPdf (images flagged for PDF embed)
      const imageFiles = processedFiles
        .filter((a) => a.imageBuffer && a.embedInPdf)
        .map((a, i) => {
          const ext = (a.mimeType ?? 'image/jpeg').split('/')[1].replace('jpeg', 'jpg');
          return { filename: `attachment_${i}.${ext}`, buffer: a.imageBuffer! };
        });

      // Step 2: Generate LaTeX via AI
      const generated = await aiProvider.generateLatex({
        prompt,
        templateId: resolvedTemplateId,
        preamble: template.preamble,
        styleGuide: template.styleGuide,
        structureTemplate: template.structureTemplate,
        structureExample: template.structureExample,
        baseLatex: baseLatex ?? undefined,
        files: processedFiles,
      });

      // If AI responded with a chat message (not a document), return it immediately
      if (generated.message && !generated.latex) {
        res.json({ ok: true, message: generated.message });
        return;
      }

      if (!generated.latex) {
        res.status(500).json({ ok: false, error: 'AI did not produce LaTeX output' });
        return;
      }

      const latexSource = applyLatexFallbacks(generated.latex);
      const useExtendedLectureProject = resolvedTemplateId === 'lecture_notes';

      // Step 2: Compile
      let pdfBuffer: Buffer;
      let compileLog: string;
      let latexPatched: string;
      let finalLatex = latexSource;

      try {
        if (useExtendedLectureProject) {
          const projectFiles = buildExtendedLectureProjectWithImages(latexSource, imageFiles);
          const result = await compileMultiFileProject(projectFiles, 'main.tex', { timeoutMs: latexTimeoutMs });
          pdfBuffer = result.pdf;
          compileLog = result.log;
          latexPatched = latexSource;
          finalLatex = latexSource;
        } else {
          const result = await compileLatexToPdf(latexSource, { timeoutMs: latexTimeoutMs }, imageFiles);
          pdfBuffer = result.pdf;
          compileLog = result.log;
          latexPatched = result.latexPatched;
          finalLatex = latexPatched;
        }
      } catch (compileErr: any) {
        // Step 3: AI fix attempt
        const errLog = compileErr?.log ?? compileErr?.message ?? String(compileErr);
        let fixedLatex: string;
        try {
          fixedLatex = await aiProvider.fixLatex({ latex: latexSource, log: errLog });
          fixedLatex = applyLatexFallbacks(fixedLatex);
        } catch {
          res.status(422).json({
            ok: false,
            error: 'LaTeX compilation failed and AI fix also failed',
            compileLog: trimHugeLog(errLog),
            latex: latexSource,
          });
          return;
        }

        try {
          if (useExtendedLectureProject) {
            const projectFiles = buildExtendedLectureProjectWithImages(fixedLatex, imageFiles);
            const retryResult = await compileMultiFileProject(projectFiles, 'main.tex', { timeoutMs: latexTimeoutMs });
            pdfBuffer = retryResult.pdf;
            compileLog = retryResult.log;
            latexPatched = fixedLatex;
            finalLatex = fixedLatex;
          } else {
            const retryResult = await compileLatexToPdf(fixedLatex, { timeoutMs: latexTimeoutMs }, imageFiles);
            pdfBuffer = retryResult.pdf;
            compileLog = retryResult.log;
            latexPatched = retryResult.latexPatched;
            finalLatex = latexPatched;
          }
        } catch (retryErr: any) {
          const retryLog = retryErr?.log ?? retryErr?.message ?? String(retryErr);
          res.status(422).json({
            ok: false,
            error: 'LaTeX compilation failed after AI fix attempt',
            compileLog: trimHugeLog(retryLog),
            latex: fixedLatex,
          });
          return;
        }
      }

      // Return PDF binary with latex in header
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer!.length),
        'X-Latex-Length': String(Buffer.byteLength(finalLatex, 'utf8')),
        'X-Betternotes-Template': resolvedTemplateId,
      });
      // Encode latex in a separate response field by sending JSON when client wants it.
      // The standard path: return PDF binary. Caller gets latex via X-Betternotes-Latex header (base64).
      const latexB64 = Buffer.from(finalLatex, 'utf8').toString('base64');
      res.set('X-Betternotes-Latex', latexB64);
      if (generated.summary) {
        const summaryB64 = Buffer.from(generated.summary, 'utf8').toString('base64');
        res.set('X-Betternotes-Summary', summaryB64);
      }

      // Forward accumulated token usage to app-web so it can record credits
      // authoritatively (app-web always has Supabase credentials; app-api may not).
      const { accumulatedUsage } = getUsageContext();
      if (accumulatedUsage) {
        res.set(
          'X-Betternotes-Usage',
          Buffer.from(JSON.stringify(accumulatedUsage), 'utf8').toString('base64'),
        );
      }

      res.send(pdfBuffer!);
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? 500;
      res.status(status).json({
        ok: false,
        error: err?.message ?? 'Internal server error',
        code: err?.code,
        compileLog: err?.log ? trimHugeLog(err.log) : undefined,
      });
    }
  });

  // ─── POST /latex/compile-only ────────────────────────────────────────────────
  // Compiles provided LaTeX source, returns PDF binary or error JSON.
  router.post('/compile-only', async (req: Request, res: Response) => {
    try {
      const { latex, files } = req.body as { latex?: string; files?: AttachmentInput[] };

      if (!latex || typeof latex !== 'string') {
        res.status(400).json({ ok: false, error: 'latex is required' });
        return;
      }

      // Download image attachments so \includegraphics{} commands resolve correctly
      const processedFiles = files && files.length > 0 ? await processAttachments(files) : [];
      const imageFiles = processedFiles
        .filter((a) => a.imageBuffer && a.embedInPdf)
        .map((a, i) => {
          const ext = (a.mimeType ?? 'image/jpeg').split('/')[1].replace('jpeg', 'jpg');
          return { filename: `attachment_${i}.${ext}`, buffer: a.imageBuffer! };
        });

      const { pdf, log, latexPatched } = await compileLatexToPdf(latex, { timeoutMs: latexTimeoutMs }, imageFiles);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
        'X-Betternotes-Latex': Buffer.from(latexPatched, 'utf8').toString('base64'),
      });
      res.send(pdf);
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? 422;
      res.status(status).json({
        ok: false,
        error: err?.message ?? 'Compilation failed',
        code: err?.code,
        compileLog: err?.log ? trimHugeLog(err.log) : undefined,
      });
    }
  });

  // ─── POST /latex/fix-latex ───────────────────────────────────────────────────
  // Uses AI to fix broken LaTeX. Returns fixed source (does not compile).
  router.post('/fix-latex', async (req: Request, res: Response) => {
    try {
      const { latex, log } = req.body as { latex?: string; log?: string };

      if (!latex || typeof latex !== 'string') {
        res.status(400).json({ ok: false, error: 'latex is required' });
        return;
      }

      const fixedLatex = await aiProvider.fixLatex({ latex, log: log ?? '' });

      res.json({ ok: true, fixedLatex });
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? 500;
      res.status(status).json({
        ok: false,
        error: err?.message ?? 'Internal server error',
      });
    }
  });

  // ─── POST /latex/cheatsheet-pdf ──────────────────────────────────────────────
  // Converts Markdown → LaTeX (no AI) → compiles → returns PDF binary.
  // Body: { contentMd: string, templateId: string, title: string }
  router.post('/cheatsheet-pdf', async (req: Request, res: Response) => {
    try {
      const { contentMd, templateId, title } = req.body as {
        contentMd?: string;
        templateId?: string;
        title?: string;
      };

      if (!contentMd || typeof contentMd !== 'string') {
        res.status(400).json({ ok: false, error: 'contentMd is required' });
        return;
      }
      if (!templateId || typeof templateId !== 'string') {
        res.status(400).json({ ok: false, error: 'templateId is required' });
        return;
      }
      if (!title || typeof title !== 'string') {
        res.status(400).json({ ok: false, error: 'title is required' });
        return;
      }

      // Step 1: Direct Markdown → LaTeX conversion (no AI)
      const latexSource = markdownToLatexDoc(contentMd, templateId, title);

      // Step 2: Compile
      let pdfBuffer: Buffer;
      let finalLatex = latexSource;

      try {
        const result = await compileLatexToPdf(latexSource, { timeoutMs: latexTimeoutMs });
        pdfBuffer = result.pdf;
        finalLatex = result.latexPatched;
      } catch (compileErr: any) {
        // Step 3: One fallback attempt — apply safety patches and recompile
        const errLog = compileErr?.log ?? compileErr?.message ?? String(compileErr);
        const patchedLatex = applyLatexFallbacks(latexSource);

        try {
          const retryResult = await compileLatexToPdf(patchedLatex, { timeoutMs: latexTimeoutMs });
          pdfBuffer = retryResult.pdf;
          finalLatex = retryResult.latexPatched;
        } catch (retryErr: any) {
          const retryLog = retryErr?.log ?? retryErr?.message ?? String(retryErr);
          res.status(500).json({
            ok: false,
            error: `compile error: ${trimHugeLog(retryLog)}`,
          });
          return;
        }

        void errLog; // suppress unused-variable warning
      }

      // Return PDF binary
      const latexB64 = Buffer.from(finalLatex, 'utf8').toString('base64');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer!.length),
        'X-Latex-Length': String(Buffer.byteLength(finalLatex, 'utf8')),
        'X-Betternotes-Template': templateId,
        'X-Betternotes-Latex': latexB64,
      });
      res.send(pdfBuffer!);
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? 500;
      res.status(status).json({
        ok: false,
        error: err?.message ?? 'Internal server error',
        code: err?.code,
      });
    }
  });

  // ─── GET /latex/templates ────────────────────────────────────────────────────
  // Returns list of all template definitions (without preamble/structureTemplate for brevity).
  router.get('/templates', (_req: Request, res: Response) => {
    try {
      const { TEMPLATE_DEFINITIONS } = require('../lib/templates');
      const list = Object.values(TEMPLATE_DEFINITIONS as Record<string, any>).map((t: any) => ({
        id: t.id,
        displayName: t.displayName,
        description: t.description,
        isPro: t.isPro,
        isMultiFile: t.isMultiFile ?? false,
      }));
      res.json({ ok: true, templates: list });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message });
    }
  });

  return router;
}
