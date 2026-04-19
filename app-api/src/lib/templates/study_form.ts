import { TemplateDefinition } from './types';

export const studyForm: TemplateDefinition = {
  id: 'study_form',
  displayName: '3-Column Portrait',
  description: 'A4 portrait with 3 compact columns for mechanics/physics cheat sheets with clean sections, formulas, and short bullet lists.',
  isPro: false,

  preamble: `\\documentclass[10pt,a4paper]{article}

% ------------------------------------------------
% PACKAGES
% ------------------------------------------------
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[english]{babel}
\\usepackage{lmodern}
\\usepackage{amsmath, amssymb, mathtools}
\\usepackage{multicol}
\\usepackage{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{microtype}
\\usepackage{xcolor}
\\usepackage{ragged2e}
\\usepackage{lastpage}

% ------------------------------------------------
% PAGE SETUP
% ------------------------------------------------
\\geometry{
    a4paper,
    top=0.9cm,
    bottom=1.0cm,
    left=0.8cm,
    right=0.8cm
}

\\setlength{\\columnsep}{0.45cm}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.12em}

% ------------------------------------------------
% SECTION FORMATTING
% ------------------------------------------------
\\titleformat{\\section}
  {\\normalfont\\normalsize\\bfseries}
  {\\thesection.}{0.35em}{}
  [\\vspace{0.12em}\\titlerule]

\\titleformat{\\subsection}
  {\\normalfont\\small\\bfseries}
  {\\thesubsection}{0.35em}{}

\\titlespacing*{\\section}{0pt}{0.55em}{0.22em}
\\titlespacing*{\\subsection}{0pt}{0.32em}{0.10em}

% ------------------------------------------------
% LISTS
% ------------------------------------------------
\\setlist[itemize]{
    leftmargin=1.05em,
    itemsep=0.08em,
    topsep=0.08em,
    parsep=0em,
    partopsep=0em
}

% ------------------------------------------------
% DISPLAY MATH SPACING
% ------------------------------------------------
\\setlength{\\abovedisplayskip}{4pt}
\\setlength{\\belowdisplayskip}{4pt}
\\setlength{\\abovedisplayshortskip}{2pt}
\\setlength{\\belowdisplayshortskip}{2pt}

% ------------------------------------------------
% CUSTOM COMMANDS
% ------------------------------------------------
\\newcommand{\\defn}[1]{\\textbf{Definition:} #1}
\\newcommand{\\units}[1]{\\textbf{Units:} #1}
\\newcommand{\\nature}[1]{\\textbf{Nature:} #1}
\\newcommand{\\formula}[1]{\\[
#1
\\]}
\\newcommand{\\important}[1]{\\textbf{#1}}
\\newcommand{\\trick}[1]{\\textbf{Trick:} #1}
\\newcommand{\\condition}[1]{\\textbf{Condition:} #1}`,

  styleGuide: `You are generating a 3-COLUMN PORTRAIT mechanics/physics cheat sheet.

LAYOUT RULES:
- Keep this exact document style (no custom boxes from other templates).
- Start document body with:
  \\footnotesize
  \\begin{center}
      {\\Large \\textbf{Topic Cheat Sheet}}
  \\end{center}
  \\vspace{-0.4em}
  \\begin{multicols}{3}
  \\raggedcolumns
  \\justifying
- Use \\section{} for major blocks and \\subsection{} for sub-blocks.
- Use compact itemize lists and short display equations.
- No page numbers.

CONTENT RULES:
- Prioritize formulas, definitions, conditions, and quick tricks.
- Keep each bullet short and scan-friendly.
- Avoid long derivations and long prose paragraphs.
- Use helpers when useful: \\defn, \\units, \\nature, \\formula, \\important, \\trick, \\condition.
- Fill all 3 columns with dense but readable content.
- End with \\end{multicols}.`,

  structureTemplate: `\\begin{document}
\\footnotesize

\\begin{center}
    {\\Large \\textbf{% FILL: Topic Cheat Sheet}}
\\end{center}

\\vspace{-0.4em}

\\begin{multicols}{3}
\\raggedcolumns
\\justifying

\\section{% FILL: Section 1}
\\begin{itemize}
    \\item \\defn{% FILL}
    \\item \\important{% FILL}
    \\formula{% FILL equation}
    \\item \\trick{% FILL}
    \\item \\units{% FILL}
    \\item \\nature{% FILL}
\\end{itemize}

\\section{% FILL: Section 2}
\\subsection{% FILL: Subsection}
\\begin{itemize}
    \\item % FILL short bullet
    \\item % FILL short bullet
    \\formula{% FILL equation}
\\end{itemize}

\\section{% FILL: Section 3}
% FILL: Continue compact sections/subsections until all 3 columns are used.

\\end{multicols}
\\end{document}`,

  structureExample: `\\begin{document}
\\footnotesize

\\begin{center}
    {\\Large \\textbf{Mechanics Cheat Sheet}}
\\end{center}

\\vspace{-0.4em}

\\begin{multicols}{3}
\\raggedcolumns
\\justifying

\\section{Work}
\\begin{itemize}
    \\item \\defn{Work done by force $\\vec{F}$ along displacement $\\vec{d}$.}
    \\item \\important{Constant force:} $W = \\vec{F}\\cdot\\vec{d} = Fd\\cos\\theta$.
    \\item \\important{Variable force:}
    \\formula{W = \\int_{x_i}^{x_f} F(x)\\,dx}
    \\item \\trick{Area under the $F$-$x$ graph equals work.}
    \\item \\units{Joule (J).}
    \\item \\nature{Scalar quantity.}
\\end{itemize}

\\section{Energy}
\\subsection{Kinetic Energy}
\\begin{itemize}
    \\item \\formula{K = \\frac{1}{2}mv^2}
    \\item \\formula{K = \\frac{p^2}{2m}}
\\end{itemize}

\\subsection{Potential Energy}
\\begin{itemize}
    \\item Defined for conservative forces.
    \\item \\formula{F_x = -\\frac{dU}{dx}}
    \\item \\formula{U_g = mgh, \\quad U_s = \\frac{1}{2}kx^2}
\\end{itemize}

\\section{Power}
\\begin{itemize}
    \\item \\formula{P_{\\text{avg}} = \\frac{\\Delta W}{\\Delta t}}
    \\item \\formula{P = \\frac{dW}{dt} = \\vec{F}\\cdot\\vec{v}}
\\end{itemize}

\\section{Collisions}
\\begin{itemize}
    \\item Momentum conserved in isolated systems.
    \\item \\formula{m_1\\vec{v}_{1i} + m_2\\vec{v}_{2i} = m_1\\vec{v}_{1f} + m_2\\vec{v}_{2f}}
    \\item \\important{Elastic:} momentum and kinetic energy conserved.
    \\item \\important{Perfectly inelastic:} bodies stick together.
\\end{itemize}

\\end{multicols}
\\end{document}`,
};
