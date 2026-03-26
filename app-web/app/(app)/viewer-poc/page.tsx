'use client';

/**
 * viewer-poc/page.tsx
 * Temporary PoC page to verify the pipeline:
 *   LaTeX string → parseLatex() → Block[] → LatexBlock → KaTeX
 *
 * Uses one representative sample per template (4 total).
 * This page is NOT the final workspace integration.
 * Access at: http://localhost:3000/viewer-poc
 */

import React, { useState } from 'react';
import LatexViewer from '@/components/viewer/LatexViewer';

// ─── sample LaTeX per template ────────────────────────────────────────────────

const SAMPLES: Record<string, { label: string; source: string }> = {
  lecture_notes: {
    label: 'Lecture Notes — Eigenvalues',
    source: `\\documentclass[11pt]{article}
\\begin{document}
\\title{Linear Algebra: Eigenvalues and Eigenvectors}
\\author{Mathematics for Engineers --- Semester 2}
\\date{\\today}
\\maketitle

\\section{Definitions and Basic Properties}

An \\textbf{eigenvector} of a matrix $A$ is a non-zero vector $\\mathbf{v}$ that only changes in scale when $A$ is applied.

\\begin{definition}
Let $A \\in \\mathbb{R}^{n\\times n}$. A scalar $\\lambda \\in \\mathbb{C}$ is an \\textbf{eigenvalue} of $A$ if there exists a non-zero vector $\\mathbf{v}$ such that
$$A\\mathbf{v} = \\lambda\\mathbf{v}.$$
The vector $\\mathbf{v}$ is called an \\textbf{eigenvector} associated with $\\lambda$.
\\end{definition}

Key properties of eigenvalues:
\\begin{itemize}
  \\item The set of all eigenvalues is the \\textbf{spectrum} of $A$.
  \\item $\\lambda = 0$ is an eigenvalue iff $A$ is singular.
  \\item $\\text{tr}(A) = \\sum_i \\lambda_i$ and $\\det(A) = \\prod_i \\lambda_i$.
\\end{itemize}

\\section{The Characteristic Polynomial}

\\begin{theorem}
$\\lambda$ is an eigenvalue of $A$ if and only if $\\det(A - \\lambda I) = 0$.
\\end{theorem}

The polynomial $p(\\lambda) = \\det(A - \\lambda I)$ is called the \\textbf{characteristic polynomial} of degree $n$.

For $A = \\begin{pmatrix} 4 & -2 \\\\ 1 & 1 \\end{pmatrix}$, the characteristic equation is:

\\begin{align*}
\\det(A - \\lambda I) &= (4-\\lambda)(1-\\lambda) + 2 \\\\
&= \\lambda^2 - 5\\lambda + 6 = 0
\\end{align*}

giving eigenvalues $\\lambda = 2$ and $\\lambda = 3$.

\\section{Summary}

\\begin{itemize}
  \\item Eigenvalues satisfy $\\det(A - \\lambda I) = 0$.
  \\item Eigenvectors span the null space of $(A - \\lambda I)$.
  \\item A matrix is diagonalisable iff it has $n$ linearly independent eigenvectors.
\\end{itemize}

\\end{document}`,
  },

  landscape_3col_maths: {
    label: '3-Col Maths — Calculus Reference',
    source: `\\documentclass[10pt]{article}
\\begin{document}
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
  \\item $(\\cos x)' = -\\sin x$
  \\item $(e^x)' = e^x$
  \\item $(\\ln x)' = 1/x$
\\end{itemize}

\\section*{Integration}

\\begin{definition}
$\\int_a^b f(x)\\,\\dd x = F(b) - F(a)$ where $F' = f$
\\end{definition}

Integration by parts:
$$\\int u\\,\\dd v = uv - \\int v\\,\\dd u$$

\\subsection*{Standard Integrals}
\\begin{itemize}
  \\item $\\int x^n\\,\\dd x = \\frac{x^{n+1}}{n+1} + C$
  \\item $\\int e^x\\,\\dd x = e^x + C$
  \\item $\\int \\frac{1}{x}\\,\\dd x = \\ln|x| + C$
\\end{itemize}

\\section*{Complex Numbers}

Let $z = a + bi \\in \\cplex$ where $a,b \\in \\real$.

Modulus: $|z| = \\sqrt{a^2 + b^2}$

Euler's formula:
$$e^{i\\theta} = \\cos\\theta + i\\sin\\theta$$

\\end{multicols*}
\\end{document}`,
  },

  study_form: {
    label: 'Study Form — Electromagnetism',
    source: `\\documentclass[9pt]{article}
\\begin{document}

\\begin{multicols}{3}
\\scriptsize

\\sectionbar{Maxwell's Equations (SI)}

\\formulabox{Gauss (E)}{\\nabla\\cdot\\mathbf{E} = \\rho/\\varepsilon_0}

\\formulabox{Gauss (B)}{\\nabla\\cdot\\mathbf{B} = 0}

\\formulabox{Faraday}{\\nabla\\times\\mathbf{E} = -\\partial\\mathbf{B}/\\partial t}

\\formulabox{Ampere-Maxwell}{\\nabla\\times\\mathbf{B} = \\mu_0(\\mathbf{J}+\\varepsilon_0\\partial\\mathbf{E}/\\partial t)}

\\sectionbar{Constants}
\\begin{tabular}{ll}
$\\varepsilon_0$ & $8.85\\times10^{-12}$ F/m \\\\
$\\mu_0$ & $4\\pi\\times10^{-7}$ H/m \\\\
$c$ & $3\\times10^8$ m/s \\\\
$e$ & $1.60\\times10^{-19}$ C \\\\
\\end{tabular}

\\sectionbar{Energy Densities}

\\formulabox{Electric}{u_E = \\varepsilon_0 E^2/2}

\\formulabox{Magnetic}{u_B = B^2/(2\\mu_0)}

\\formulabox{Poynting}{\\mathbf{S} = \\mathbf{E}\\times\\mathbf{B}/\\mu_0}

\\end{multicols}
\\end{document}`,
  },

  two_cols_portrait: {
    label: '2-Col Portrait — Classical Mechanics',
    source: `\\documentclass[10pt]{article}
\\begin{document}
\\pagestyle{empty}

\\begin{multicols}{2}
\\footnotesize

\\textbf{Newton's Laws}

1st: $\\sum F = 0 \\Rightarrow a = 0$.\\quad 2nd: $F = ma$.\\quad 3rd: $F_{AB} = -F_{BA}$.

\\textbf{Work-Energy Theorem}

$$W_{\\text{net}} = \\Delta KE = \\frac{1}{2}mv_f^2 - \\frac{1}{2}mv_i^2$$

\\textbf{Kinematics (constant $a$):}
\\begin{itemize}
  \\item $v = v_0 + at$
  \\item $x = x_0 + v_0 t + \\frac{1}{2}at^2$
  \\item $v^2 = v_0^2 + 2a\\Delta x$
\\end{itemize}

\\textbf{Rotational Motion}

Torque: $\\tau = r \\times F$, moment of inertia: $I = \\sum m_i r_i^2$.

\\begin{align*}
L &= I\\omega \\\\
\\tau &= I\\alpha
\\end{align*}

\\textbf{Energy}

\\begin{tabular}{ll}
Kinetic & $K = \\frac{1}{2}mv^2$ \\\\
Potential & $U = mgh$ \\\\
Rotational & $K_r = \\frac{1}{2}I\\omega^2$ \\\\
\\end{tabular}

\\end{multicols}
\\end{document}`,
  },
};

// ─── page component ───────────────────────────────────────────────────────────

export default function ViewerPocPage() {
  const templateKeys = Object.keys(SAMPLES);
  const [activeKey, setActiveKey] = useState(templateKeys[0]);

  const sample = SAMPLES[activeKey];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-bold text-gray-800">
          F3-M1.4 — LaTeX Viewer PoC
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Pipeline: LaTeX string → parseLatex() → Block[] → LatexBlock → KaTeX.
          This is a temporary verification page — not the final workspace.
        </p>
      </div>

      {/* Template selector */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex gap-3 flex-wrap">
        {templateKeys.map(key => (
          <button
            key={key}
            onClick={() => setActiveKey(key)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeKey === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {SAMPLES[key].label}
          </button>
        ))}
      </div>

      {/* Split view: raw source + rendered output */}
      <div className="flex flex-1 h-[calc(100vh-116px)]">
        {/* Left: raw LaTeX */}
        <div className="w-1/2 border-r border-gray-200 bg-gray-900 overflow-auto">
          <div className="px-4 py-2 bg-gray-800 text-xs text-gray-400 font-mono border-b border-gray-700">
            RAW LaTeX SOURCE
          </div>
          <pre className="text-xs text-green-300 font-mono p-4 whitespace-pre-wrap leading-relaxed">
            {sample.source}
          </pre>
        </div>

        {/* Right: rendered viewer */}
        <div className="w-1/2 overflow-auto bg-white">
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
            RENDERED OUTPUT (KaTeX)
          </div>
          <LatexViewer
            latexSource={sample.source}
            className="max-w-none px-6 py-4 font-sans"
          />
        </div>
      </div>
    </div>
  );
}
