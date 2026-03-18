import { TemplateDefinition } from './types';

export const academicPaper: TemplateDefinition = {
  id: 'academic_paper',
  displayName: 'Academic Paper',
  description: 'Two-column academic paper in AMS/Physical Review style — abstract, sections, theorems, bibliography.',
  isPro: true,

  preamble: `\\documentclass[11pt,twocolumn]{article}
\\usepackage[english]{babel}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{microtype}
\\usepackage{geometry}
\\geometry{a4paper,left=18mm,right=18mm,top=20mm,bottom=25mm,columnsep=8mm}
\\usepackage{xcolor}
\\usepackage{amsmath,amsthm,amssymb,amsfonts,mathtools}
\\usepackage{bm}
\\usepackage{graphicx}
\\usepackage{float}
\\usepackage{booktabs}
\\usepackage{array}
\\usepackage{multirow}
\\usepackage[numbers,sort&compress]{natbib}
\\usepackage{hyperref}
\\hypersetup{colorlinks=true,linkcolor=blue!70!black,citecolor=green!50!black,urlcolor=blue!60!black}
\\usepackage{titlesec}
\\titleformat{\\section}{\\large\\bfseries}{\\thesection.}{0.5em}{}
\\titleformat{\\subsection}{\\bfseries}{\\thesubsection.}{0.5em}{}
\\setlength{\\parindent}{1em}
\\setlength{\\parskip}{0pt}
\\theoremstyle{plain}
\\newtheorem{theorem}{Theorem}[section]
\\newtheorem{lemma}[theorem]{Lemma}
\\newtheorem{proposition}[theorem]{Proposition}
\\newtheorem{corollary}[theorem]{Corollary}
\\theoremstyle{definition}
\\newtheorem{definition}[theorem]{Definition}
\\newtheorem{example}[theorem]{Example}
\\theoremstyle{remark}
\\newtheorem{remark}[theorem]{Remark}
\\newcommand{\\dd}{\\mathrm{d}}
\\newcommand{\\avg}[1]{\\langle #1 \\rangle}
\\newcommand{\\Tr}{\\mathrm{Tr}}
\\newcommand{\\order}[1]{\\mathcal{O}\\left( #1 \\right)}`,

  styleGuide: `You are generating an ACADEMIC RESEARCH PAPER (two-column, AMS/Physical Review style).

STRUCTURE (in order):
1. \\title{...} \\author{...} \\date{...} \\maketitle
2. \\begin{abstract} ... \\end{abstract}
3. \\section{Introduction} — motivation, context, contributions
4. \\section{Background} or \\section{Related Work} — prior art
5. \\section{Methods} / \\section{Theory} — main technical content
6. \\section{Results} — findings, theorems, proofs
7. \\section{Discussion} — implications, limitations
8. \\section{Conclusion}
9. \\bibliographystyle{unsrtnat} and \\begin{thebibliography}{99} ... \\end{thebibliography} with realistic dummy references

CONTENT RULES:
- Use numbered theorem environments: theorem, lemma, proposition, corollary, definition
- Proofs: \\begin{proof} ... \\end{proof}
- Use booktabs for tables (\\toprule, \\midrule, \\bottomrule)
- Citations: \\cite{key}
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureTemplate: `\\begin{document}
% FILL: \\title{Full paper title}
% FILL: \\author{Author Name \\\\ Institution or Department}
% FILL: \\date{\\today}
\\maketitle

\\begin{abstract}
% FILL: 150-250 word abstract: motivation, method, key result with numbers
\\end{abstract}

\\section{Introduction}
% FILL: Paragraph motivating the problem
% FILL: Brief survey of related work (cite 2-4 references)
% FILL: Statement of contributions

\\section{Background}
% FILL: Prerequisites, notation, key prior results the reader needs
% FILL: Use definition environment for formal definitions

\\section{Methods}
% FILL: Main theoretical or experimental approach
% FILL: Key equations with align* or equation environments
% FILL: State main theorem or result

\\section{Results}
% FILL: \\begin{theorem}[Name] ... \\end{theorem}
% FILL: \\begin{proof} ... \\end{proof}
% FILL: Table of results with booktabs if applicable

\\section{Discussion}
% FILL: Interpretation of results
% FILL: Comparison with existing work
% FILL: Limitations

\\section{Conclusion}
% FILL: Summary of contributions and future directions

\\bibliographystyle{unsrtnat}
\\begin{thebibliography}{99}
% FILL: 4-8 realistic references in format: \\bibitem{key} Authors, \\textit{Title}, Journal, Year.
\\end{thebibliography}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
\\title{On the Convergence of Stochastic Gradient Methods}
\\author{A. Author\\\\Department of Mathematics}
\\date{\\today}
\\maketitle

\\begin{abstract}
We study convergence properties of stochastic gradient descent under mild smoothness assumptions. Our main result establishes an $\\mathcal{O}(1/\\sqrt{T})$ convergence rate for non-convex objectives.
\\end{abstract}

\\section{Introduction}
Stochastic gradient descent (SGD) \\cite{robbins1951} is the workhorse of modern machine learning...

\\begin{theorem}[Convergence Rate]
Under Assumptions 1--3, after $T$ iterations of SGD with step size $\\eta = 1/\\sqrt{T}$:
\\[ \\frac{1}{T}\\sum_{t=1}^T \\mathbb{E}[\\|\\nabla f(x_t)\\|^2] \\leq \\frac{C}{\\sqrt{T}} \\]
\\end{theorem}
\\begin{proof}
By the $L$-smoothness of $f$ and the variance bound on stochastic gradients...
\\end{proof}

\\bibliographystyle{unsrtnat}
\\begin{thebibliography}{99}
\\bibitem{robbins1951} H. Robbins and S. Monro, \\textit{Ann. Math. Stat.}, 1951.
\\end{thebibliography}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};
