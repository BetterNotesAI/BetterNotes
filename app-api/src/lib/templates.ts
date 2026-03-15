// app-api/src/lib/templates.ts
// Instruction-based template system.
// Templates are defined as structured objects (preamble + style guide + example)
// instead of static .tex files. The AI uses these to generate complete documents.

export interface TemplateDefinition {
  id: string;
  /** LaTeX preamble: \documentclass + all \usepackage + custom commands/environments.
   *  The AI must paste this verbatim before \begin{document}. */
  preamble: string;
  /** Plain-English instructions for the AI on layout, style, and content conventions. */
  styleGuide: string;
  /** Short LaTeX snippet (~20 lines) demonstrating the key environments and commands. */
  structureExample: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FREE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const landscape3colMaths: TemplateDefinition = {
  id: "landscape_3col_maths",
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

// ─────────────────────────────────────────────────────────────────────────────

const twocolsPortrait: TemplateDefinition = {
  id: "2cols_portrait",
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

// ─────────────────────────────────────────────────────────────────────────────

const cornell: TemplateDefinition = {
  id: "cornell",
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

// ─────────────────────────────────────────────────────────────────────────────

const problemSolving: TemplateDefinition = {
  id: "problem_solving",
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
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

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

// ─────────────────────────────────────────────────────────────────────────────

const zettelkasten: TemplateDefinition = {
  id: "zettelkasten",
  preamble: `\\documentclass[10pt]{article}
\\usepackage[english]{babel}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{lmodern}
\\usepackage{xcolor}
\\usepackage{geometry}
\\geometry{a4paper,portrait,margin=8mm}
\\usepackage{tcolorbox}
\\tcbuselibrary{raster,skins}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.2em}
\\definecolor{cardblue}{RGB}{0,80,158}
\\definecolor{linkpurple}{RGB}{120,50,150}
\\definecolor{taggreen}{RGB}{0,120,60}
\\pagenumbering{gobble}
\\tcbset{
  zettelstyle/.style={
    enhanced,sharp corners,
    colback=white,colframe=cardblue,boxrule=0.8pt,
    fonttitle=\\bfseries\\small,coltitle=white,colbacktitle=cardblue,
    attach boxed title to top left={xshift=3mm,yshift=-2mm},
    boxed title style={sharp corners,colframe=cardblue},
    top=5mm,bottom=2mm,left=2mm,right=2mm,
  }
}
\\newcommand{\\conn}[1]{\\textcolor{linkpurple}{\\small $\\rightarrow$ \\textit{#1}}}
\\newcommand{\\tags}[1]{\\par\\vfill\\textcolor{taggreen}{\\scriptsize\\ttfamily #1}}`,

  styleGuide: `You are generating a ZETTELKASTEN KNOWLEDGE CARD document.

LAYOUT RULES:
- Start with: {\\Large\\bfseries\\color{cardblue} SUBJECT --- Zettelkasten Cards \\hfill \\normalsize Knowledge Atoms}
- Then: \\vspace{3mm}\\hrule\\vspace{5mm}
- Each PAGE holds a 2×3 grid of 6 cards using tcbitemize with raster
- Use: \\begin{tcbitemize}[raster columns=2, raster rows=3, raster height=0.92\\textheight, raster equal height=rows, raster column skip=4mm, raster row skip=4mm]

CONTENT RULES:
- Each card: \\tcbitem[zettelstyle, title={\\texttt{ID} --- Title}]
- Card IDs use format: TOPIC-01, TOPIC-02, etc.
- Card content: \\footnotesize text, key concept, formula, or definition
- Use \\conn{Related Card ID} for cross-references between cards
- Use \\tags{#tag1 #tag2 #tag3} at the bottom of each card
- Close each page with \\end{tcbitemize} before starting new page
- Generate at least 6 cards (1 full page). 12 cards = 2 pages.
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureExample: `\\begin{document}
{\\Large\\bfseries\\color{cardblue} Graph Theory --- Zettelkasten Cards \\hfill \\normalsize Knowledge Atoms}
\\vspace{3mm}\\hrule\\vspace{5mm}

\\begin{tcbitemize}[
  raster columns=2, raster rows=3,
  raster height=0.92\\textheight,
  raster equal height=rows,
  raster column skip=4mm, raster row skip=4mm,
]

\\tcbitem[zettelstyle, title={\\texttt{GT-01} --- Graph Definition}]
\\footnotesize
A \\textbf{graph} $G = (V, E)$ consists of a set of vertices $V$ and edges $E \\subseteq V \\times V$.
\\begin{itemize}
  \\item \\textbf{Directed}: edges have direction
  \\item \\textbf{Undirected}: edges are symmetric
\\end{itemize}
\\conn{GT-02 Degree} \\conn{GT-03 Paths}
\\tags{#graph #definition #combinatorics}

\\tcbitem[zettelstyle, title={\\texttt{GT-02} --- Vertex Degree}]
\\footnotesize
The \\textbf{degree} $\\deg(v)$ = number of edges incident to $v$.
\\[ \\sum_{v \\in V} \\deg(v) = 2|E| \\]
\\conn{GT-01 Graph} \\conn{GT-04 Trees}
\\tags{#degree #handshaking #graph}

\\end{tcbitemize}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// PRO TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const academicPaper: TemplateDefinition = {
  id: "academic_paper",
  preamble: `\\documentclass[11pt,twocolumn]{article}
\\usepackage[english]{babel}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{microtype}
\\usepackage{geometry}
\\geometry{a4paper,left=18mm,right=18mm,top=20mm,bottom=25mm,columnsep=8mm}
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

// ─────────────────────────────────────────────────────────────────────────────

const labReport: TemplateDefinition = {
  id: "lab_report",
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
\\newcommand{\\mean}[1]{\\bar{#1}}
\\newcommand{\\uncertainty}[2]{(#1 \\pm #2)}
\\newcommand{\\SI}[2]{#1\\,\\mathrm{#2}}`,

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
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

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

// ─────────────────────────────────────────────────────────────────────────────

const dataAnalysis: TemplateDefinition = {
  id: "data_analysis",
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
\\usepackage{xcolor}
\\usepackage{listings}
\\usepackage{hyperref}
\\hypersetup{colorlinks=true,linkcolor=blue,urlcolor=blue}
\\usepackage{titlesec}
\\titleformat{\\section}{\\large\\bfseries}{\\thesection.}{0.5em}{}
\\titleformat{\\subsection}{\\bfseries}{\\thesubsection.}{0.5em}{}
\\definecolor{codegray}{rgb}{0.5,0.5,0.5}
\\definecolor{codepurple}{rgb}{0.58,0,0.82}
\\definecolor{codegreen}{rgb}{0,0.6,0}
\\definecolor{backcolor}{rgb}{0.97,0.97,0.97}
\\lstdefinestyle{pythonstyle}{
  backgroundcolor=\\color{backcolor},
  commentstyle=\\color{codegreen},
  keywordstyle=\\color{blue},
  numberstyle=\\tiny\\color{codegray},
  stringstyle=\\color{codepurple},
  basicstyle=\\ttfamily\\footnotesize,
  breakatwhitespace=false,breaklines=true,
  captionpos=b,keepspaces=true,
  numbers=left,numbersep=5pt,showspaces=false,
  showstringspaces=false,showtabs=false,tabsize=2,
  language=Python
}
\\lstset{style=pythonstyle}
\\setlength{\\parindent}{1em}
\\setlength{\\parskip}{3pt}`,

  styleGuide: `You are generating a DATA ANALYSIS REPORT for a statistics, data science, or ML course/project.

STRUCTURE (in order):
1. \\title{...} \\author{...} \\date{...} \\maketitle
2. \\begin{abstract} — dataset, methods, key findings with numbers \\end{abstract}
3. \\section{Introduction} — problem statement, dataset description, objectives
4. \\section{Exploratory Data Analysis} — descriptive statistics, distribution analysis
5. \\section{Methods} — statistical tests, model descriptions, mathematical formulations
6. \\section{Results} — tables of metrics, model performance, hypothesis test results
7. \\section{Discussion} — interpretation, limitations, comparison with baseline
8. \\section{Conclusion}

CONTENT RULES:
- Use lstlisting for Python/R code snippets with the pythonstyle (already defined)
- Use booktabs for results tables
- Include statistical formulas: hypothesis tests, confidence intervals, loss functions, metrics
- Include realistic numerical results (e.g., accuracy = 94.2%, p-value = 0.023)
- Use align* for multi-line math derivations
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureExample: `\\begin{document}
\\title{Predicting Student Performance: A Machine Learning Approach}
\\author{A. Researcher}
\\date{\\today}
\\maketitle

\\begin{abstract}
We apply logistic regression and random forests to predict student pass/fail from demographic and academic features. Our best model achieves AUC = 0.89 on the held-out test set.
\\end{abstract}

\\section{Methods}
The logistic regression loss is:
\\[ \\mathcal{L} = -\\frac{1}{n}\\sum_{i=1}^n \\left[y_i\\log(\\hat{p}_i) + (1-y_i)\\log(1-\\hat{p}_i)\\right] \\]

\\begin{lstlisting}[caption={Model training in Python}]
from sklearn.linear_model import LogisticRegression
model = LogisticRegression(C=1.0, max_iter=1000)
model.fit(X_train, y_train)
print(f"AUC: {roc_auc_score(y_test, model.predict_proba(X_test)[:,1]):.3f}")
\\end{lstlisting}

\\section{Results}
\\begin{table}[H]
\\centering
\\begin{tabular}{lcccc}
\\toprule
Model & Accuracy & Precision & Recall & AUC \\\\
\\midrule
Logistic Regression & 0.872 & 0.881 & 0.863 & 0.891 \\\\
Random Forest & 0.894 & 0.901 & 0.887 & 0.921 \\\\
\\bottomrule
\\end{tabular}
\\caption{Model comparison on test set.}
\\end{table}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATE_DEFINITIONS: Record<string, TemplateDefinition> = {
  landscape_3col_maths: landscape3colMaths,
  "2cols_portrait": twocolsPortrait,
  cornell: cornell,
  problem_solving: problemSolving,
  zettelkasten: zettelkasten,
  academic_paper: academicPaper,
  lab_report: labReport,
  data_analysis: dataAnalysis,
};

export function getTemplateOrThrow(templateId: string): TemplateDefinition {
  const tmpl = TEMPLATE_DEFINITIONS[templateId];
  if (!tmpl) {
    const available = Object.keys(TEMPLATE_DEFINITIONS).sort();
    const err: any = new Error(
      `[TEMPLATE_NOT_FOUND] templateId="${templateId}" not found. Available: ${available.join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }
  return tmpl;
}

/** List all available template IDs */
export function listTemplateIds(): string[] {
  return Object.keys(TEMPLATE_DEFINITIONS).sort();
}
