import { TemplateDefinition } from './types';

export const problemSolving: TemplateDefinition = {
  id: 'problem_solving',
  displayName: 'Problem Solving Worksheet',
  description: 'STEM problem set with structured problem/given/solution blocks and boxed answers. Great for physics, engineering, and maths practice.',
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
\\geometry{a4paper,portrait,left=8mm,right=8mm,top=8mm,bottom=8mm}
\\usepackage{multicol}
\\setlength{\\columnseprule}{0.5pt}
\\setlength{\\columnsep}{0.5cm}
\\usepackage{titlesec}
\\titlespacing{\\section}{0pt}{2pt}{0pt}
\\titlespacing{\\subsection}{0pt}{2pt}{0pt}
\\titleformat*{\\section}{\\large\\bfseries}
\\titleformat*{\\subsection}{\\bfseries}
\\setlength{\\parindent}{0pt}
\\pagenumbering{gobble}
\\definecolor{probblue}{RGB}{0,80,158}
\\definecolor{datagreen}{RGB}{0,128,64}
\\definecolor{resultred}{RGB}{180,0,0}
\\definecolor{checkpurple}{RGB}{100,50,150}
\\newtheoremstyle{problemstyle}{0pt}{0pt}{\\upshape}{}{\\bfseries}{}{0.5em}{}
\\theoremstyle{problemstyle}
\\newtheorem*{problem}{\\textcolor{probblue}{Problem}}
\\newtheorem*{givendata}{\\textcolor{datagreen}{Given}}
\\newtheorem*{approach}{\\textcolor{probblue}{Approach}}
\\newtheorem*{solution}{\\textcolor{probblue}{Solution}}
\\newcommand{\\result}[1]{%
\\begin{center}
\\fcolorbox{resultred}{red!5}{\\parbox{0.9\\linewidth}{\\centering\\textbf{\\textcolor{resultred}{Result:}} #1}}
\\end{center}
}
\\newcommand{\\verify}[1]{\\textcolor{checkpurple}{\\textbf{Check:} \\textit{#1}}}
\\newcommand{\\HR}{\\vspace{0.15em}\\hrule\\vspace{0.25em}}
\\setlist[itemize]{leftmargin=1.1em,itemsep=0.1em,topsep=0.1em}
\\setlist[enumerate]{leftmargin=1.1em,itemsep=0.1em,topsep=0.1em}
\\sloppy
\\emergencystretch=2em`,

  styleGuide: `You are generating a PROBLEM SOLVING WORKSHEET for STEM subjects (engineering, physics, maths).

LAYOUT RULES:
- Start with: {\\Large\\bfseries SUBJECT --- Problem Set \\hfill \\normalsize Practice Sheet}\\HR
- Wrap content in \\begin{multicols}{2} \\footnotesize ... \\end{multicols}
- Each problem is a self-contained block separated by \\HR

CONTENT RULES:
- Structure each problem using the environments: problem, givendata, approach, solution
- Use \\result{boxed answer} to highlight the final answer
- Use \\verify{dimensional check or sanity check} after each solution
- Include realistic numerical values, units, and physical context
- Use amsmath for all equations
- Generate 4-8 problems of varying difficulty
- CRITICAL: Always close \\[ ... \\] or align* BEFORE \\end{solution}, \\end{givendata}, \\end{approach}, \\end{problem}. NEVER leave display math open when ending an environment.
- CRITICAL: NEVER nest display math environments. Use EITHER \\[ ... \\] OR \\begin{equation*}...\\end{equation*}, never one inside the other.
- CRITICAL: Output the FULL document including the REQUIRED PREAMBLE above. Start with \\documentclass, not \\begin{document}.
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureTemplate: `\\begin{document}
\\pagestyle{empty}
% FILL: Title line: {\\Large\\bfseries SUBJECT --- Problem Set \\hfill \\normalsize Practice Sheet}\\HR

\\begin{multicols}{2}
\\footnotesize

% FILL: Problem 1 — use \\begin{problem} ... \\end{problem} with a clear problem statement
% FILL: \\begin{givendata} list the known values with units \\end{givendata}
% FILL: \\begin{solution} step-by-step derivation ending with the answer \\end{solution}
% FILL: \\result{Final numerical answer with units}
% FILL: \\verify{Dimensional check}

\\HR

% FILL: Problem 2 — different concept or difficulty level
% FILL: Follow same structure: problem, givendata, solution, result, verify

\\HR

% FILL: Problem 3
% FILL: Problem 4
% FILL: Problem 5 (continue to fill both columns — 4 to 8 problems total)

\\end{multicols}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
\\pagestyle{empty}
{\\Large\\bfseries Thermodynamics --- Problem Set \\hfill \\normalsize Practice Sheet}\\HR

\\begin{multicols}{2}
\\footnotesize

\\begin{problem}
An ideal gas undergoes isothermal expansion from $V_1 = 2\\,\\mathrm{L}$ to $V_2 = 6\\,\\mathrm{L}$ at $T = 300\\,\\mathrm{K}$. Find the work done ($n = 1\\,\\mathrm{mol}$).
\\end{problem}

\\begin{givendata}
$V_1 = 2\\,\\mathrm{L}$, $V_2 = 6\\,\\mathrm{L}$, $T = 300\\,\\mathrm{K}$, $n = 1\\,\\mathrm{mol}$
\\end{givendata}

\\begin{solution}
$W = nRT\\ln(V_2/V_1) = (1)(8.314)(300)\\ln(3) \\approx 2740\\,\\mathrm{J}$
\\end{solution}

\\result{$W \\approx 2.74\\,\\mathrm{kJ}$}
\\verify{Units: $\\mathrm{mol\\cdot J/(mol\\cdot K)\\cdot K} = \\mathrm{J}$ \\checkmark}

\\HR

\\end{multicols}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};
