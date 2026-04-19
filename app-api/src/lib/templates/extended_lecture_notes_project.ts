import { ProjectFile } from '../latex';

const DEFAULT_PACKAGES = String.raw`\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[english]{babel}
\usepackage{lmodern}
\usepackage{microtype}
\usepackage{geometry}
\geometry{a4paper,left=25mm,right=25mm,top=25mm,bottom=25mm}
\usepackage{amsmath,amsthm,amssymb,amsfonts,mathtools}
\usepackage{xcolor}
\usepackage{graphicx}
\usepackage{float}
\usepackage{booktabs}
\usepackage{array}
\usepackage{tabularx}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage[hidelinks]{hyperref}
\usepackage[document]{ragged2e}
\usepackage[round,authoryear]{natbib}
\setcitestyle{authoryear,open={(},close={)}}
\setlength{\parskip}{0.5em}
\setlength{\parindent}{0em}
\definecolor{themecolor}{rgb}{0.0, 0.2, 0.5}
\definecolor{secondarycolor}{rgb}{0.3, 0.5, 0.8}
\titleformat{\chapter}[hang]
  {\huge\bfseries{\color{secondarycolor}\titlerule}\vspace{2mm}}
  {\textcolor{themecolor}{\thechapter}\hspace{7pt}\textcolor{themecolor}{.}\hspace{20pt}}
  {0pt}
  {\huge\bfseries}[\vspace{4mm}{\color{secondarycolor}\titlerule}]
\titleformat{\section}
  {\normalfont\Large\bfseries}
  {\textcolor{themecolor}{\thesection}}{1em}{}
\titleformat{\subsection}
  {\normalfont\large\bfseries}
  {\textcolor{themecolor}{\thesubsection}}{1em}{}
\setlist[itemize]{itemsep=1pt, topsep=1pt}
\setlist[enumerate]{itemsep=1pt, topsep=3pt}
\theoremstyle{plain}
\newtheorem{theorem}{Theorem}[section]
\newtheorem{lemma}[theorem]{Lemma}
\newtheorem{proposition}[theorem]{Proposition}
\newtheorem{corollary}[theorem]{Corollary}
\theoremstyle{definition}
\newtheorem{definition}[theorem]{Definition}
\theoremstyle{remark}
\newtheorem{remark}[theorem]{Remark}
\providecolor{accent}{RGB}{0,90,170}
\newcounter{workedex}[chapter]
\renewcommand{\theworkedex}{\thechapter.\arabic{workedex}}
\newenvironment{workedexample}[1][]{%
  \refstepcounter{workedex}%
  \par\medskip
  \noindent{\color{accent}\rule{\linewidth}{0.6pt}}\par
  \noindent\textbf{\color{accent}Example \theworkedex\ifx\relax#1\relax\else: #1\fi}\par
  \vspace{2pt}
  \begingroup
}{%
  \par\endgroup
  \noindent{\color{accent}\rule{\linewidth}{0.6pt}}\par\medskip
}
\newenvironment{keypoint}[1][Key Point]{%
  \par\medskip
  \noindent\textbf{\color{accent!80!black}#1}\par
  \noindent{\color{accent!50}\rule{\linewidth}{0.4pt}}\par
  \begingroup
}{%
  \par\endgroup
  \noindent{\color{accent!50}\rule{\linewidth}{0.4pt}}\par\medskip
}
\newenvironment{warning}[1][Note]{%
  \par\medskip
  \noindent\textbf{\color{red!70!black}#1}\par
  \noindent{\color{red!50}\rule{\linewidth}{0.4pt}}\par
  \begingroup
}{%
  \par\endgroup
  \noindent{\color{red!50}\rule{\linewidth}{0.4pt}}\par\medskip
}`;

const FALLBACK_CONCLUSIONS = [
  '\\chapter*{Conclusions}',
  '\\addcontentsline{toc}{chapter}{Conclusions}',
  'This section summarizes the key ideas from the generated lecture notes.',
  '',
  '\\begin{itemize}',
  '  \\item Consolidate the main principles and equations.',
  '  \\item Highlight typical mistakes and practical implications.',
  '  \\item Suggest next topics to study for deeper understanding.',
  '\\end{itemize}',
].join('\n');

const FALLBACK_WORKEDEX_BLOCK = String.raw`\providecolor{accent}{RGB}{0,90,170}
\newcounter{workedex}[chapter]
\renewcommand{\theworkedex}{\thechapter.\arabic{workedex}}
\newenvironment{workedexample}[1][]{%
  \refstepcounter{workedex}%
  \par\medskip
  \noindent{\color{accent}\rule{\linewidth}{0.6pt}}\par
  \noindent\textbf{\color{accent}Example \theworkedex\ifx\relax#1\relax\else: #1\fi}\par
  \vspace{2pt}
  \begingroup
}{%
  \par\endgroup
  \noindent{\color{accent}\rule{\linewidth}{0.6pt}}\par\medskip
}`;

const FALLBACK_KEYPOINT_ENV = String.raw`\providecolor{accent}{RGB}{0,90,170}
\newenvironment{keypoint}[1][Key Point]{%
  \par\medskip
  \noindent\textbf{\color{accent!80!black}#1}\par
  \noindent{\color{accent!50}\rule{\linewidth}{0.4pt}}\par
  \begingroup
}{%
  \par\endgroup
  \noindent{\color{accent!50}\rule{\linewidth}{0.4pt}}\par\medskip
}`;

const FALLBACK_WARNING_ENV = String.raw`\providecolor{accent}{RGB}{0,90,170}
\newenvironment{warning}[1][Note]{%
  \par\medskip
  \noindent\textbf{\color{red!70!black}#1}\par
  \noindent{\color{red!50}\rule{\linewidth}{0.4pt}}\par
  \begingroup
}{%
  \par\endgroup
  \noindent{\color{red!50}\rule{\linewidth}{0.4pt}}\par\medskip
}`;

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function hasPackage(packagesContent: string, pkg: string): boolean {
  const pattern = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*\\b${pkg}\\b[^}]*\\}`);
  return pattern.test(packagesContent);
}

function ensurePackageBlock(packagesContent: string): string {
  let out = packagesContent.trim();
  if (!out) out = DEFAULT_PACKAGES;
  if (!hasPackage(out, 'graphicx')) out += '\n\\usepackage{graphicx}';
  if (!hasPackage(out, 'float')) out += '\n\\usepackage{float}';
  if (!hasPackage(out, 'natbib')) out += '\n\\usepackage[round,authoryear]{natbib}\n\\setcitestyle{authoryear,open={(},close={)}}';
  if (!hasPackage(out, 'ragged2e')) out += '\n\\usepackage[document]{ragged2e}';
  if (!hasPackage(out, 'geometry')) out += '\n\\usepackage{geometry}\n\\geometry{a4paper,left=25mm,right=25mm,top=25mm,bottom=25mm}';
  if (!/\\newenvironment\{workedexample\}/.test(out)) out += `\n${FALLBACK_WORKEDEX_BLOCK}`;
  if (!/\\newenvironment\{keypoint\}/.test(out)) out += `\n${FALLBACK_KEYPOINT_ENV}`;
  if (!/\\newenvironment\{warning\}/.test(out)) out += `\n${FALLBACK_WARNING_ENV}`;
  return out.trim();
}

function extractCommandValue(text: string, command: string): string | null {
  const match = text.match(new RegExp(`\\\\${command}\\s*\\{([\\s\\S]*?)\\}`));
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : null;
}

function removeCommandBlock(text: string, command: string): string {
  return text.replace(new RegExp(`\\\\${command}\\s*\\{[\\s\\S]*?\\}`, 'g'), '');
}

function cleanFrontMatter(text: string): string {
  let out = text;
  out = removeCommandBlock(out, 'title');
  out = removeCommandBlock(out, 'author');
  out = removeCommandBlock(out, 'date');
  out = out.replace(/\\maketitle/g, '');
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

function splitTopLevelDivisions(text: string): string[] {
  const divisionRegex = /\\(?:chapter|section)\*?\{[^}]+\}/g;
  const matches = [...text.matchAll(divisionRegex)];
  if (matches.length === 0) return [];

  const divisions: string[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    divisions.push(text.slice(start, end).trim());
  }
  return divisions.filter(Boolean);
}

function divisionTitle(chunk: string): string {
  const m = chunk.match(/\\(?:chapter|section)\*?\{([^}]+)\}/);
  return (m?.[1] ?? '').trim();
}

function isConclusionSectionTitle(title: string): boolean {
  return /^(summary|conclusion|conclusions|resumen|conclusion|conclusiones)$/i.test(title.trim());
}

function promoteDivisionToChapter(chunk: string): string {
  if (/^\s*\\chapter\*?\{/.test(chunk)) return chunk.trim();
  if (/^\s*\\section\*?\{/.test(chunk)) {
    return chunk.replace(/^\s*\\section(\*?)\{([^}]+)\}/, '\\chapter$1{$2}').trim();
  }
  return ['\\chapter{Lecture Notes}', chunk.trim()].join('\n\n').trim();
}

function extractCitationKeys(text: string): string[] {
  const keys = new Set<string>();
  const citeRegex = /\\cite[a-zA-Z*]*\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = citeRegex.exec(text)) !== null) {
    const raw = m[1];
    for (const key of raw.split(',')) {
      const cleaned = key.trim();
      if (cleaned) keys.add(cleaned);
    }
  }
  return [...keys];
}

function sanitizeBibKey(key: string, index: number): string {
  const sanitized = key.replace(/[^A-Za-z0-9:_-]/g, '_');
  return sanitized.length > 0 ? sanitized : `generated_ref_${index + 1}`;
}

function buildReferencesBib(citationKeys: string[]): string {
  if (citationKeys.length === 0) {
    return [
      '@misc{generated_reference,',
      '  author = {BetterNotes AI},',
      '  title = {Generated Lecture Notes Reference Placeholder},',
      '  year = {2026},',
      '  note = {Replace this entry with course bibliography references.}',
      '}',
      '',
    ].join('\n');
  }

  const entries = citationKeys.map((key, index) => {
    const bibKey = sanitizeBibKey(key, index);
    return [
      `@misc{${bibKey},`,
      `  title = {Reference for ${bibKey}},`,
      '  author = {Unknown},',
      '  year = {n.d.},',
      '  note = {Auto-generated placeholder. Replace with a real bibliographic entry.}',
      '}',
      '',
    ].join('\n');
  });

  return entries.join('\n');
}

function buildFirstPages(title: string, author: string, dateValue: string, frontMatterContent: string): string {
  const withFrontMatter = frontMatterContent
    ? [
        '',
        '% Preface content produced by AI (after cover + TOC)',
        frontMatterContent,
      ].join('\n')
    : '';

  return [
    '% Chapters/first-pages.tex',
    '',
    '\\begin{titlepage}',
    '  \\centering',
    '  \\vspace*{0.5cm}',
    '  \\IfFileExists{Figures/logo_fake.png}{%',
    '    \\includegraphics[height=5.0cm]{Figures/logo_fake.png}\\\\[0.8cm]',
    '  }{}',
    '  \\rule{\\textwidth}{0.8pt}\\par',
    '  \\vspace{0.7cm}',
    `  {\\Huge\\bfseries ${title} \\par}`,
    '  \\vspace{0.7cm}',
    '  \\rule{\\textwidth}{0.8pt}\\par',
    '  \\vspace{1.8cm}',
    `  {\\Large \\textbf{Author:} ${author} \\par}`,
    '  \\vspace{0.4cm}',
    `  {\\large ${dateValue} \\par}`,
    '  \\vspace{2.2cm}',
    '  {\\large \\textbf{Document generated with BetterNotes AI} \\par}',
    '  \\vfill',
    '\\end{titlepage}',
    '',
    '\\addtocontents{toc}{\\protect\\thispagestyle{empty}}',
    '\\tableofcontents',
    '\\thispagestyle{empty}',
    '\\newpage',
    '\\setcounter{page}{1}',
    withFrontMatter,
  ].join('\n').trim();
}

/**
 * Splits a monolithic lecture-notes LaTeX source into a project-like structure.
 * The result follows the extended lecture-notes scaffold:
 * - report class
 * - dedicated first pages (cover + TOC)
 * - chapter files under Chapters/
 * - Figures/ folder
 * - references.bib + bibliography commands
 */
export function buildExtendedLectureNotesProjectFiles(latexSource: string): ProjectFile[] {
  const normalized = normalizeNewlines(latexSource);

  const beginTag = '\\begin{document}';
  const endTag = '\\end{document}';
  const beginIdx = normalized.indexOf(beginTag);
  const endIdx = normalized.lastIndexOf(endTag);

  const preambleRaw = beginIdx >= 0
    ? normalized.slice(0, beginIdx)
    : normalized;

  const bodyRaw = beginIdx >= 0
    ? normalized.slice(beginIdx + beginTag.length, endIdx >= 0 ? endIdx : undefined)
    : normalized;

  const preambleLines = preambleRaw
    .split('\n')
    .map((line) => line.trimEnd());

  const packagesContent = ensurePackageBlock(
    preambleLines
      .filter((line) => !line.trim().startsWith('\\documentclass'))
      .join('\n')
  );

  const extractedTitle = extractCommandValue(normalized, 'title') ?? 'Extended Lecture Notes';
  const extractedAuthor = extractCommandValue(normalized, 'author') ?? 'BetterNotes AI';
  const extractedDate = extractCommandValue(normalized, 'date') ?? '\\today';

  const body = bodyRaw.trim();
  const firstDivisionIdx = body.search(/\\(?:chapter|section)\*?\{/);
  const frontMatterRaw = firstDivisionIdx >= 0 ? body.slice(0, firstDivisionIdx).trim() : body;
  const frontMatterContent = cleanFrontMatter(frontMatterRaw);
  const divisionContentRaw = firstDivisionIdx >= 0 ? body.slice(firstDivisionIdx) : '';
  const splitDivisions = splitTopLevelDivisions(divisionContentRaw);

  let conclusionsContent = '';
  let chapterDivisions = splitDivisions;

  for (let i = splitDivisions.length - 1; i >= 0; i -= 1) {
    if (isConclusionSectionTitle(divisionTitle(splitDivisions[i]))) {
      conclusionsContent = promoteDivisionToChapter(splitDivisions[i]);
      chapterDivisions = splitDivisions.filter((_, idx) => idx !== i);
      break;
    }
  }

  if (!conclusionsContent) {
    conclusionsContent = FALLBACK_CONCLUSIONS;
  }

  if (chapterDivisions.length === 0) {
    const fallbackBody = cleanFrontMatter(body);
    if (fallbackBody) {
      chapterDivisions = [fallbackBody];
    }
  }

  const chapterFiles = chapterDivisions
    .map((content) => promoteDivisionToChapter(content))
    .filter(Boolean)
    .map((content, index) => ({
      path: `Chapters/${index}-.tex`,
      content: ensureTrailingNewline(content),
    }));

  const effectiveChapterFiles = chapterFiles.length > 0
    ? chapterFiles
    : [{ path: 'Chapters/0-.tex', content: '% No chapter content generated.\n' }];

  const chapterInputs = effectiveChapterFiles
    .map((file) => file.path.replace(/\.tex$/, ''))
    .map((pathNoExt) => `\\input{${pathNoExt}}`);

  const firstPages = buildFirstPages(extractedTitle, extractedAuthor, extractedDate, frontMatterContent);
  const citationKeys = extractCitationKeys([frontMatterContent, ...effectiveChapterFiles.map((f) => f.content), conclusionsContent].join('\n'));
  const referencesBib = buildReferencesBib(citationKeys);

  const mainTex = [
    '\\documentclass[a4paper,12pt,roman]{report}',
    '\\input{packages.tex}',
    '',
    `\\title{${extractedTitle}}`,
    `\\author{${extractedAuthor}}`,
    `\\date{${extractedDate}}`,
    '',
    '\\begin{document}',
    '\\justifying',
    '\\setlength{\\parindent}{0cm}',
    '\\input{Chapters/first-pages.tex}',
    ...chapterInputs,
    '\\input{Chapters/Conclusions.tex}',
    '\\nocite{*}',
    '\\bibliographystyle{plainnat}',
    '\\bibliography{references}',
    '\\end{document}',
  ].join('\n');

  return [
    { path: 'main.tex', content: ensureTrailingNewline(mainTex) },
    { path: 'packages.tex', content: ensureTrailingNewline(packagesContent) },
    { path: 'references.bib', content: ensureTrailingNewline(referencesBib) },
    { path: 'Chapters/first-pages.tex', content: ensureTrailingNewline(firstPages) },
    ...effectiveChapterFiles,
    { path: 'Chapters/Conclusions.tex', content: ensureTrailingNewline(conclusionsContent) },
    { path: 'Figures/.keep', content: '' },
  ];
}
