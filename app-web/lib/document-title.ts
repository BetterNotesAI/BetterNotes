const DEFAULT_UNTITLED_TITLES = new Set([
  'untitled',
  'untitled document',
  'untitled cheat sheet',
]);

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function trimTitlePunctuation(value: string): string {
  return value
    .replace(/^[\s\-–—:;,.|/\\]+/, '')
    .replace(/[\s\-–—:;,.|/\\]+$/, '')
    .trim();
}

function finalizeTitle(raw: string, maxLength: number): string | null {
  let title = compactWhitespace(raw);
  title = trimTitlePunctuation(title);
  if (!title) return null;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(title)) return null;
  if (DEFAULT_UNTITLED_TITLES.has(title.toLowerCase())) return null;
  if (title.length > maxLength) {
    title = `${title.slice(0, maxLength).trimEnd()}...`;
  }
  return title;
}

function cleanLatexCandidate(raw: string): string {
  return raw
    .replace(/%[^\n]*/g, ' ')
    .replace(/\\hfill/g, ' ')
    .replace(/\\(?:begin|end)\{[^}]*\}/g, ' ')
    .replace(/\\[a-zA-Z]+\*?/g, ' ')
    .replace(/[{}[\]$]/g, ' ')
    .replace(/[_~`^]/g, ' ');
}

export function isDefaultDocumentTitle(title?: string | null): boolean {
  if (typeof title !== 'string') return true;
  const normalized = compactWhitespace(title).toLowerCase();
  return DEFAULT_UNTITLED_TITLES.has(normalized);
}

export function buildTitleFromPrompt(prompt?: string | null, maxLength = 90): string | null {
  if (typeof prompt !== 'string') return null;
  return finalizeTitle(prompt, maxLength);
}

export function buildTitleFromLatex(latexSource?: string | null, maxLength = 90): string | null {
  if (typeof latexSource !== 'string' || !latexSource.trim()) return null;

  const body = latexSource.includes('\\begin{document}')
    ? latexSource.split('\\begin{document}')[1] ?? latexSource
    : latexSource;

  const commandPatterns = [
    /\\title\*?\{([^{}]{3,220})\}/i,
    /\\sectionbar\{([^{}]{3,220})\}/i,
    /\\(?:section|subsection|subsubsection)\*?\{([^{}]{3,220})\}/i,
  ];

  for (const pattern of commandPatterns) {
    const match = body.match(pattern);
    if (!match?.[1]) continue;
    const candidate = finalizeTitle(cleanLatexCandidate(match[1]), maxLength);
    if (candidate) return candidate;
  }

  const largeHeadingMatch = body.match(/\{\\(?:Huge|huge|LARGE|Large|large)[\s\S]{0,220}?\}/i);
  if (largeHeadingMatch?.[0]) {
    const candidate = finalizeTitle(cleanLatexCandidate(largeHeadingMatch[0]), maxLength);
    if (candidate) return candidate;
  }

  const lines = body.split(/\r?\n/).slice(0, 80);
  for (const line of lines) {
    const raw = line.trim();
    if (!raw || raw.startsWith('%') || raw.startsWith('\\')) continue;
    const candidate = finalizeTitle(cleanLatexCandidate(line), maxLength);
    if (candidate) return candidate;
  }

  return null;
}
