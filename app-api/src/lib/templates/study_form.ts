import { TemplateDefinition } from './types';

export const studyForm: TemplateDefinition = {
  id: 'study_form',
  displayName: 'Study Form (High Density)',
  description: 'A4 portrait with 3 very compact columns — formula boxes, constants tables, and property lists. Ideal for exam reference sheets in physics and maths.',
  isPro: false,

  preamble: `\\documentclass[9pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{lmodern}
\\usepackage{microtype}
\\usepackage{xcolor}
\\usepackage{geometry}
\\geometry{a4paper,portrait,left=4mm,right=4mm,top=4mm,bottom=4mm}
\\usepackage{multicol}
\\setlength{\\columnseprule}{0.4pt}
\\setlength{\\columnsep}{3mm}
\\usepackage{booktabs}
\\usepackage{array}
\\usepackage{enumitem}
\\setlist[itemize]{noitemsep,topsep=0pt,leftmargin=*,label=\\textbullet}
\\setlist[enumerate]{noitemsep,topsep=0pt,leftmargin=*}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\pagenumbering{gobble}
\\linespread{0.88}
\\definecolor{headblue}{RGB}{0,60,120}
\\definecolor{boxbg}{RGB}{240,245,255}
\\definecolor{tablehead}{RGB}{220,230,245}
\\newcommand{\\sectionbar}[1]{%
  {\\color{headblue}\\rule{\\linewidth}{0.6pt}}\\\\[-1pt]
  {\\footnotesize\\bfseries\\color{headblue} #1}\\\\[-2pt]
  {\\color{headblue}\\rule{\\linewidth}{0.3pt}}\\vspace{1pt}
}
\\newcommand{\\formulabox}[2]{%
  \\setlength{\\fboxsep}{1.5pt}%
  \\noindent\\colorbox{boxbg}{%
    \\parbox{\\dimexpr\\linewidth-3pt}{%
      \\scriptsize\\textbf{#1:}\\; $#2$%
    }%
  }\\vspace{1pt}%
}
\\newcommand{\\HR}{\\vspace{1pt}\\hrule\\vspace{2pt}}`,

  styleGuide: `You are generating a HIGH-DENSITY STUDY FORM for physics, maths, or engineering.

LAYOUT RULES:
- Start with a compact title: {\\small\\bfseries\\color{headblue} SUBJECT --- TOPIC \\hfill Study Form}\\HR
- Wrap ALL content in \\begin{multicols}{3} \\scriptsize ... \\end{multicols}
- Use \\sectionbar{Section Name} for each major topic (renders as a compact blue-bordered header)
- Use \\formulabox{Name}{formula} for individual formulas (renders with light blue background)
- Use tabular environments for constants tables: 2-column with {lp{2cm}} or similar

CONTENT RULES:
- Keep everything \\scriptsize (already set inside multicols)
- Constants and values: use small tabular environments (2-3 columns, no captions)
- Lists of properties with \\begin{itemize}: each item ≤ 1 line
- Equations: inline or very short display math — no multi-line derivations
- Pack maximum content — this is a closed-book reference, every cm² matters
- Use \\HR between sub-topics within a section
- End with: \\begin{flushright}\\tiny\\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureTemplate: `\\begin{document}
% FILL: Title: {\\small\\bfseries\\color{headblue} SUBJECT --- TOPIC \\hfill Study Form}\\HR

\\begin{multicols}{3}
\\scriptsize

% FILL: \\sectionbar{First Major Topic}
% FILL: \\formulabox{Formula Name}{latex expression} for each key formula (3-6 per section)
% FILL: Small constants table with \\begin{tabular}{ll} ... \\end{tabular}
% FILL: \\begin{itemize} for key properties or rules

\\HR

% FILL: \\sectionbar{Second Major Topic}
% FILL: More \\formulabox entries
% FILL: Compact list of derived results

\\HR

% FILL: \\sectionbar{Third Major Topic}
% FILL: Continue pattern: formulabox + tables + itemize

% FILL: Add 4-8 sections total, filling all 3 columns densely
% FILL: Final section can include a mini quick-reference table

\\end{multicols}
\\begin{flushright}\\tiny\\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
{\\small\\bfseries\\color{headblue} Electromagnetism --- Study Form \\hfill Study Form}\\HR

\\begin{multicols}{3}
\\scriptsize

\\sectionbar{Maxwell's Equations (SI)}
\\formulabox{Gauss (E)}{\\nabla\\cdot\\mathbf{E} = \\rho/\\varepsilon_0}
\\formulabox{Gauss (B)}{\\nabla\\cdot\\mathbf{B} = 0}
\\formulabox{Faraday}{\\nabla\\times\\mathbf{E} = -\\partial\\mathbf{B}/\\partial t}
\\formulabox{Ampere--Maxwell}{\\nabla\\times\\mathbf{B} = \\mu_0(\\mathbf{J}+\\varepsilon_0\\partial\\mathbf{E}/\\partial t)}

\\HR

\\sectionbar{Constants}
\\begin{tabular}{ll}
$\\varepsilon_0$ & $8.85\\times10^{-12}$ F/m \\\\
$\\mu_0$ & $4\\pi\\times10^{-7}$ H/m \\\\
$c$ & $3\\times10^8$ m/s \\\\
$e$ & $1.60\\times10^{-19}$ C \\\\
\\end{tabular}

\\HR

\\sectionbar{Energy Densities}
\\formulabox{Electric}{u_E = \\varepsilon_0 E^2/2}
\\formulabox{Magnetic}{u_B = B^2/(2\\mu_0)}
\\formulabox{Poynting}{\\mathbf{S} = \\mathbf{E}\\times\\mathbf{B}/\\mu_0}

\\end{multicols}
\\begin{flushright}\\tiny\\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};
