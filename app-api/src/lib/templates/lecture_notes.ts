import { TemplateDefinition } from './types';

export const lectureNotes: TemplateDefinition = {
  id: 'lecture_notes',
  displayName: 'Extended Lecture Notes',
  description: 'Extended multi-page lecture notes for full topic development, with long sections, worked examples, theorem blocks, and summary.',
  isPro: false,
  isMultiFile: true,
  scaffoldDir: 'extended-lecture-notes',

  preamble: `\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[english]{babel}
\\usepackage{lmodern}
\\usepackage{microtype}
\\usepackage{geometry}
\\geometry{a4paper,left=22mm,right=22mm,top=22mm,bottom=22mm}
\\usepackage{amsmath,amsthm,amssymb,amsfonts}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{booktabs}
\\usepackage{titlesec}
\\usepackage{fancyhdr}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{4pt}
\\definecolor{accent}{RGB}{0,90,170}
\\titleformat{\\section}{\\large\\bfseries\\color{accent}}{\\thesection.}{0.5em}{}[{\\color{accent}\\rule{\\linewidth}{0.4pt}}]
\\titleformat{\\subsection}{\\bfseries\\color{accent!80!black}}{\\thesubsection.}{0.5em}{}
\\titlespacing{\\section}{0pt}{8pt}{4pt}
\\titlespacing{\\subsection}{0pt}{5pt}{2pt}
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0.4pt}
\\fancyhead[L]{\\small\\textit{\\leftmark}}
\\fancyhead[R]{\\small\\textit{BetterNotes}}
\\fancyfoot[C]{\\small\\thepage}
\\newcounter{workedex}[section]
\\renewcommand{\\theworkedex}{\\thesection.\\arabic{workedex}}
\\newenvironment{workedexample}[1][]{%
  \\refstepcounter{workedex}%
  \\par\\medskip
  \\noindent{\\color{accent}\\rule{\\linewidth}{0.6pt}}\\par
  \\noindent\\textbf{\\color{accent}Example \\theworkedex\\ifx\\relax#1\\relax\\else: #1\\fi}\\par
  \\vspace{2pt}
  \\begingroup
}{%
  \\par\\endgroup
  \\noindent{\\color{accent}\\rule{\\linewidth}{0.6pt}}\\par\\medskip
}
\\newenvironment{keypoint}[1][Key Point]{%
  \\par\\medskip
  \\noindent\\textbf{\\color{accent!80!black}#1}\\par
  \\noindent{\\color{accent!50}\\rule{\\linewidth}{0.4pt}}\\par
  \\begingroup
}{%
  \\par\\endgroup
  \\noindent{\\color{accent!50}\\rule{\\linewidth}{0.4pt}}\\par\\medskip
}
\\newenvironment{warning}[1][Note]{%
  \\par\\medskip
  \\noindent\\textbf{\\color{red!70!black}#1}\\par
  \\noindent{\\color{red!50}\\rule{\\linewidth}{0.4pt}}\\par
  \\begingroup
}{%
  \\par\\endgroup
  \\noindent{\\color{red!50}\\rule{\\linewidth}{0.4pt}}\\par\\medskip
}
\\theoremstyle{plain}
\\newtheorem{theorem}{Theorem}[section]
\\newtheorem{lemma}[theorem]{Lemma}
\\newtheorem{proposition}[theorem]{Proposition}
\\newtheorem{corollary}[theorem]{Corollary}
\\theoremstyle{definition}
\\newtheorem{definition}[theorem]{Definition}
\\theoremstyle{remark}
\\newtheorem{remark}[theorem]{Remark}
\\setlist[itemize]{itemsep=2pt,topsep=2pt}
\\setlist[enumerate]{itemsep=2pt,topsep=2pt}`,

  styleGuide: `You are generating STRUCTURED LECTURE NOTES for a university-level course in engineering, physics, or mathematics.

DOCUMENT STRUCTURE:
1. Title block: \\title + \\author + \\date + \\maketitle
2. Learning objectives box using \\begin{keypoint}[Learning Objectives] ... \\end{keypoint}
3. Multiple sections (\\section{}) covering the topic in depth
4. Numbered examples using \\begin{workedexample}[Optional Title] ... \\end{workedexample}
5. Theorems and definitions using the defined environments
6. Warning/note boxes using \\begin{warning}[Note] ... \\end{warning}
7. A final Summary section with a \\begin{keypoint}[Summary] ... \\end{keypoint}

CONTENT RULES:
- Write thorough, educational content — this is for learning, not just reference
- Each section should have 2-4 paragraphs plus examples
- Use numbered examples generously (at least 3-5 examples total) with \\begin{workedexample}[Title] ... \\end{workedexample}
- Include derivations in align* or equation environments
- Use \\begin{itemize} or \\begin{enumerate} for lists of steps, properties, or rules
- Use \\begin{definition} for formal definitions and \\begin{theorem} for key results
- The workedex counter resets at each \\section — Example 1.1, 1.2, 2.1, etc.
- NEVER use \\includegraphics — describe figures in text
- Minimum 3 sections of substantial content
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureTemplate: `\\begin{document}
% FILL: \\title{Subject: Topic Title}
% FILL: \\author{Course / Semester}
% FILL: \\date{\\today}
\\maketitle

\\begin{keypoint}[Learning Objectives]
% FILL: \\begin{enumerate} with 3-5 specific learning objectives for this topic
\\end{keypoint}

\\section{First Major Section Title}
% FILL: Introductory paragraph explaining the concept and its importance
% FILL: \\begin{definition} ... \\end{definition} for the core definition
% FILL: Key properties or rules as \\begin{itemize}
% FILL: \\begin{workedexample}[Descriptive Title] worked example with step-by-step solution \\end{workedexample}

\\section{Second Major Section Title}
% FILL: Build on the first section — introduce more advanced concepts
% FILL: \\begin{theorem}[Name] statement \\end{theorem} with \\begin{proof} ... \\end{proof}
% FILL: Equation development with align* environment
% FILL: \\begin{workedexample} another worked example \\end{workedexample}
% FILL: \\begin{warning}[Common Mistake] highlight a frequent error \\end{warning}

\\section{Third Major Section Title}
% FILL: Applications or more complex aspects of the topic
% FILL: At least one more example
% FILL: Further theorems or results if applicable

% FILL: Add more sections as needed (4-6 sections total for comprehensive coverage)

\\section{Summary}
\\begin{keypoint}[Summary]
% FILL: \\begin{itemize} with 4-7 key takeaways from the entire document
\\end{keypoint}

\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
\\title{Linear Algebra: Eigenvalues and Eigenvectors}
\\author{Mathematics for Engineers --- Semester 2}
\\date{\\today}
\\maketitle

\\begin{keypoint}[Learning Objectives]
\\begin{enumerate}
  \\item Define eigenvalues and eigenvectors of a square matrix.
  \\item Compute eigenvalues via the characteristic polynomial.
  \\item Diagonalise a matrix when possible.
  \\item Apply eigendecomposition to solve systems of ODEs.
\\end{enumerate}
\\end{keypoint}

\\section{Definitions and Basic Properties}

An \\textbf{eigenvector} of a matrix $A$ is a non-zero vector $\\mathbf{v}$ that only changes in scale when $A$ is applied.

\\begin{definition}
Let $A \\in \\mathbb{R}^{n\\times n}$. A scalar $\\lambda \\in \\mathbb{C}$ is an \\textbf{eigenvalue} of $A$ if there exists a non-zero vector $\\mathbf{v}$ such that
\\[ A\\mathbf{v} = \\lambda\\mathbf{v}. \\]
The vector $\\mathbf{v}$ is called an \\textbf{eigenvector} associated with $\\lambda$.
\\end{definition}

\\begin{workedexample}[2x2 Matrix]
Let $A = \\begin{pmatrix} 3 & 1 \\\\ 0 & 2 \\end{pmatrix}$. Then $\\lambda_1 = 3$ with $\\mathbf{v}_1 = (1,0)^T$ and $\\lambda_2 = 2$ with $\\mathbf{v}_2 = (-1,1)^T$.
\\end{workedexample}

\\section{The Characteristic Polynomial}

\\begin{theorem}[Characteristic Equation]
$\\lambda$ is an eigenvalue of $A$ if and only if $\\det(A - \\lambda I) = 0$.
\\end{theorem}

The polynomial $p(\\lambda) = \\det(A - \\lambda I)$ is called the \\textbf{characteristic polynomial} of degree $n$.

\\begin{workedexample}[Finding Eigenvalues]
For $A = \\begin{pmatrix} 4 & -2 \\\\ 1 & 1 \\end{pmatrix}$: $\\det(A-\\lambda I) = (4-\\lambda)(1-\\lambda)+2 = \\lambda^2 - 5\\lambda + 6 = 0$, giving $\\lambda = 2, 3$.
\\end{workedexample}

\\section{Summary}
\\begin{keypoint}[Summary]
\\begin{itemize}
  \\item Eigenvalues satisfy $\\det(A - \\lambda I) = 0$ (characteristic polynomial).
  \\item Eigenvectors span the null space of $(A - \\lambda I)$.
  \\item A matrix is diagonalisable iff it has $n$ linearly independent eigenvectors.
\\end{itemize}
\\end{keypoint}

\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};
