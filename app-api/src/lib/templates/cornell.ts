import { TemplateDefinition } from './types';

export const cornell: TemplateDefinition = {
  id: 'cornell',
  displayName: 'Cornell Notes',
  description: 'Classic Cornell note-taking format with wide left margin for cue keywords and summary box at the bottom.',
  isPro: false,

  preamble: `\\documentclass[10pt]{article}
\\usepackage[english]{babel}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amsthm,amssymb,amsfonts}
\\usepackage{lmodern}
\\usepackage{xcolor}
\\usepackage{geometry}
\\geometry{a4paper,portrait,left=5.5cm,right=1cm,top=2.5cm,bottom=2cm,marginparwidth=4.5cm,marginparsep=0.5cm}
\\usepackage{fancyhdr}
\\usepackage{tcolorbox}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.3em}
\\definecolor{cornellred}{RGB}{179,27,27}
\\definecolor{cueblue}{RGB}{0,70,140}
\\definecolor{sectiongreen}{RGB}{0,120,60}
\\definecolor{defgreen}{RGB}{61,176,0}
\\definecolor{propblue}{RGB}{0,100,180}
\\definecolor{thmred}{RGB}{180,0,0}
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{1.5pt}
\\renewcommand{\\headrule}{\\hbox to\\headwidth{\\color{cornellred}\\leaders\\hrule height \\headrulewidth\\hfill}}
\\reversemarginpar
\\newcommand{\\cue}[1]{\\marginpar{\\raggedright\\footnotesize\\textcolor{cueblue}{\\textbf{#1}}}}
\\newtheoremstyle{cornellstyle}{0pt}{3pt}{\\upshape}{}{\\bfseries}{}{ }{}
\\theoremstyle{cornellstyle}
\\newtheorem*{definition}{\\textcolor{defgreen}{Def.}}
\\newtheorem*{proposition}{\\textcolor{propblue}{Prop.}}
\\newtheorem*{theorem}{\\textcolor{thmred}{Thm.}}
\\newtheorem*{corollary}{\\textcolor{thmred}{Cor.}}
\\newtheorem*{example}{\\textcolor{sectiongreen}{Ex.}}
\\newtheorem*{remark}{\\textcolor{cueblue}{Rmk.}}
\\newcommand{\\summary}[1]{%
\\vfill
\\begin{tcolorbox}[colback=cornellred!5,colframe=cornellred,title=\\textbf{SUMMARY},fonttitle=\\bfseries\\color{white},coltitle=white,sharp corners,boxrule=1pt,colbacktitle=cornellred]
\\small #1
\\end{tcolorbox}%
}
\\titleformat{\\section}{\\color{cornellred}\\large\\bfseries}{}{0em}{}[\\vspace{-0.7em}{\\color{cornellred}\\rule{\\linewidth}{0.5pt}}\\vspace{0.3em}]
\\titleformat{\\subsection}{\\color{sectiongreen}\\bfseries}{}{0em}{}
\\setlist[itemize]{leftmargin=1.2em,itemsep=0.1em,topsep=0.1em}
\\setlist[enumerate]{leftmargin=1.2em,itemsep=0.1em,topsep=0.1em}`,

  styleGuide: `You are generating a CORNELL NOTE-TAKING document.

LAYOUT RULES:
- Set the header: \\fancyhead[L]{\\textbf{\\large SUBJECT --- Topic}} and \\fancyhead[R]{\\textbf{Chapter/Lecture}}
- Wide LEFT MARGIN (5.5cm) is used for cue keywords via \\cue{...}
- Main body text goes in the right portion (normal flow)
- Use \\section{Topic} for major topics (styled with cornellred underline)
- Use \\subsection{Subtopic} for subsections (styled in sectiongreen)

CONTENT RULES:
- EVERY paragraph or concept should have a \\cue{question or keyword} in the left margin
- Use theorem environments: definition, proposition, theorem, corollary, example, remark
- DO NOT redefine these environments
- For equations, use align* or equation*
- At the END of the document, add \\summary{brief summary of key points} using the tcolorbox command
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureTemplate: `\\begin{document}
% FILL: Set headers: \\fancyhead[L]{\\textbf{\\large SUBJECT --- Topic}} and \\fancyhead[R]{\\textbf{Chapter/Lecture N}}

% FILL: First major section using \\section{Section Title}

% FILL: \\cue{Key question or keyword for this concept}
% FILL: Main content — definition, theorem, or explanation using appropriate theorem environment

% FILL: \\cue{Another keyword}
% FILL: Another concept with equation in align* or equation*

% FILL: \\subsection{Subtopic} for finer subdivisions
% FILL: \\cue{Cue word} before each paragraph

% FILL: Second major section \\section{...}
% FILL: Continue with cue + content pairs, 4-8 concepts per section

% FILL: Third section (add as many sections as needed for the topic)
% FILL: Include examples using \\begin{example} ... \\end{example}

% FILL: \\summary{2-5 bullet points or sentences summarizing the key takeaways of the whole document}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
\\fancyhead[L]{\\textbf{\\large Linear Algebra --- Cornell Notes}}
\\fancyhead[R]{\\textbf{Chapter 1: Vectors}}

\\section{Vector Spaces}

\\cue{What is a vector space?}
\\begin{definition}
A \\textbf{vector space} over $\\mathbb{R}$ is a set $V$ with addition and scalar multiplication satisfying 8 axioms.
\\end{definition}

\\cue{Key examples?}
\\begin{example}
$\\mathbb{R}^n$, polynomials $\\mathcal{P}_n$, continuous functions $C[a,b]$.
\\end{example}

\\cue{Subspace criterion?}
\\begin{proposition}
$W \\subseteq V$ is a subspace iff $\\mathbf{0}\\in W$ and $W$ is closed under $+$ and scalar $\\cdot$.
\\end{proposition}

\\summary{
\\textbf{Vector space:} closed under $+$ and $\\cdot$ with 8 axioms. \\textbf{Subspace:} contains $\\mathbf{0}$, closed under both operations.
}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};
