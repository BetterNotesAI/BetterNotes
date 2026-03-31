import { jsPDF } from 'jspdf';

export interface ExamReportQuestion {
  question_number: number;
  type: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  user_answer: string | null;
  is_correct: boolean | null;
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

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** Strip non-Latin-1 characters so Helvetica renders cleanly */
function sanitize(text: string): string {
  return text.replace(/[^\x00-\xFF]/g, '?');
}

export function buildExamPDF(report: ExamReport): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  function checkPage(needed: number) {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function drawDivider() {
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  }

  function wrap(text: string, maxW: number): string[] {
    return doc.splitTextToSize(sanitize(text), maxW) as string[];
  }

  // ── Header ──────────────────────────────────────────────────────────────────

  doc.setFillColor(99, 102, 241); // indigo-500
  doc.roundedRect(margin, y, contentW, 20, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  const titleLines = wrap(report.exam.subject || report.exam.title, contentW - 8);
  doc.text(titleLines, margin + 4, y + 7);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(130, 130, 130);
  const level = LEVEL_LABELS[report.exam.level] ?? report.exam.level;
  const date = report.exam.completed_at ? formatDate(report.exam.completed_at) : '-';
  const score = report.exam.score !== null ? `${report.exam.score}%` : '-';
  doc.text(
    `Level: ${level}   Date: ${date}   Score: ${score}   Questions: ${report.questions.length}`,
    margin, y
  );
  y += 7;

  drawDivider();

  // ── Questions ────────────────────────────────────────────────────────────────

  for (const q of report.questions) {
    const isCorrect = q.is_correct === true;
    const isWrong = q.is_correct === false;
    const unanswered = !q.user_answer || q.user_answer.trim() === '';

    const questionLines = wrap(q.question, contentW - 10);
    const answerLines = wrap(q.user_answer || '(no answer)', contentW - 18);
    const corrLines = (isWrong || unanswered) && q.type !== 'multiple_choice'
      ? wrap(q.correct_answer, contentW - 18) : [];
    const explLines = q.explanation ? wrap(q.explanation, contentW - 18) : [];

    const optHeight = q.type === 'multiple_choice' && q.options
      ? q.options.reduce((h, o) => h + wrap(o, contentW - 22).length * 4.5, 0) + 4
      : 0;

    const est = 8 + questionLines.length * 5 + optHeight +
      answerLines.length * 4.5 + 10 +
      corrLines.length * 4.5 +
      (explLines.length > 0 ? explLines.length * 4.5 + 6 : 0) + 8;

    checkPage(est);

    // Indicator circle
    const [r, g, b] = isCorrect ? [34, 197, 94] : isWrong ? [239, 68, 68] : [140, 140, 140];
    doc.setFillColor(r, g, b);
    doc.circle(margin + 3.5, y + 3.5, 3.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(String(q.question_number), margin + 3.5, y + 4.2, { align: 'center' });

    // Question text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(questionLines, margin + 9, y + 4);
    y += questionLines.length * 5 + 4;

    // Options (MC)
    if (q.type === 'multiple_choice' && q.options) {
      const labels = ['A', 'B', 'C', 'D'];
      for (let i = 0; i < q.options.length; i++) {
        const opt = q.options[i];
        const isUserChoice = opt === q.user_answer;
        const isCorrectOpt = opt === q.correct_answer;

        doc.setFont('helvetica', isUserChoice ? 'bold' : 'normal');
        doc.setFontSize(9);

        if (isUserChoice && isCorrect) doc.setTextColor(34, 197, 94);
        else if (isUserChoice && isWrong) doc.setTextColor(239, 68, 68);
        else if (isCorrectOpt && isWrong) doc.setTextColor(34, 197, 94);
        else doc.setTextColor(90, 90, 90);

        const lines = wrap(`${labels[i] ?? i + 1}. ${opt}`, contentW - 20);
        checkPage(lines.length * 4.5 + 2);
        doc.text(lines, margin + 14, y);
        y += lines.length * 4.5;
      }
      y += 3;
    }

    // Your answer label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text('Your answer:', margin + 9, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (unanswered) {
      doc.setTextColor(160, 160, 160);
      doc.text('(no answer given)', margin + 12, y);
    } else {
      doc.setTextColor(isCorrect ? 34 : 239, isCorrect ? 197 : 68, isCorrect ? 94 : 68);
      doc.text(answerLines, margin + 12, y);
      y += (answerLines.length - 1) * 4.5;
    }
    y += 5;

    // Correct answer (when wrong/unanswered, non-MC)
    if ((isWrong || unanswered) && q.type !== 'multiple_choice') {
      checkPage(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text('Correct answer:', margin + 9, y);
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(34, 197, 94);
      doc.text(corrLines, margin + 12, y);
      y += corrLines.length * 4.5 + 2;
    }

    // Explanation
    if (q.explanation && explLines.length > 0) {
      checkPage(12);
      doc.setFillColor(38, 38, 38);
      const boxH = explLines.length * 4.5 + 5;
      doc.roundedRect(margin + 9, y - 1, contentW - 9, boxH, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 180, 180);
      doc.text('Explanation', margin + 12, y + 2.5);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(200, 200, 200);
      doc.text(explLines, margin + 12, y);
      y += explLines.length * 4.5 + 2;
    }

    y += 5;
    if (q.question_number < report.questions.length) drawDivider();
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`BetterNotes  -  ${sanitize(report.exam.subject || report.exam.title)}`, margin, pageH - 7);
    doc.text(`${p} / ${totalPages}`, pageW - margin, pageH - 7, { align: 'right' });
  }

  return doc;
}

export function getExamPDFBlobUrl(report: ExamReport): string {
  const doc = buildExamPDF(report);
  return doc.output('bloburl') as unknown as string;
}

export function downloadExamPDF(report: ExamReport): void {
  const doc = buildExamPDF(report);
  const safeName = (report.exam.subject || report.exam.title).replace(/[/\\:*?"<>|]/g, '_');
  doc.save(`${safeName}.pdf`);
}
