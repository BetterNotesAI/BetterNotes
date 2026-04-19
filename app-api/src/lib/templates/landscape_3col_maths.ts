import { TemplateDefinition } from './types';

export const landscape3colMaths: TemplateDefinition = {
  id: 'landscape_3col_maths',
  displayName: 'Compact 3 Columns Landscape',
  description: 'A4 landscape with 3 columns — ideal for dense math reference sheets and formula summaries.',
  isPro: false,

  preamble: `\\documentclass[10pt]{article}
\\usepackage[english]{babel}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{enumitem}
\\usepackage{booktabs}
\\usepackage{amsmath,amsthm,empheq,amssymb,amsfonts,mathrsfs}
\\usepackage{lmodern}
\\usepackage{xcolor}
\\usepackage{geometry}
\\geometry{a4paper,landscape,left=5mm,right=5mm,top=5mm,bottom=5mm}
\\usepackage{multicol}
\\setlength{\\columnseprule}{0.5pt}
\\setlength{\\columnsep}{0.5cm}
\\usepackage{titlesec}
\\titlespacing{\\section}{0pt}{2pt}{0pt}
\\titlespacing{\\subsection}{0pt}{2pt}{0pt}
\\titlespacing{\\subsubsection}{0pt}{2pt}{0pt}
\\titleformat*{\\section}{\\large\\bfseries}
\\titleformat*{\\subsection}{\\bfseries}
\\setlength{\\parindent}{0pt}
\\pagenumbering{gobble}
\\renewcommand{\\baselinestretch}{1.2}
\\linespread{0.925}
\\setlist[itemize]{noitemsep,topsep=0pt,leftmargin=*}
\\setlist[enumerate]{noitemsep,topsep=0pt,leftmargin=*}
\\definecolor{green2}{RGB}{61,176,0}
\\newtheoremstyle{normal}{0pt}{0pt}{\\upshape}{}{\\bfseries}{}{ }{}
\\theoremstyle{normal}
\\newtheorem*{definition}{\\textcolor{green2}{Def.}}
\\newtheorem*{proposition}{\\textcolor{blue}{Prop.}}
\\newtheorem*{theorem}{\\textcolor{red}{Thm.}}
\\newtheorem*{obs}{\\textcolor{cyan}{Obs.}}
\\newtheorem*{example*}{Example}
\\newtheorem*{exercise*}{Exercise}
\\newcommand{\\dd}{\\mathrm{d}}
\\newcommand{\\real}{\\mathbb{R}}
\\newcommand{\\cplex}{\\mathbb{C}}`,

  styleGuide: `You are generating a 3-COLUMN LANDSCAPE A4 math formula/summary sheet.

LAYOUT RULES:
- Wrap ALL content in \\begin{multicols*}{3} ... \\end{multicols*}
- Use \\section*{Topic Name} for major sections
- Use \\subsection*{Subtopic} for subsections
- No page numbers (pagenumbering{gobble} is set)
- Very compact: minimal vertical space, no blank lines between items

CONTENT RULES:
- Use the theorem environments defined in the preamble: definition, proposition, theorem, obs, example*, exercise*
- DO NOT redefine these environments
- Use amsmath for equations: align*, equation*, etc.
- Keep each entry brief — this is a reference sheet, not an explanation
- Pack as much useful content as possible
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureTemplate: `\\begin{document}
\\begin{multicols*}{3}

% FILL: First major section header using \\section*{Topic Name}
% FILL: 3-5 key definitions, theorems, or formulas for this section using the theorem environments (definition, theorem, proposition, obs)
% FILL: Use \\begin{itemize} for lists of formulas or properties

% FILL: Second major section header using \\section*{Topic Name}
% FILL: Key theorems and results with brief proofs or statements
% FILL: Display math with align* or equation* for important equations

% FILL: Third major section (and more as needed, filling all 3 columns)
% FILL: Use \\subsection*{Subtopic} to break large sections
% FILL: Include worked example using example* environment if helpful

% FILL: Continue with 3-6 more sections covering the requested topic thoroughly
% FILL: Pack content densely — every line should convey information

\\end{multicols*}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
\\begin{multicols*}{3}

\\section*{Derivatives}

\\begin{definition}
$f'(x) = \\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}$
\\end{definition}

\\begin{theorem}[Chain Rule]
$(f\\circ g)'(x) = f'(g(x))\\cdot g'(x)$
\\end{theorem}

\\begin{obs}
Product rule: $(fg)' = f'g + fg'$
\\end{obs}

\\subsection*{Common Derivatives}
\\begin{itemize}
  \\item $(x^n)' = nx^{n-1}$
  \\item $(\\sin x)' = \\cos x$
  \\item $(e^x)' = e^x$
\\end{itemize}

\\end{multicols*}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};
