/**
 * generateExamPDF.ts — Complete rewrite
 *
 * Strategy:
 *  1. Pre-render all math with KaTeX (returns HTML strings, no CDN dependency).
 *  2. Extract KaTeX CSS from the app's already-loaded stylesheets (correct version, no CDN mismatch).
 *  3. Build a full HTML document where each block (header / question / footer)
 *     has its own horizontal padding and fills the full A4_W_PX body width —
 *     so every captured canvas has the same width and scales perfectly to PDF.
 *  4. Mount in a hidden off-screen iframe; resize iframe to content height so
 *     there is never any internal scroll that would confuse html2canvas.
 *  5. Capture the HEADER, each QUESTION, and the FOOTER individually with
 *     html2canvas — a question is never split across pages.
 *  6. Compose A4 pages: place blocks sequentially; if a block doesn't fit on
 *     the current page, open a new page first.
 *  7. Build jsPDF, stamp page numbers, and return.
 *
 * Public API (unchanged):
 *   getExamPDFBlobUrl(report)  → Promise<string>
 *   downloadExamPDF(report)    → Promise<void>
 */

import { jsPDF } from 'jspdf';
import type { default as Html2CanvasType } from 'html2canvas';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ExamReportQuestion {
  question_number: number;
  type: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  user_answer: string | null;
  is_correct: boolean | null;
  partial_score?: number | null;
  explanation: string | null;
}

export interface ExamReport {
  exam: {
    title: string;
    subject: string;
    level: string;
    score: number | null;
    completed_at: string | null;
  };
  questions: ExamReportQuestion[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  secondary_basic: 'Secondary — Basic',
  secondary_intermediate: 'Secondary — Intermediate',
  secondary_advanced: 'Secondary — Advanced',
  highschool_basic: 'High School — Basic',
  highschool_intermediate: 'High School — Intermediate',
  highschool_advanced: 'High School — Advanced',
  university_basic: 'University — Basic',
  university_intermediate: 'University — Intermediate',
  university_advanced: 'University — Advanced',
};

/** A4 at 96 dpi */
const A4_W_PX  = 794;
const A4_W_MM  = 210;
const A4_H_MM  = 297;

/** Margin reserved at top and bottom of every page (mm). */
const PAGE_MARGIN_MM = 10;

/** html2canvas render scale — 2× for crisp text and thin math strokes. */
const RENDER_SCALE = 2;

/** Colour tokens per answer state. */
const STATE_COLORS = {
  correct:    { circle: '#16a34a', badge: '#dcfce7', badgeText: '#15803d', text: '#16a34a' },
  partial:    { circle: '#d97706', badge: '#fef3c7', badgeText: '#b45309', text: '#d97706' },
  wrong:      { circle: '#dc2626', badge: '#fee2e2', badgeText: '#b91c1c', text: '#dc2626' },
  unanswered: { circle: '#9ca3af', badge: '#f3f4f6', badgeText: '#6b7280', text: '#6b7280' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render inline ($…$) and display ($$…$$) math with KaTeX. */
async function renderMath(text: string): Promise<string> {
  let katex: typeof import('katex');
  try {
    katex = (await import('katex')).default as unknown as typeof import('katex');
  } catch {
    return esc(text);
  }
  // Display math first ($$…$$) to avoid double-processing
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, math) => {
    try { return katex.renderToString(math, { displayMode: true,  throwOnError: false }); }
    catch { return esc(math); }
  });
  // Inline math ($…$)
  text = text.replace(/\$([^$\n]+?)\$/g, (_m, math) => {
    try { return katex.renderToString(math, { displayMode: false, throwOnError: false }); }
    catch { return esc(math); }
  });
  return text;
}

/**
 * Extract KaTeX CSS rules from the app's already-loaded stylesheets.
 * The app loads katex/dist/katex.min.css via MathText.tsx, so the rules
 * (including @font-face with absolute font URLs) are always available.
 */
function extractKatexCSS(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules ?? [])) {
        const text = rule.cssText;
        // @font-face rules for KaTeX fonts
        if (rule instanceof CSSFontFaceRule) {
          if (text.includes('KaTeX') || text.includes('katex')) {
            parts.push(text);
          }
        // All CSS rules whose selector contains .katex
        } else if (rule instanceof CSSStyleRule && rule.selectorText?.includes('.katex')) {
          parts.push(text);
        }
      }
    } catch { /* cross-origin stylesheet — skip */ }
  }
  return parts.join('\n');
}

function questionState(q: ExamReportQuestion): 'correct' | 'partial' | 'wrong' | 'unanswered' {
  if (!q.user_answer || q.user_answer.trim() === '') return 'unanswered';
  if (q.is_correct === true) return 'correct';
  if (q.partial_score != null && q.partial_score > 0 && q.partial_score < 1) return 'partial';
  return 'wrong';
}

// ─── HTML builders ────────────────────────────────────────────────────────────
// Important: the <body> has NO padding. Each block has its own horizontal
// padding so that block.offsetWidth === A4_W_PX (full body width).
// This guarantees canvas.width === A4_W_PX * RENDER_SCALE for every block,
// and the aspect-ratio formula scales them correctly to PDF millimetres.

function buildHeaderHTML(report: ExamReport): string {
  const level = LEVEL_LABELS[report.exam.level] ?? report.exam.level;
  const date  = report.exam.completed_at ? formatDate(report.exam.completed_at) : '—';
  const score = report.exam.score !== null ? `${report.exam.score}%` : '—';
  return `
    <div class="pdf-header" style="padding:24px 48px 20px;">
      <div style="background:#4f46e5;border-radius:10px;padding:18px 24px;">
        <div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:8px;">
          ${esc(report.exam.subject || report.exam.title)}
        </div>
        <div style="display:flex;gap:24px;font-size:12px;color:rgba(255,255,255,.8);flex-wrap:wrap;">
          <span>Level: ${esc(level)}</span>
          <span>Date: ${esc(date)}</span>
          <span>Score: ${esc(score)}</span>
          <span>Questions: ${report.questions.length}</span>
        </div>
      </div>
    </div>`;
}

async function buildQuestionHTML(q: ExamReportQuestion): Promise<string> {
  const state    = questionState(q);
  const colors   = STATE_COLORS[state];
  const noAnswer = state === 'unanswered';

  const questionHtml      = await renderMath(q.question);
  const userAnswerHtml    = q.user_answer ? await renderMath(q.user_answer) : null;
  const correctAnswerHtml = await renderMath(q.correct_answer);
  const explanationHtml   = q.explanation ? await renderMath(q.explanation) : null;

  let stateLabel = '';
  if      (state === 'correct')  stateLabel = 'Correct';
  else if (state === 'partial')  stateLabel = `Partial — ${Math.round((q.partial_score ?? 0) * 100)}%`;
  else if (state === 'wrong')    stateLabel = 'Incorrect';
  else                           stateLabel = 'No answer';

  // Options (multiple-choice only)
  let optionsHtml = '';
  if (q.type === 'multiple_choice' && q.options) {
    const labels = ['A', 'B', 'C', 'D'];
    const items = await Promise.all(q.options.map(async (opt, i) => {
      const isUser    = opt === q.user_answer;
      const isCorrect = opt === q.correct_answer;
      let color  = '#6b7280';
      let weight = '400';
      if      (isUser    && state === 'correct') { color = '#16a34a'; weight = '600'; }
      else if (isUser    && state === 'wrong')   { color = '#dc2626'; weight = '600'; }
      else if (isUser    && state === 'partial') { color = '#d97706'; weight = '600'; }
      else if (isCorrect && state === 'wrong')   { color = '#16a34a'; weight = '500'; }
      const html = await renderMath(opt);
      return `<div style="display:flex;align-items:center;gap:6px;color:${color};font-weight:${weight};margin:3px 0 3px 20px;font-size:13px;">
        <span style="font-weight:700;flex-shrink:0;">${labels[i] ?? i + 1}.</span>
        <span>${html}</span>
      </div>`;
    }));
    optionsHtml = `<div style="margin:8px 0 4px;">${items.join('')}</div>`;
  }

  // Correct answer (shown for wrong/unanswered non-MC questions)
  let correctSection = '';
  if ((state === 'wrong' || noAnswer) && q.type !== 'multiple_choice') {
    correctSection = `
      <div style="margin-top:8px;">
        <div style="font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;
                    letter-spacing:.04em;margin-bottom:3px;">Correct answer</div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0 2px;color:#16a34a;font-size:13px;line-height:1.55;">${correctAnswerHtml}</div>
      </div>`;
  }

  // Explanation
  let explanationSection = '';
  if (explanationHtml) {
    explanationSection = `
      <div style="margin-top:10px;background:#f9fafb;border-radius:6px;
                  padding:10px 12px;border:1px solid #e5e7eb;">
        <div style="font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:5px;">Explanation</div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0 2px;color:#374151;font-size:12.5px;line-height:1.6;">${explanationHtml}</div>
      </div>`;
  }

  return `
    <div class="pdf-question" style="padding:16px 48px;border-bottom:1px solid #e5e7eb;">
      <!-- Header row: circle · question · badge -->
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:8px;">
        <!-- Number circle -->
        <div style="min-width:26px;width:26px;height:26px;border-radius:50%;
                    background:${colors.circle};display:flex;align-items:center;
                    justify-content:center;flex-shrink:0;margin-top:2px;">
          <span style="font-size:11px;font-weight:700;color:#fff;line-height:1;">
            ${q.question_number}
          </span>
        </div>
        <!-- Question text -->
        <div style="flex:1;display:flex;flex-wrap:wrap;align-items:center;gap:0 2px;
                    font-size:14px;font-weight:600;color:#111827;line-height:1.55;">${questionHtml}</div>
        <!-- State badge -->
        <div style="flex-shrink:0;padding:4px 10px;border-radius:999px;
                    background:${colors.badge};font-size:10px;font-weight:600;
                    color:${colors.badgeText};white-space:nowrap;margin-top:3px;">
          ${stateLabel}
        </div>
      </div>

      ${optionsHtml}

      <!-- User answer -->
      <div style="margin-top:8px;">
        <div style="font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;
                    letter-spacing:.04em;margin-bottom:3px;">Your answer</div>
        ${noAnswer
          ? `<div style="color:#9ca3af;font-style:italic;font-size:13px;">(no answer given)</div>`
          : `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0 2px;color:${colors.text};font-size:13px;line-height:1.55;">${userAnswerHtml}</div>`
        }
      </div>

      ${correctSection}
      ${explanationSection}
    </div>`;
}

// ─── Core pipeline ────────────────────────────────────────────────────────────

async function buildExamPDFAsync(report: ExamReport): Promise<jsPDF> {
  // 1. Pre-render all HTML (async KaTeX calls happen here)
  const headerHtml = buildHeaderHTML(report);
  const questionHtmls: string[] = [];
  for (const q of report.questions) {
    questionHtmls.push(await buildQuestionHTML(q));
  }
  const footerHtml = `
    <div class="pdf-footer" style="padding:12px 48px 20px;">
      <div style="border-top:1px solid #e5e7eb;padding-top:10px;
                  font-size:10px;color:#9ca3af;text-align:center;">
        BetterNotes — ${esc(report.exam.subject || report.exam.title)}
      </div>
    </div>`;

  // 2. Extract KaTeX CSS from the app's loaded stylesheets
  const katexCSS = extractKatexCSS();

  // 3. Build full HTML document — body has NO padding so every block fills A4_W_PX
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #111827;
      width: ${A4_W_PX}px;
      line-height: 1.5;
    }
    /*
     * html2canvas does not honour KaTeX's computed "vertical-align: -Xem" on
     * inline spans, so fractions / roots appear shifted upward.
     * Fix: switch .katex to inline-block (html2canvas handles that correctly)
     * and align its midpoint with the surrounding text midline.
     */
    .katex         { font-size: 1em; display: inline-block !important; vertical-align: middle !important; }
    .katex-display { display: block !important; margin: 6px 0; text-align: center; }
    ${katexCSS}
  </style>
</head>
<body>
  ${headerHtml}
  ${questionHtmls.map((h, i) => `<div id="q${i}">${h}</div>`).join('\n')}
  ${footerHtml}
</body>
</html>`;

  // 4. Mount hidden iframe off-screen (large enough to avoid any internal scroll)
  const iframe = document.createElement('iframe');
  iframe.style.cssText = [
    'position:fixed',
    'top:0',
    `left:-${A4_W_PX + 600}px`,
    `width:${A4_W_PX}px`,
    'height:8000px',          // generous initial height; resized after load
    'border:none',
    'pointer-events:none',
    'visibility:hidden',
    'z-index:-9999',
  ].join(';');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument!;
  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  // 5. Wait for load, then resize iframe to actual content height (no scroll)
  await new Promise<void>((resolve) => {
    if (iframeDoc.readyState === 'complete') {
      resolve();
    } else {
      iframe.onload = () => resolve();
      setTimeout(resolve, 2500);
    }
  });
  const contentH = Math.max(iframeDoc.body.scrollHeight + 100, 8000);
  iframe.style.height = `${contentH}px`;

  // Wait for fonts (KaTeX font files) to be fully loaded
  try { await iframeDoc.fonts.ready; } catch { /* ignore */ }
  await new Promise((r) => setTimeout(r, 300));

  let pdf!: jsPDF;
  try {
    const html2canvas: typeof Html2CanvasType = (await import('html2canvas')).default;

    const h2cOpts = {
      scale:       RENDER_SCALE,
      useCORS:     true,
      allowTaint:  false,
      logging:     false,
      backgroundColor: '#ffffff',
      windowWidth: A4_W_PX,
    };

    // 6. Capture each block individually
    const headerEl   = iframeDoc.querySelector('.pdf-header') as HTMLElement;
    const headerCanvas = await html2canvas(headerEl, h2cOpts);

    const questionCanvases: HTMLCanvasElement[] = [];
    for (let i = 0; i < report.questions.length; i++) {
      const qEl = iframeDoc.querySelector(`#q${i} .pdf-question`) as HTMLElement;
      if (qEl) {
        questionCanvases.push(await html2canvas(qEl, h2cOpts));
      }
    }

    const footerEl     = iframeDoc.querySelector('.pdf-footer') as HTMLElement;
    const footerCanvas = footerEl ? await html2canvas(footerEl, h2cOpts) : null;

    // 7. Compose A4 pages
    // Canvas width = element.offsetWidth * RENDER_SCALE = A4_W_PX * RENDER_SCALE (always).
    // Height in mm: (canvas.height / canvas.width) * A4_W_MM — exact 96 dpi conversion.
    pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    let pageY = PAGE_MARGIN_MM;  // current Y cursor on the current page (mm)

    function placeCanvas(canvas: HTMLCanvasElement, gapAfterMm = 0): void {
      const hMm  = (canvas.height / canvas.width) * A4_W_MM;
      const maxY = A4_H_MM - PAGE_MARGIN_MM;

      // If the block doesn't fit and we're not at the very top of a fresh page, open a new page
      if (pageY + hMm > maxY && pageY > PAGE_MARGIN_MM) {
        pdf.addPage();
        pageY = PAGE_MARGIN_MM;
      }

      // PNG for lossless quality — important for thin math strokes (fractions, radicals, etc.)
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, pageY, A4_W_MM, hMm);
      pageY += hMm + gapAfterMm;
    }

    placeCanvas(headerCanvas, 3);
    for (const qCanvas of questionCanvases) {
      placeCanvas(qCanvas);
    }
    if (footerCanvas) {
      placeCanvas(footerCanvas);
    }

    // 8. Stamp page numbers on every page
    const totalPages = (pdf.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(180, 180, 180);
      pdf.text(`${p} / ${totalPages}`, A4_W_MM - 10, A4_H_MM - 5, { align: 'right' });
    }

  } finally {
    document.body.removeChild(iframe);
  }

  return pdf;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a blob URL for the generated PDF.
 * Caller is responsible for revoking the URL (URL.revokeObjectURL) when done.
 */
export async function getExamPDFBlobUrl(report: ExamReport): Promise<string> {
  const doc = await buildExamPDFAsync(report);
  return doc.output('bloburl') as unknown as string;
}

/** Triggers a browser download of the generated PDF. */
export async function downloadExamPDF(report: ExamReport): Promise<void> {
  const doc = await buildExamPDFAsync(report);
  const safeName = (report.exam.subject || report.exam.title).replace(/[/\\:*?"<>|]/g, '_');
  doc.save(`${safeName}.pdf`);
}
