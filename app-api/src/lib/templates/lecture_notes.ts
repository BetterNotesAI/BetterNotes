import { TemplateDefinition } from './types';

export const lectureNotes: TemplateDefinition = {
  id: 'lecture_notes',
  displayName: 'Lecture Notes',
  description: 'Structured multi-page lecture notes with subject header, learning objectives, numbered examples, and a summary. Ideal for self-study notes in engineering, physics, or maths.',
  isPro: false,

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
\\usepackage{tcolorbox}
\\tcbuselibrary{skins,breakable}
\\usepackage{enumitem}
\\usepackage{booktabs}
\\usepackage{titlesec}
\\usepackage{fancyhdr}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{4pt}
\\definecolor{accent}{RGB}{0,90,170}
\\definecolor{examplebg}{RGB}{245,250,255}
\\definecolor{summarybg}{RGB}{255,252,235}
\\definecolor{warningbg}{RGB}{255,245,245}
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
\\newcounter{example}[section]
\\renewcommand{\\theexample}{\\thesection.\\arabic{example}}
\\newenvironment{example}[1][]{%
  \\refstepcounter{example}%
  \\begin{tcolorbox}[
    enhanced,breakable,
    colback=examplebg,colframe=accent,
    title=\\textbf{Example \\theexample\\ifx\\relax#1\\relax\\else: #1\\fi},
    fonttitle=\\bfseries\\small,
    coltitle=white,colbacktitle=accent,
    sharp corners=south,boxrule=0.6pt,
    top=4pt,bottom=4pt,left=6pt,right=6pt,
  ]
}{\\end{tcolorbox}}
\\newenvironment{keypoint}[1][Key Point]{%
  \\begin{tcolorbox}[
    enhanced,breakable,
    colback=summarybg,colframe=orange!70!black,
    title=\\textbf{#1},fonttitle=\\bfseries\\small,
    coltitle=white,colbacktitle=orange!70!black,
    sharp corners,boxrule=0.6pt,
    top=3pt,bottom=3pt,left=5pt,right=5pt,
  ]
}{\\end{tcolorbox}}
\\newenvironment{warning}[1][Note]{%
  \\begin{tcolorbox}[
    enhanced,colback=warningbg,colframe=red!60!black,
    title=\\textbf{#1},fonttitle=\\bfseries\\small,
    coltitle=white,colbacktitle=red!60!black,
    sharp corners,boxrule=0.6pt,
    top=3pt,bottom=3pt,left=5pt,right=5pt,
  ]
}{\\end{tcolorbox}}
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
4. Numbered examples using \\begin{example}[Optional Title] ... \\end{example}
5. Theorems and definitions using the defined environments
6. Warning/note boxes using \\begin{warning}[Note] ... \\end{warning}
7. A final Summary section with a \\begin{keypoint}[Summary] ... \\end{keypoint}

CONTENT RULES:
- Write thorough, educational content — this is for learning, not just reference
- Each section should have 2-4 paragraphs plus examples
- Use numbered examples generously (at least 3-5 examples total)
- Include derivations in align* or equation environments
- Use \\begin{itemize} or \\begin{enumerate} for lists of steps, properties, or rules
- Use \\begin{definition} for formal definitions and \\begin{theorem} for key results
- The \\example counter resets at each \\section — Example 1.1, 1.2, 2.1, etc.
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
% FILL: \\begin{example}[Descriptive Title] worked example with step-by-step solution \\end{example}

\\section{Second Major Section Title}
% FILL: Build on the first section — introduce more advanced concepts
% FILL: \\begin{theorem}[Name] statement \\end{theorem} with \\begin{proof} ... \\end{proof}
% FILL: Equation development with align* environment
% FILL: \\begin{example} another worked example \\end{example}
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

\\begin{example}[2x2 Matrix]
Let $A = \\begin{pmatrix} 3 & 1 \\\\ 0 & 2 \\end{pmatrix}$. Then $\\lambda_1 = 3$ with $\\mathbf{v}_1 = (1,0)^T$ and $\\lambda_2 = 2$ with $\\mathbf{v}_2 = (-1,1)^T$.
\\end{example}

\\section{The Characteristic Polynomial}

\\begin{theorem}[Characteristic Equation]
$\\lambda$ is an eigenvalue of $A$ if and only if $\\det(A - \\lambda I) = 0$.
\\end{theorem}

The polynomial $p(\\lambda) = \\det(A - \\lambda I)$ is called the \\textbf{characteristic polynomial} of degree $n$.

\\begin{example}[Finding Eigenvalues]
For $A = \\begin{pmatrix} 4 & -2 \\\\ 1 & 1 \\end{pmatrix}$: $\\det(A-\\lambda I) = (4-\\lambda)(1-\\lambda)+2 = \\lambda^2 - 5\\lambda + 6 = 0$, giving $\\lambda = 2, 3$.
\\end{example}

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
