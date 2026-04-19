import { TemplateDefinition } from './types';

export const clean3colsLandscape: TemplateDefinition = {
  id: 'clean_3cols_landscape',
  displayName: 'Clean 3 Columns Landscape',
  description: 'A4 landscape with 3 clean columns, section strips, balanced spacing, and a readable cheatsheet style.',
  isPro: false,

  preamble: `\\documentclass[8pt,landscape,a4paper]{extarticle}
\\usepackage[landscape,margin=0.35in]{geometry}
\\usepackage{multicol}
\\usepackage{amsmath,amssymb}
\\usepackage{xcolor}
\\usepackage{graphicx}
\\usepackage{enumitem}
\\usepackage{listings}
\\usepackage[hidelinks]{hyperref}
\\usepackage{array}
\\usepackage{booktabs}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\definecolor{headerblue}{RGB}{30,76,124}
\\definecolor{boxgray}{RGB}{235,235,240}
\\definecolor{rulegray}{RGB}{200,200,205}
\\definecolor{codebg}{RGB}{246,246,248}
\\definecolor{codekw}{RGB}{30,76,124}
\\definecolor{codecom}{RGB}{100,120,100}
\\definecolor{codestr}{RGB}{163,21,21}
\\newcommand{\\cheatsection}[1]{%
  \\vspace{6pt}%
  \\noindent\\colorbox{headerblue}{%
    \\parbox[c][1.05em][c]{\\dimexpr\\linewidth-2\\fboxsep\\relax}{%
      \\color{white}\\bfseries\\ #1%
    }%
  }\\par\\vspace{3pt}%
}
\\newcommand{\\cheatsub}[1]{%
  \\vspace{3pt}%
  {\\color{headerblue}\\bfseries #1}\\par\\vspace{1pt}%
}
\\setlist[itemize]{nosep,leftmargin=1.1em,label=\\textcolor{headerblue}{\\textbullet}}
\\setlist[enumerate]{nosep,leftmargin=1.4em}
\\lstset{
  basicstyle=\\ttfamily\\scriptsize,
  keywordstyle=\\color{codekw}\\bfseries,
  commentstyle=\\color{codecom}\\itshape,
  stringstyle=\\color{codestr},
  backgroundcolor=\\color{codebg},
  frame=none,
  breaklines=true,
  showstringspaces=false,
  columns=fullflexible,
  xleftmargin=3pt,
  xrightmargin=3pt,
  aboveskip=3pt,
  belowskip=3pt
}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{2pt}
\\setlength{\\columnsep}{14pt}
\\setlength{\\columnseprule}{0.2pt}
\\renewcommand{\\columnseprulecolor}{\\color{rulegray}}
\\setlength{\\tabcolsep}{4pt}
\\renewcommand{\\arraystretch}{1.05}
\\pagestyle{empty}
\\newcommand{\\kbd}[1]{\\colorbox{boxgray}{\\texttt{\\small #1}}}`,

  styleGuide: `You are generating a CLEAN 3-COLUMN LANDSCAPE cheatsheet.

LAYOUT RULES:
- Start with a full-width title strip in headerblue (already defined in preamble)
- Wrap all content in \\begin{multicols}{3} ... \\end{multicols}
- Use \\cheatsection{...} for major sections
- Use \\cheatsub{...} for subsections
- Keep spacing balanced and readable (not extremely dense)

CONTENT RULES:
- Prefer short bullets, concise formulas, and compact tables
- Use display equations only for key expressions
- You may include short code snippets with lstlisting when relevant
- Keep each section self-contained and scan-friendly
- End with: \\begin{flushright}\\tiny\\textit{Generated with BetterNotes}\\end{flushright}`,

  structureTemplate: `\\begin{document}
\\noindent\\colorbox{headerblue}{%
  \\parbox{\\dimexpr\\textwidth-2\\fboxsep\\relax}{%
    \\vspace{3pt}
    \\centering{\\Large\\bfseries\\color{white} % FILL: Cheatsheet title}\\\\[1pt]
    {\\small\\color{white!85} % FILL: subtitle}
    \\vspace{3pt}
  }%
}
\\vspace{4pt}

\\begin{multicols}{3}

% FILL: \\cheatsection{Topic 1}
% FILL: key bullets / formulas / tiny table

% FILL: \\cheatsection{Topic 2}
% FILL: optional \\cheatsub{Subtopic}

% FILL: Continue with 6-10 concise sections total

\\end{multicols}
\\begin{flushright}\\tiny\\textit{Generated with BetterNotes}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
\\noindent\\colorbox{headerblue}{%
  \\parbox{\\dimexpr\\textwidth-2\\fboxsep\\relax}{%
    \\vspace{3pt}
    \\centering{\\Large\\bfseries\\color{white} Calculus Quick Review}\\\\[1pt]
    {\\small\\color{white!85} Derivatives, integrals, and limits}
    \\vspace{3pt}
  }%
}
\\vspace{4pt}

\\begin{multicols}{3}
\\cheatsection{Derivatives}
\\begin{itemize}
  \\item $(x^n)' = nx^{n-1}$
  \\item $(\\sin x)' = \\cos x$
  \\item $(e^x)' = e^x$
\\end{itemize}
\\cheatsub{Chain Rule}
$(f\\circ g)'(x)=f'(g(x))g'(x)$

\\cheatsection{Integrals}
\\begin{itemize}
  \\item $\\int x^n\\,dx=\\frac{x^{n+1}}{n+1}+C$
  \\item $\\int \\frac{1}{x}\\,dx=\\ln|x|+C$
\\end{itemize}
\\end{multicols}
\\begin{flushright}\\tiny\\textit{Generated with BetterNotes}\\end{flushright}
\\end{document}`,
};

