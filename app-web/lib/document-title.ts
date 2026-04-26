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
    .replace(/\\&/g, '&')
    .replace(/---/g, ' - ')
    .replace(/--/g, ' - ')
    .replace(/%[^\n]*/g, ' ')
    .replace(/\\hfill/g, ' ')
    .replace(/\\(?:begin|end)\{[^}]*\}/g, ' ')
    .replace(/\\[a-zA-Z]+\*?/g, ' ')
    .replace(/[{}[\]$]/g, ' ')
    .replace(/[_~`^]/g, ' ');
}

function normalizeTitleForComparison(value: string): string {
  return compactWhitespace(value)
    .replace(/\.\.\.$/, '')
    .replace(/[.!?:;,]+$/g, '')
    .toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractLatexCommandArguments(source: string, command: string): string[] {
  const args: string[] = [];
  const pattern = new RegExp(`\\\\${escapeRegex(command)}(?![A-Za-z])\\*?(?:\\s*\\[[^\\]]*\\])?\\s*\\{`, 'g');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const openingBraceIndex = pattern.lastIndex - 1;
    let depth = 0;

    for (let i = openingBraceIndex; i < source.length; i += 1) {
      const char = source[i];
      const previous = i > 0 ? source[i - 1] : '';

      if (char === '{' && previous !== '\\') {
        depth += 1;
      } else if (char === '}' && previous !== '\\') {
        depth -= 1;
        if (depth === 0) {
          args.push(source.slice(openingBraceIndex + 1, i));
          pattern.lastIndex = i + 1;
          break;
        }
      }

      if (i - openingBraceIndex > 600) {
        break;
      }
    }
  }

  return args;
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

export function isPromptDerivedDocumentTitle(title?: string | null, prompt?: string | null): boolean {
  if (typeof title !== 'string' || typeof prompt !== 'string') return false;

  const normalizedTitle = normalizeTitleForComparison(title);
  const normalizedPrompt = normalizeTitleForComparison(prompt);
  if (!normalizedTitle || !normalizedPrompt) return false;
  if (normalizedTitle === normalizedPrompt) return true;

  const promptTitleCandidates = [72, 80, 90, 120]
    .map((maxLength) => buildTitleFromPrompt(prompt, maxLength))
    .filter((candidate): candidate is string => Boolean(candidate));

  return promptTitleCandidates.some((candidate) => {
    const normalizedCandidate = normalizeTitleForComparison(candidate);
    if (normalizedTitle === normalizedCandidate) return true;
    return title.trim().endsWith('...') && normalizedCandidate.startsWith(normalizedTitle);
  });
}

export function buildTitleFromLatex(latexSource?: string | null, maxLength = 90): string | null {
  if (typeof latexSource !== 'string' || !latexSource.trim()) return null;

  const sourceWithoutComments = latexSource.replace(/%[^\n]*/g, ' ');
  const body = sourceWithoutComments.includes('\\begin{document}')
    ? sourceWithoutComments.split('\\begin{document}')[1] ?? sourceWithoutComments
    : sourceWithoutComments;

  const prioritizedCandidates = [
    ...extractLatexCommandArguments(sourceWithoutComments, 'title'),
    ...extractLatexCommandArguments(body, 'fancyhead'),
    ...extractLatexCommandArguments(body, 'sectionbar'),
    ...extractLatexCommandArguments(body, 'section'),
    ...extractLatexCommandArguments(body, 'subsection'),
    ...extractLatexCommandArguments(body, 'subsubsection'),
    ...extractLatexCommandArguments(body, 'cheatsection'),
  ];

  for (const rawCandidate of prioritizedCandidates) {
    const candidate = finalizeTitle(cleanLatexCandidate(rawCandidate), maxLength);
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
