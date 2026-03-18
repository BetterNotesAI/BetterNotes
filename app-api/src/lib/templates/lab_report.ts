import { TemplateDefinition } from './types';

export const labReport: TemplateDefinition = {
  id: 'lab_report',
  displayName: 'Lab Report',
  description: 'Technical laboratory report with sections for introduction, experimental setup, data tables with uncertainties, error analysis, and conclusion.',
  isPro: true,

  preamble: `\\documentclass[11pt]{article}
\\usepackage[english]{babel}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{geometry}
\\geometry{a4paper,left=25mm,right=25mm,top=25mm,bottom=25mm}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{float}
\\usepackage{booktabs}
\\usepackage{array}
\\usepackage{multirow}
\\usepackage{siunitx}
\\sisetup{separate-uncertainty=true}
\\usepackage{xcolor}
\\usepackage{hyperref}
\\hypersetup{colorlinks=true,linkcolor=blue,urlcolor=blue}
\\usepackage{titlesec}
\\titleformat{\\section}{\\large\\bfseries}{\\thesection.}{0.5em}{}
\\titleformat{\\subsection}{\\bfseries}{\\thesubsection.}{0.5em}{}
\\setlength{\\parindent}{1em}
\\setlength{\\parskip}{3pt}
\\newcommand{\\mean}[1]{\\ensuremath{\\bar{#1}}}
\\newcommand{\\uncertainty}[2]{\\ensuremath{(#1 \\pm #2)}}`,

  styleGuide: `You are generating a TECHNICAL LAB REPORT for an experimental science or engineering course.

STRUCTURE (in order):
1. \\title{...} \\author{...} \\date{...} \\maketitle
2. \\begin{abstract} — brief summary of experiment, method, and key results (with numbers and units) \\end{abstract}
3. \\section{Introduction} — purpose, physical background, key equations
4. \\section{Experimental Setup} — apparatus, procedure description, diagram description
5. \\section{Data and Results} — tables of measurements, computed values, error analysis
6. \\section{Error Analysis} — systematic vs random errors, propagation of uncertainty formulas
7. \\section{Discussion} — comparison with theory, sources of error
8. \\section{Conclusion} — key findings with numerical results

CONTENT RULES:
- Use siunitx: \\SI{value}{unit} for all measurements
- Use booktabs for data tables (\\toprule, \\midrule, \\bottomrule)
- Include realistic experimental data with uncertainties: \\uncertainty{x}{\\delta x}
- Include error propagation formulas with partial derivatives
- Be specific: use real physics/chemistry equations relevant to the experiment
- NEVER use \\includegraphics — no image files are available. Describe apparatus in text instead.
- CRITICAL: For siunitx, \\SI requires BOTH a number AND a unit: \\SI{9.81}{m/s^2}, \\SI{6.02e-19}{J}. To typeset a unit alone (no number), use \\si{m/s^2}. NEVER use \\SI with only one argument. NEVER use \\SI{a \\times 10^{n}}{unit} — use e-notation: \\SI{6.02e-19}{J}.
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureTemplate: `\\begin{document}
% FILL: \\title{Experiment Title}
% FILL: \\author{Student Name \\\\ Lab Partner: Name \\\\ Date: \\today}
\\maketitle

\\begin{abstract}
% FILL: Brief description of the experiment, key method, and main numerical result with uncertainty and units
\\end{abstract}

\\section{Introduction}
% FILL: Physical motivation and objective of the experiment
% FILL: Theoretical background — key physics equation(s) used
% FILL: Expected result or hypothesis

\\section{Experimental Setup}
% FILL: List of apparatus (no \\includegraphics, describe in text)
% FILL: Step-by-step procedure summary
% FILL: Key variables measured and their instruments (with precision)

\\section{Data and Results}
% FILL: \\begin{table}[H] with booktabs — columns: trial, measured quantity, computed quantity
% FILL: Use \\SI{value}{unit} for all numbers with units
% FILL: Report mean and standard deviation of repeated measurements

\\section{Error Analysis}
% FILL: Identify systematic and random error sources
% FILL: Error propagation formula using partial derivatives
% FILL: Final result with combined uncertainty: \\uncertainty{value}{uncertainty} \\si{unit}

\\section{Discussion}
% FILL: Compare measured result with theoretical/literature value
% FILL: Percentage error calculation
% FILL: Discuss dominant sources of error and how to reduce them

\\section{Conclusion}
% FILL: State the main result with units and uncertainty
% FILL: Comment on agreement with expected value

\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
\\title{Measurement of the Gravitational Acceleration using a Simple Pendulum}
\\author{Student Name \\\\ Lab Partner: Name}
\\date{\\today}
\\maketitle

\\begin{abstract}
We measured $g$ using a simple pendulum of length $L = \\SI{1.000}{m}$. From 50 oscillations we obtain $g = \\SI{9.81 \\pm 0.05}{m/s^2}$, consistent with the standard value.
\\end{abstract}

\\section{Introduction}
The period of a simple pendulum is $T = 2\\pi\\sqrt{L/g}$, giving $g = 4\\pi^2 L/T^2$.

\\section{Data and Results}
\\begin{table}[H]
\\centering
\\begin{tabular}{ccc}
\\toprule
Trial & $t_{50}$ (s) & $T$ (s) \\\\
\\midrule
1 & 100.2 & 2.004 \\\\
2 & 100.5 & 2.010 \\\\
\\bottomrule
\\end{tabular}
\\caption{Measured oscillation times.}
\\end{table}

\\section{Error Analysis}
$\\delta g = g\\sqrt{\\left(\\frac{\\delta L}{L}\\right)^2 + \\left(\\frac{2\\delta T}{T}\\right)^2}$

\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};
