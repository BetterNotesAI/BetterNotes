/**
 * generateExamPDF.ts
 *
 * Renders the exam report to PDF using html2canvas + jsPDF.
 * This approach fully supports Unicode text, KaTeX-rendered math,
 * and any CSS styles — bypassing jsPDF's latin-1-only text engine.
 *
 * Strategy:
 *   1. Build an off-screen <div> with fully styled HTML for the report.
 *   2. Inject KaTeX CSS + render all $...$ / $$...$$ math inline.
 *   3. Capture with html2canvas → canvas.
 *   4. Slice canvas into A4-sized pages and add each slice as an image to jsPDF.
 *   5. Return the doc / blob URL / trigger download.
 *
 * Exports (unchanged public API):
 *   getExamPDFBlobUrl(report)  → Promise<string>  (was sync, now async — callers already await via dynamic import)
 *   downloadExamPDF(report)    → Promise<void>     (idem)
 */

import { jsPDF } from 'jspdf';
import type { default as Html2CanvasType } from 'html2canvas';

// ─── Public types ──────────────────────────────────────────────────────────────

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

// ─── Constants ─────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  // Legacy three-tier
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  // Secondary
  secondary_basic: 'Secondary — Basic',
  secondary_intermediate: 'Secondary — Intermediate',
  secondary_advanced: 'Secondary — Advanced',
  // High school
  highschool_basic: 'High School — Basic',
  highschool_intermediate: 'High School — Intermediate',
  highschool_advanced: 'High School — Advanced',
  // University
  university_basic: 'University — Basic',
  university_intermediate: 'University — Intermediate',
  university_advanced: 'University — Advanced',
};

// A4 dimensions at 96 dpi (html2canvas default)
const A4_WIDTH_PX = 794;  // 210 mm → px at 96 dpi
const A4_HEIGHT_PX = 1123; // 297 mm → px at 96 dpi

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** Escape HTML special characters for safe injection */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render inline and display math using KaTeX.
 * Replaces $$...$$ (display) and $...$ (inline) with KaTeX HTML.
 * Falls back to the raw string on error.
 */
async function renderMath(text: string): Promise<string> {
  let katex: typeof import('katex');
  try {
    katex = (await import('katex')).default as unknown as typeof import('katex');
  } catch {
    return esc(text);
  }

  // Display math $$...$$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, math) => {
    try {
      return katex.renderToString(math, { displayMode: true, throwOnError: false });
    } catch {
      return esc(math);
    }
  });

  // Inline math $...$
  text = text.replace(/\$([^$\n]+?)\$/g, (_match, math) => {
    try {
      return katex.renderToString(math, { displayMode: false, throwOnError: false });
    } catch {
      return esc(math);
    }
  });

  return text;
}

/**
 * Determine the visual state of a question for colour coding.
 * Returns: 'correct' | 'partial' | 'wrong' | 'unanswered'
 */
function questionState(q: ExamReportQuestion): 'correct' | 'partial' | 'wrong' | 'unanswered' {
  const unanswered = !q.user_answer || q.user_answer.trim() === '';
  if (unanswered) return 'unanswered';
  if (q.is_correct === true) return 'correct';
  if (
    q.partial_score !== undefined &&
    q.partial_score !== null &&
    q.partial_score > 0 &&
    q.partial_score < 1
  ) return 'partial';
  return 'wrong';
}

// Colour tokens per state
const STATE_COLORS = {
  correct:    { circle: '#16a34a', text: '#16a34a', badge: '#dcfce7', badgeText: '#15803d' },
  partial:    { circle: '#d97706', text: '#d97706', badge: '#fef3c7', badgeText: '#b45309' },
  wrong:      { circle: '#dc2626', text: '#dc2626', badge: '#fee2e2', badgeText: '#b91c1c' },
  unanswered: { circle: '#9ca3af', text: '#6b7280', badge: '#f3f4f6', badgeText: '#6b7280' },
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

async function buildReportHTML(report: ExamReport): Promise<string> {
  const level = LEVEL_LABELS[report.exam.level] ?? report.exam.level;
  const date = report.exam.completed_at ? formatDate(report.exam.completed_at) : '—';
  const score = report.exam.score !== null ? `${report.exam.score}%` : '—';

  // Render each question
  const questionBlocks: string[] = [];
  for (const q of report.questions) {
    const state = questionState(q);
    const colors = STATE_COLORS[state];
    const unanswered = state === 'unanswered';

    const questionHtml = await renderMath(q.question);
    const userAnswerHtml = q.user_answer ? await renderMath(q.user_answer) : null;
    const correctAnswerHtml = await renderMath(q.correct_answer);
    const explanationHtml = q.explanation ? await renderMath(q.explanation) : null;

    // State label text
    let stateLabel = '';
    if (state === 'correct') stateLabel = 'Correct';
    else if (state === 'partial') {
      const pct = Math.round((q.partial_score ?? 0) * 100);
      stateLabel = `Partial credit — ${pct}%`;
    } else if (state === 'wrong') stateLabel = 'Incorrect';
    else stateLabel = 'No answer';

    // Options for MC questions
    let optionsHtml = '';
    if (q.type === 'multiple_choice' && q.options) {
      const labels = ['A', 'B', 'C', 'D'];
      const optItems = await Promise.all(
        q.options.map(async (opt, i) => {
          const isUserChoice = opt === q.user_answer;
          const isCorrectOpt = opt === q.correct_answer;
          let optColor = '#9ca3af';
          let optWeight = '400';
          if (isUserChoice && state === 'correct') { optColor = '#22c55e'; optWeight = '600'; }
          else if (isUserChoice && state === 'wrong') { optColor = '#ef4444'; optWeight = '600'; }
          else if (isUserChoice && state === 'partial') { optColor = '#f59e0b'; optWeight = '600'; }
          else if (isCorrectOpt && state === 'wrong') { optColor = '#22c55e'; optWeight = '500'; }
          const optHtml = await renderMath(opt);
          return `<div style="color:${optColor};font-weight:${optWeight};margin:2px 0 2px 16px;font-size:13px;">
            <span style="font-weight:600;margin-right:4px">${labels[i] ?? i + 1}.</span>${optHtml}
          </div>`;
        })
      );
      optionsHtml = `<div style="margin:8px 0;">${optItems.join('')}</div>`;
    }

    // Correct answer section (shown for wrong/unanswered non-MC)
    let correctAnswerSection = '';
    if ((state === 'wrong' || unanswered) && q.type !== 'multiple_choice') {
      correctAnswerSection = `
        <div style="margin-top:6px;">
          <div style="font-size:11px;color:#9ca3af;font-weight:600;margin-bottom:3px;">Correct answer</div>
          <div style="color:#16a34a;font-size:13px;">${correctAnswerHtml}</div>
        </div>`;
    }

    // Explanation section
    let explanationSection = '';
    if (explanationHtml) {
      explanationSection = `
        <div style="margin-top:10px;background:#f9fafb;border-radius:6px;padding:10px 12px;border:1px solid #e5e7eb;">
          <div style="font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Explanation</div>
          <div style="color:#374151;font-size:12.5px;line-height:1.6;">${explanationHtml}</div>
        </div>`;
    }

    questionBlocks.push(`
      <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #e5e7eb;">
        <!-- Question header -->
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;">
          <div style="
            min-width:22px;height:22px;border-radius:50%;background:${colors.circle};
            display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:700;color:#fff;flex-shrink:0;margin-top:1px;">
            ${q.question_number}
          </div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:#111827;line-height:1.5;">${questionHtml}</div>
          </div>
          <div style="
            padding:3px 8px;border-radius:999px;font-size:10px;font-weight:600;
            background:${colors.badge};color:${colors.badgeText};white-space:nowrap;flex-shrink:0;margin-top:1px;">
            ${stateLabel}
          </div>
        </div>

        ${optionsHtml}

        <!-- User answer -->
        <div style="margin-top:6px;">
          <div style="font-size:11px;color:#9ca3af;font-weight:600;margin-bottom:3px;">Your answer</div>
          ${unanswered
            ? `<div style="color:#9ca3af;font-style:italic;font-size:13px;">(no answer given)</div>`
            : `<div style="color:${colors.text};font-size:13px;">${userAnswerHtml}</div>`
          }
        </div>

        ${correctAnswerSection}
        ${explanationSection}
      </div>
    `);
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
        crossorigin="anonymous"
      />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
          background: #ffffff;
          color: #111827;
          width: ${A4_WIDTH_PX}px;
          padding: 40px 48px;
          line-height: 1.5;
        }
        .katex { font-size: 1em; }
        .katex-display { margin: 6px 0; overflow-x: auto; }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div style="background:#4f46e5;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:6px;">
          ${esc(report.exam.subject || report.exam.title)}
        </div>
        <div style="display:flex;gap:20px;font-size:12px;color:rgba(255,255,255,.75);">
          <span>Level: ${esc(level)}</span>
          <span>Date: ${esc(date)}</span>
          <span>Score: ${esc(score)}</span>
          <span>Questions: ${report.questions.length}</span>
        </div>
      </div>

      <!-- Questions -->
      ${questionBlocks.join('')}

      <!-- Footer -->
      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;">
        BetterNotes — ${esc(report.exam.subject || report.exam.title)}
      </div>
    </body>
    </html>
  `;
}

// ─── Core render pipeline ─────────────────────────────────────────────────────

/**
 * Renders the exam report HTML off-screen, captures it with html2canvas,
 * slices into A4 pages, and returns a jsPDF document.
 */
async function buildExamPDFAsync(report: ExamReport): Promise<jsPDF> {
  // 1. Build HTML
  const html = await buildReportHTML(report);

  // 2. Mount off-screen iframe so the full HTML document (head + styles + KaTeX CSS) renders correctly
  const iframe = document.createElement('iframe');
  iframe.style.cssText = [
    `position:fixed`,
    `top:0`,
    `left:-${A4_WIDTH_PX + 200}px`,
    `width:${A4_WIDTH_PX}px`,
    `height:${A4_HEIGHT_PX}px`,
    `border:none`,
    `pointer-events:none`,
    `z-index:-9999`,
  ].join(';');
  document.body.appendChild(iframe);

  // Write the full HTML document into the iframe
  const iframeDoc = iframe.contentDocument!;
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // 3. Wait for iframe fonts and external CSS (KaTeX) to load
  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    // Fallback: resolve after 1s even if onload doesn't fire
    setTimeout(resolve, 1000);
  });
  await iframeDoc.fonts.ready;
  // Extra tick for KaTeX CSS paint
  await new Promise((r) => setTimeout(r, 150));

  let pdf!: jsPDF;
  try {
    // 4. Capture with html2canvas
    const html2canvas: typeof Html2CanvasType = (await import('html2canvas')).default;
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: A4_WIDTH_PX,
    });

    // 5. Slice canvas into A4 pages and build PDF
    const canvasW = canvas.width;
    const canvasH = canvas.height;

    // At scale:2, each A4 page in canvas pixels:
    const pageH_canvas = A4_HEIGHT_PX * 2;

    const totalPages = Math.ceil(canvasH / pageH_canvas);

    // jsPDF in mm — A4: 210 x 297
    pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();   // 210
    const pdfH = pdf.internal.pageSize.getHeight();  // 297

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      const srcY = page * pageH_canvas;
      const sliceH = Math.min(pageH_canvas, canvasH - srcY);

      // Create a temporary canvas for this slice
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvasW;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, srcY, canvasW, sliceH, 0, 0, canvasW, sliceH);

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);

      // Map slice height to mm proportionally
      const sliceH_mm = (sliceH / pageH_canvas) * pdfH;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, sliceH_mm);
    }

    // Footer: page numbers
    const totalPagesNum = (pdf.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
    for (let p = 1; p <= totalPagesNum; p++) {
      pdf.setPage(p);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${p} / ${totalPagesNum}`, pdfW - 10, pdfH - 5, { align: 'right' });
    }
  } finally {
    document.body.removeChild(iframe);
  }

  return pdf;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a blob URL for the generated PDF.
 * The caller is responsible for revoking the URL when done (URL.revokeObjectURL).
 */
export async function getExamPDFBlobUrl(report: ExamReport): Promise<string> {
  const doc = await buildExamPDFAsync(report);
  return doc.output('bloburl') as unknown as string;
}

/**
 * Triggers a browser download of the generated PDF.
 */
export async function downloadExamPDF(report: ExamReport): Promise<void> {
  const doc = await buildExamPDFAsync(report);
  const safeName = (report.exam.subject || report.exam.title).replace(/[/\\:*?"<>|]/g, '_');
  doc.save(`${safeName}.pdf`);
}
