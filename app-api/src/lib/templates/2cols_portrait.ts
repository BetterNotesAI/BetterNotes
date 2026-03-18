import { TemplateDefinition } from './types';

export const twocolsPortrait: TemplateDefinition = {
  id: '2cols_portrait',
  displayName: '2-Column Cheat Sheet',
  description: 'A4 portrait with 2 columns — perfect for compact cheat sheets with formulas, definitions, and key results.',
  isPro: false,

  preamble: `\\documentclass[10pt]{article}
\\usepackage[margin=0.45in]{geometry}
\\usepackage{amsmath,amssymb}
\\usepackage{lmodern}
\\usepackage{microtype}
\\usepackage{multicol}
\\usepackage{enumitem}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.15em}
\\setlength{\\columnsep}{0.35cm}
\\setlength{\\abovedisplayskip}{0.25em}
\\setlength{\\belowdisplayskip}{0.25em}
\\setlength{\\abovedisplayshortskip}{0.15em}
\\setlength{\\belowdisplayshortskip}{0.15em}
\\setlist[itemize]{leftmargin=1.1em,itemsep=0.1em,topsep=0.1em}
\\setlist[enumerate]{leftmargin=1.1em,itemsep=0.1em,topsep=0.1em}
\\newcommand{\\HR}{\\vspace{0.15em}\\hrule\\vspace{0.25em}}
\\newlength{\\MyBoxW}
\\newcommand{\\MyBox}[1]{%
\\setlength{\\fboxsep}{2.5pt}%
\\setlength{\\MyBoxW}{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule\\relax}%
\\noindent\\fbox{\\begin{minipage}[t]{\\MyBoxW}\\raggedright #1\\end{minipage}}%
}
\\sloppy
\\emergencystretch=2em`,

  styleGuide: `You are generating a 2-COLUMN PORTRAIT cheat-sheet (physics, maths, or any technical subject).

LAYOUT RULES:
- Start with a bold title line: {\\Large\\bfseries SUBJECT --- TOPIC \\hfill \\normalsize Cheat-Sheet (2 cols)}\\HR
- Wrap ALL content in \\begin{multicols}{2} \\footnotesize ... \\end{multicols}
- Use \\HR (thin horizontal rule) between major sections
- Use \\textbf{Section Title:} at the start of each section (no \\section command)

CONTENT RULES:
- Use \\MyBox{...} to highlight key formulas, results, and important definitions
- Keep text \\footnotesize throughout
- Equations inline or as short display math — no wide multi-line derivations
- Pack as much content as possible
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureTemplate: `\\begin{document}
\\pagestyle{empty}
% FILL: Bold title line using {\\Large\\bfseries SUBJECT --- TOPIC \\hfill \\normalsize Cheat-Sheet (2 cols)}\\HR

\\begin{multicols}{2}
\\footnotesize

% FILL: First major section header with \\textbf{Section Name:}
% FILL: Key formulas and definitions for this section

% FILL: Use \\HR between major sections

% FILL: Important formulas highlighted with \\MyBox{...}

% FILL: Second section with \\textbf{Section Name:}
% FILL: Key results and equations

\\HR

% FILL: Third section
% FILL: Use \\begin{itemize} for enumerable facts or properties

% FILL: Continue with 4-6 more sections filling both columns
% FILL: Each \\MyBox should contain the single most important formula of its section

\\end{multicols}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
\\pagestyle{empty}
{\\Large\\bfseries Classical Mechanics --- Cheat Sheet \\hfill \\normalsize Cheat-Sheet (2 cols)}\\HR

\\begin{multicols}{2}
\\footnotesize

\\textbf{Newton's Laws}\\\\
1st: $\\sum F = 0 \\Rightarrow a = 0$. \\quad 2nd: $F = ma$. \\quad 3rd: $F_{AB} = -F_{BA}$.

\\HR

\\MyBox{
\\textbf{Work-Energy Theorem}\\\\
$W_{net} = \\Delta KE = \\frac{1}{2}mv_f^2 - \\frac{1}{2}mv_i^2$
}

\\HR

\\textbf{Kinematics (constant a):}
\\begin{itemize}
  \\item $v = v_0 + at$
  \\item $x = x_0 + v_0 t + \\frac{1}{2}at^2$
\\end{itemize}

\\end{multicols}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};
