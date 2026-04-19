/**
 * markdown-to-latex.ts
 *
 * Converts a Markdown cheat sheet to a complete .tex file for a given template.
 * No AI is involved — the conversion is purely deterministic.
 *
 * Key invariant: $...$ and $$...$$ spans are passed through untouched.
 * All escaping and formatting happens only in NON-math segments.
 */

import { getTemplateOrThrow } from './templates';

// ---------------------------------------------------------------------------
// Inline text processing
// ---------------------------------------------------------------------------

/**
 * Split a string into alternating non-math / math segments.
 * Index 0, 2, 4 ... are plain text; 1, 3, 5 ... are math (including the $ delimiters).
 *
 * Handles:
 *   - $$...$$ display math (must be checked first)
 *   - $...$ inline math
 *
 * Math content is returned verbatim (delimiters included).
 */
function splitByMath(text: string): string[] {
  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Look for $$ first (display math on a single line, e.g. "See $$ E=mc^2 $$ here")
    const ddIdx = remaining.indexOf('$$');
    // Look for single $
    const sIdx = remaining.indexOf('$');

    if (sIdx === -1) {
      // No math at all
      segments.push(remaining);
      break;
    }

    // Is the first $ actually part of $$?
    const firstIsDd = ddIdx === sIdx;

    if (firstIsDd) {
      // Push text before $$
      if (ddIdx > 0) segments.push(remaining.slice(0, ddIdx));
      // Find closing $$
      const closeIdx = remaining.indexOf('$$', ddIdx + 2);
      if (closeIdx === -1) {
        // No closing $$ — treat remainder as plain text
        segments.push(remaining.slice(ddIdx));
        break;
      }
      segments.push(remaining.slice(ddIdx, closeIdx + 2));
      remaining = remaining.slice(closeIdx + 2);
    } else {
      // Push text before $
      if (sIdx > 0) segments.push(remaining.slice(0, sIdx));
      // Find closing $
      const closeIdx = remaining.indexOf('$', sIdx + 1);
      if (closeIdx === -1) {
        // No closing $ — treat remainder as plain text
        segments.push(remaining.slice(sIdx));
        break;
      }
      segments.push(remaining.slice(sIdx, closeIdx + 1));
      remaining = remaining.slice(closeIdx + 1);
    }
  }

  return segments;
}

/**
 * Escape LaTeX special characters in a plain-text segment (not math).
 * Order matters: backslash must be escaped first.
 */
function escapePlainText(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/_/g, '\\_');
}

/**
 * Apply Markdown inline formatting to a plain-text segment.
 * Runs BEFORE escape so that markdown delimiters are consumed first.
 * Only bold, italic, inline-code are handled.
 *
 * Note: braces introduced by the replacements below are LaTeX commands,
 * so we do NOT escape them again — escapePlainText runs only on the
 * remaining literal characters afterward.
 */
function applyInlineMarkdown(text: string): string {
  // Inline code first (takes priority over bold/italic)
  // We process it by splitting on backtick pairs to avoid escaping inside code
  let result = '';
  const parts = text.split(/(`[^`]+`)/);
  for (const part of parts) {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 3) {
      const code = part.slice(1, -1);
      // Escape backslashes in code for \texttt
      const escapedCode = code.replace(/\\/g, '\\textbackslash{}').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
      result += `\\texttt{${escapedCode}}`;
    } else {
      // Apply bold and italic, then escape the rest
      let p = part;
      // Bold: **text** or __text__
      p = p.replace(/\*\*(.+?)\*\*/g, (_m, inner) => `\\textbf{${escapePlainText(inner)}}`);
      p = p.replace(/__(.+?)__/g, (_m, inner) => `\\textbf{${escapePlainText(inner)}}`);
      // Italic: *text* or _text_ (but not inside words for _)
      p = p.replace(/\*(.+?)\*/g, (_m, inner) => `\\textit{${escapePlainText(inner)}}`);
      p = p.replace(/(?<![a-zA-Z0-9])_(.+?)_(?![a-zA-Z0-9])/g, (_m, inner) => `\\textit{${escapePlainText(inner)}}`);
      // Escape remaining plain characters (not already inside \textbf etc.)
      // We need to escape only raw text — the replacements above already consumed
      // their delimiters and wrapped content in \textbf{escapedInner} so those
      // braces are intentional LaTeX. We must escape the leftover characters that
      // are NOT part of any LaTeX command we just emitted.
      //
      // Strategy: split on already-emitted LaTeX commands (\\textbf{...}, \\textit{...})
      // and escape only the gaps between them.
      p = escapeNonCommandParts(p);
      result += p;
    }
  }
  return result;
}

/**
 * Given a string that may contain \\textbf{...} / \\textit{...} / \\texttt{...}
 * commands (already correct LaTeX), escape all characters OUTSIDE those commands.
 */
function escapeNonCommandParts(text: string): string {
  // Match \textbf{...}, \textit{...}, \texttt{...} with balanced inner content
  // (simple version: non-greedy up to first })
  const LATEX_CMD_RE = /\\text(?:bf|it|tt)\{[^}]*\}/g;

  const result: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  LATEX_CMD_RE.lastIndex = 0;
  while ((match = LATEX_CMD_RE.exec(text)) !== null) {
    // Escape the text before this command
    if (match.index > lastIndex) {
      result.push(escapePlainText(text.slice(lastIndex, match.index)));
    }
    // Keep the command as-is
    result.push(match[0]);
    lastIndex = match.index + match[0].length;
  }
  // Escape remaining text
  if (lastIndex < text.length) {
    result.push(escapePlainText(text.slice(lastIndex)));
  }

  return result.join('');
}

/**
 * Process a full inline line (may contain math spans).
 * Returns LaTeX string suitable for body text.
 */
function processInline(line: string): string {
  const segments = splitByMath(line);
  const result: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isMath = seg.startsWith('$');
    if (isMath) {
      // Keep math verbatim
      result.push(seg);
    } else {
      result.push(applyInlineMarkdown(seg));
    }
  }

  return result.join('');
}

// ---------------------------------------------------------------------------
// Template-specific wrappers
// ---------------------------------------------------------------------------

interface TemplateConfig {
  wrapBody: (body: string, title: string) => string;
  h2: (title: string, isFirst: boolean) => string;
  h3: (title: string) => string;
  hr: string;
}

function escapeTitle(title: string): string {
  return escapePlainText(title);
}

const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
  '2cols_portrait': {
    wrapBody: (body, title) => {
      const escapedTitle = escapeTitle(title);
      return [
        '\\begin{document}',
        '\\pagestyle{empty}',
        `{\\Large\\bfseries ${escapedTitle} \\hfill \\normalsize Cheat-Sheet (2 cols)}\\HR`,
        '',
        '\\begin{multicols}{2}',
        '\\footnotesize',
        '',
        body,
        '',
        '\\end{multicols}',
        '\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}',
        '\\end{document}',
      ].join('\n');
    },
    h2: (title, isFirst) => {
      const prefix = isFirst ? '' : '\\HR\n';
      return `${prefix}\\textbf{${processInline(title)}}\\\\`;
    },
    h3: (title) => `\\textbf{${processInline(title)}}\\\\`,
    hr: '\\HR',
  },

  'landscape_3col_maths': {
    wrapBody: (body, _title) => [
      '\\begin{document}',
      '\\begin{multicols*}{3}',
      '',
      body,
      '',
      '\\end{multicols*}',
      '\\end{document}',
    ].join('\n'),
    h2: (title, _isFirst) => `\\section*{${processInline(title)}}`,
    h3: (title) => `\\subsection*{${processInline(title)}}`,
    hr: '\\vspace{0.2em}\\hrule\\vspace{0.2em}',
  },

  'clean_3cols_landscape': {
    wrapBody: (body, title) => {
      const escapedTitle = escapeTitle(title);
      return [
        '\\begin{document}',
        '\\noindent\\colorbox{headerblue}{%',
        '  \\parbox{\\dimexpr\\textwidth-2\\fboxsep\\relax}{%',
        '    \\vspace{3pt}',
        `    \\centering{\\Large\\bfseries\\color{white} ${escapedTitle}}\\\\[1pt]`,
        '    {\\small\\color{white!85} Clean review format}',
        '    \\vspace{3pt}',
        '  }%',
        '}',
        '\\vspace{4pt}',
        '',
        '\\begin{multicols}{3}',
        '',
        body,
        '',
        '\\end{multicols}',
        '\\begin{flushright}\\tiny\\textit{Generated with BetterNotes}\\end{flushright}',
        '\\end{document}',
      ].join('\n');
    },
    h2: (title, _isFirst) => `\\cheatsection{${processInline(title)}}`,
    h3: (title) => `\\cheatsub{${processInline(title)}}`,
    hr: '\\vspace{3pt}\\hrule\\vspace{3pt}',
  },

  'study_form': {
    wrapBody: (body, title) => {
      const escapedTitle = escapeTitle(title);
      return [
        '\\begin{document}',
        '\\footnotesize',
        '',
        '\\begin{center}',
        `    {\\Large \\textbf{${escapedTitle}}}`,
        '\\end{center}',
        '',
        '\\vspace{-0.4em}',
        '',
        '\\begin{multicols}{3}',
        '\\raggedcolumns',
        '\\justifying',
        '',
        body,
        '',
        '\\end{multicols}',
        '\\end{document}',
      ].join('\n');
    },
    h2: (title, _isFirst) => `\\section{${processInline(title)}}`,
    h3: (title) => `\\subsection{${processInline(title)}}`,
    hr: '\\vspace{0.15em}\\hrule\\vspace{0.2em}',
  },

  'lecture_notes': {
    wrapBody: (body, title) => {
      const escapedTitle = escapeTitle(title);
      return [
        '\\begin{document}',
        `\\section*{${escapedTitle}}`,
        '',
        body,
        '',
        '\\end{document}',
      ].join('\n');
    },
    h2: (title, _isFirst) => `\\section{${processInline(title)}}`,
    h3: (title) => `\\subsection{${processInline(title)}}`,
    hr: '\\vspace{0.5em}\\hrule\\vspace{0.5em}',
  },

  'classic_lecture_notes': {
    wrapBody: (body, title) => {
      const escapedTitle = escapeTitle(title);
      return [
        '\\begin{document}',
        `\\section*{${escapedTitle}}`,
        '',
        body,
        '',
        '\\end{document}',
      ].join('\n');
    },
    h2: (title, _isFirst) => `\\section{${processInline(title)}}`,
    h3: (title) => `\\subsection{${processInline(title)}}`,
    hr: '\\vspace{0.5em}\\hrule\\vspace{0.5em}',
  },
};

/**
 * Get template config, falling back to '2cols_portrait' for unknown template IDs.
 */
function getTemplateConfig(templateId: string): TemplateConfig {
  return TEMPLATE_CONFIGS[templateId] ?? TEMPLATE_CONFIGS['2cols_portrait'];
}

// ---------------------------------------------------------------------------
// Block-level state machine
// ---------------------------------------------------------------------------

type ListType = 'itemize' | 'enumerate' | null;

interface State {
  listType: ListType;
  inBlockquote: boolean;
  inVerbatim: boolean;
  inDisplayMath: boolean;
  verbatimLines: string[];
  displayMathLines: string[];
  h2Count: number;
}

function closeList(state: State, lines: string[]): void {
  if (state.listType === 'itemize') {
    lines.push('\\end{itemize}');
  } else if (state.listType === 'enumerate') {
    lines.push('\\end{enumerate}');
  }
  state.listType = null;
}

function closeBlockquote(state: State, lines: string[]): void {
  if (state.inBlockquote) {
    lines.push('\\end{quote}');
    state.inBlockquote = false;
  }
}

/**
 * Convert Markdown body text to LaTeX body lines (no preamble, no \begin{document}).
 */
function convertBody(md: string, cfg: TemplateConfig): string {
  const inputLines = md.split('\n');
  const outputLines: string[] = [];
  const state: State = {
    listType: null,
    inBlockquote: false,
    inVerbatim: false,
    inDisplayMath: false,
    verbatimLines: [],
    displayMathLines: [],
    h2Count: 0,
  };

  for (let i = 0; i < inputLines.length; i++) {
    const raw = inputLines[i];
    const trimmed = raw.trim();

    // ── Verbatim block ──────────────────────────────────────────────────────
    if (state.inVerbatim) {
      if (trimmed === '```') {
        state.inVerbatim = false;
        outputLines.push('\\begin{verbatim}');
        outputLines.push(...state.verbatimLines);
        outputLines.push('\\end{verbatim}');
        state.verbatimLines = [];
      } else {
        state.verbatimLines.push(raw);
      }
      continue;
    }

    // ── Display math block (\$\$ ... \$\$) ─────────────────────────────────
    if (state.inDisplayMath) {
      if (trimmed === '$$') {
        state.inDisplayMath = false;
        outputLines.push('\\[');
        outputLines.push(...state.displayMathLines);
        outputLines.push('\\]');
        state.displayMathLines = [];
      } else {
        state.displayMathLines.push(raw);
      }
      continue;
    }

    // ── Start verbatim block ────────────────────────────────────────────────
    if (trimmed.startsWith('```')) {
      closeBlockquote(state, outputLines);
      closeList(state, outputLines);
      state.inVerbatim = true;
      state.verbatimLines = [];
      continue;
    }

    // ── Start display math block ────────────────────────────────────────────
    if (trimmed === '$$') {
      closeBlockquote(state, outputLines);
      closeList(state, outputLines);
      state.inDisplayMath = true;
      state.displayMathLines = [];
      continue;
    }

    // ── Heading 1 (skip — used as doc title separately) ─────────────────────
    if (/^#\s+/.test(trimmed)) {
      continue;
    }

    // ── Heading 2 ───────────────────────────────────────────────────────────
    if (/^##\s+/.test(trimmed)) {
      const title = trimmed.replace(/^##\s+/, '').trim();
      closeBlockquote(state, outputLines);
      closeList(state, outputLines);
      const isFirst = state.h2Count === 0;
      outputLines.push(cfg.h2(title, isFirst));
      state.h2Count++;
      continue;
    }

    // ── Heading 3 ───────────────────────────────────────────────────────────
    if (/^###\s+/.test(trimmed)) {
      const title = trimmed.replace(/^###\s+/, '').trim();
      closeBlockquote(state, outputLines);
      closeList(state, outputLines);
      outputLines.push(cfg.h3(title));
      continue;
    }

    // ── Horizontal rule ─────────────────────────────────────────────────────
    if (/^(---+|\*\*\*+|___+)$/.test(trimmed)) {
      closeBlockquote(state, outputLines);
      closeList(state, outputLines);
      outputLines.push(cfg.hr);
      continue;
    }

    // ── Blockquote ──────────────────────────────────────────────────────────
    if (trimmed.startsWith('> ')) {
      closeList(state, outputLines);
      if (!state.inBlockquote) {
        outputLines.push('\\begin{quote}');
        state.inBlockquote = true;
      }
      outputLines.push(processInline(trimmed.slice(2)));
      continue;
    }

    // ── Unordered list item ─────────────────────────────────────────────────
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      closeBlockquote(state, outputLines);
      if (state.listType === 'enumerate') {
        closeList(state, outputLines);
      }
      if (state.listType === null) {
        outputLines.push('\\begin{itemize}');
        state.listType = 'itemize';
      }
      outputLines.push(`\\item ${processInline(bulletMatch[1])}`);
      continue;
    }

    // ── Ordered list item ───────────────────────────────────────────────────
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      closeBlockquote(state, outputLines);
      if (state.listType === 'itemize') {
        closeList(state, outputLines);
      }
      if (state.listType === null) {
        outputLines.push('\\begin{enumerate}');
        state.listType = 'enumerate';
      }
      outputLines.push(`\\item ${processInline(orderedMatch[1])}`);
      continue;
    }

    // ── Empty line ──────────────────────────────────────────────────────────
    if (trimmed === '') {
      closeBlockquote(state, outputLines);
      closeList(state, outputLines);
      outputLines.push('');
      continue;
    }

    // ── Regular paragraph line ──────────────────────────────────────────────
    closeBlockquote(state, outputLines);
    closeList(state, outputLines);
    outputLines.push(processInline(trimmed));
  }

  // Close any open environments at EOF
  closeBlockquote(state, outputLines);
  closeList(state, outputLines);

  // Flush unclosed verbatim/display math (malformed input)
  if (state.inVerbatim && state.verbatimLines.length > 0) {
    outputLines.push('\\begin{verbatim}');
    outputLines.push(...state.verbatimLines);
    outputLines.push('\\end{verbatim}');
  }
  if (state.inDisplayMath && state.displayMathLines.length > 0) {
    outputLines.push('\\[');
    outputLines.push(...state.displayMathLines);
    outputLines.push('\\]');
  }

  return outputLines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert Markdown cheat sheet to a complete .tex document string.
 *
 * @param md         Markdown source (may contain $...$ and $$...$$ LaTeX math)
 * @param templateId One of: 2cols_portrait | landscape_3col_maths | clean_3cols_landscape | study_form | lecture_notes | classic_lecture_notes
 * @param title      Document title (used in the wrapper, not parsed from md)
 * @returns          Complete .tex file content ready to feed to pdflatex
 */
export function markdownToLatexDoc(md: string, templateId: string, title: string): string {
  const template = getTemplateOrThrow(templateId);
  const cfg = getTemplateConfig(templateId);

  const body = convertBody(md, cfg);
  const document = cfg.wrapBody(body, title);

  return `${template.preamble}\n\n${document}`;
}
