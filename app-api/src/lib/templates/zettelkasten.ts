import { TemplateDefinition } from './types';

export const zettelkasten: TemplateDefinition = {
  id: 'zettelkasten',
  displayName: 'Zettelkasten Cards',
  description: 'Knowledge cards in Zettelkasten style — each card is a self-contained atomic concept with cross-references and tags.',
  isPro: false,

  preamble: `\\documentclass[10pt]{article}
\\usepackage[english]{babel}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{lmodern}
\\usepackage{xcolor}
\\usepackage{geometry}
\\geometry{a4paper,portrait,margin=8mm}
\\usepackage{tcolorbox}
\\tcbuselibrary{raster,skins}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.2em}
\\definecolor{cardblue}{RGB}{0,80,158}
\\definecolor{linkpurple}{RGB}{120,50,150}
\\definecolor{taggreen}{RGB}{0,120,60}
\\pagenumbering{gobble}
\\tcbset{
  zettelstyle/.style={
    enhanced,sharp corners,
    colback=white,colframe=cardblue,boxrule=0.8pt,
    fonttitle=\\bfseries\\small,coltitle=white,colbacktitle=cardblue,
    attach boxed title to top left={xshift=3mm,yshift=-2mm},
    boxed title style={sharp corners,colframe=cardblue},
    top=5mm,bottom=2mm,left=2mm,right=2mm,
  }
}
\\newcommand{\\conn}[1]{\\textcolor{linkpurple}{\\small $\\rightarrow$ \\textit{#1}}}
\\newcommand{\\tags}[1]{\\par\\vfill\\textcolor{taggreen}{\\scriptsize\\ttfamily #1}}`,

  styleGuide: `You are generating a ZETTELKASTEN KNOWLEDGE CARD document.

LAYOUT RULES:
- Start with: {\\Large\\bfseries\\color{cardblue} SUBJECT --- Zettelkasten Cards \\hfill \\normalsize Knowledge Atoms}
- Then: \\vspace{3mm}\\hrule\\vspace{5mm}
- Each PAGE holds a 2×3 grid of 6 cards using tcbitemize with raster
- Use: \\begin{tcbitemize}[raster columns=2, raster rows=3, raster height=0.92\\textheight, raster equal height=rows, raster column skip=4mm, raster row skip=4mm]

CONTENT RULES:
- Each card: \\tcbitem[zettelstyle, title={\\texttt{ID} --- Title}] — use exactly ONE closing brace } then ] to close the option. NEVER write }} at the end.
- Card IDs use format: TOPIC-01, TOPIC-02, etc.
- Card content: \\footnotesize text, key concept, formula, or definition
- Use \\conn{Related Card ID} for cross-references between cards
- Use \\tags{\\#tag1 \\#tag2 \\#tag3} at the bottom of each card (IMPORTANT: use \\# not bare #)
- Close each page with \\end{tcbitemize} before starting new page
- Generate at least 6 cards (1 full page). 12 cards = 2 pages.
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureTemplate: `\\begin{document}
% FILL: Header: {\\Large\\bfseries\\color{cardblue} SUBJECT --- Zettelkasten Cards \\hfill \\normalsize Knowledge Atoms}
\\vspace{3mm}\\hrule\\vspace{5mm}

\\begin{tcbitemize}[
  raster columns=2, raster rows=3,
  raster height=0.92\\textheight,
  raster equal height=rows,
  raster column skip=4mm, raster row skip=4mm,
]

% FILL: Card 1 — \\tcbitem[zettelstyle, title={\\texttt{TOPIC-01} --- Concept Name}]
% FILL: \\footnotesize definition or explanation of the atomic concept
% FILL: Include a key formula with display math if relevant
% FILL: \\conn{TOPIC-02 Related} at the end
% FILL: \\tags{\\#tag1 \\#tag2}

% FILL: Card 2 — \\tcbitem[zettelstyle, title={\\texttt{TOPIC-02} --- Next Concept}]
% FILL: Content for card 2

% FILL: Cards 3-6 (fill the rest of the first page, 6 cards total per \\begin{tcbitemize})

\\end{tcbitemize}

% FILL: If more than 6 cards needed, add another \\begin{tcbitemize}[...] block for the second page
% FILL: Aim for 6-12 cards total covering the requested topic

\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
{\\Large\\bfseries\\color{cardblue} Graph Theory --- Zettelkasten Cards \\hfill \\normalsize Knowledge Atoms}
\\vspace{3mm}\\hrule\\vspace{5mm}

\\begin{tcbitemize}[
  raster columns=2, raster rows=3,
  raster height=0.92\\textheight,
  raster equal height=rows,
  raster column skip=4mm, raster row skip=4mm,
]

\\tcbitem[zettelstyle, title={\\texttt{GT-01} --- Graph Definition}]
\\footnotesize
A \\textbf{graph} $G = (V, E)$ consists of a set of vertices $V$ and edges $E \\subseteq V \\times V$.
\\begin{itemize}
  \\item \\textbf{Directed}: edges have direction
  \\item \\textbf{Undirected}: edges are symmetric
\\end{itemize}
\\conn{GT-02 Degree} \\conn{GT-03 Paths}
\\tags{\\#graph \\#definition \\#combinatorics}

\\tcbitem[zettelstyle, title={\\texttt{GT-02} --- Vertex Degree}]
\\footnotesize
The \\textbf{degree} $\\deg(v)$ = number of edges incident to $v$.
\\[ \\sum_{v \\in V} \\deg(v) = 2|E| \\]
\\conn{GT-01 Graph} \\conn{GT-04 Trees}
\\tags{\\#degree \\#handshaking \\#graph}

\\end{tcbitemize}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};
