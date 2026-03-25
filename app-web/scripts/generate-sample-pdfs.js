/**
 * F2-M7.4 — Generate sample PDFs for all BetterNotes templates.
 *
 * Output: public/templates/samples/{templateId}.pdf
 * Calls the local app-api (must be running on localhost:4000).
 *
 * Run with: node scripts/generate-sample-pdfs.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:4000/latex/generate-and-compile';
const OUT_DIR = path.join(__dirname, '../public/templates/samples');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const TEMPLATES = [
  {
    id: '2cols_portrait',
    prompt: 'Calculus II cheat sheet: derivatives and integrals of common functions, integration techniques (substitution, parts, partial fractions), Taylor series expansions, and L\'Hopital\'s rule.',
  },
  {
    id: 'landscape_3col_maths',
    prompt: 'Linear algebra reference sheet: matrix operations, determinants, eigenvalues and eigenvectors, vector spaces, linear transformations, and inner products.',
  },
  {
    id: 'study_form',
    prompt: 'Thermodynamics formula sheet: laws of thermodynamics, ideal gas law, heat transfer equations, entropy, Carnot efficiency, and key physical constants.',
  },
  {
    id: 'lecture_notes',
    prompt: 'Lecture notes on quantum mechanics: wave-particle duality, Schrödinger equation, quantum numbers, atomic orbitals, and the uncertainty principle.',
  },
  {
    id: 'cornell',
    prompt: 'Cornell notes on macroeconomics: GDP components, inflation, unemployment, monetary policy, fiscal policy, and the business cycle.',
  },
  {
    id: 'problem_solving',
    prompt: 'Problem set on classical mechanics: projectile motion, Newton\'s laws, friction, circular motion, and conservation of energy and momentum.',
  },
  {
    id: 'zettelkasten',
    prompt: 'Zettelkasten notes on machine learning: supervised vs unsupervised learning, gradient descent, overfitting, regularization, and neural network architectures.',
  },
  {
    id: 'academic_paper',
    prompt: 'Academic paper on the effect of study techniques on memory retention: spaced repetition, active recall, and interleaving practice.',
  },
  {
    id: 'lab_report',
    prompt: 'Lab report for a pendulum experiment: measuring period vs length, calculating gravitational acceleration, error analysis and conclusions.',
  },
  {
    id: 'data_analysis',
    prompt: 'Data analysis report on student performance dataset: descriptive statistics, correlation between study hours and grades, regression model and conclusions.',
  },
];

async function generatePdf(template) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: template.prompt, templateId: template.id }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(OUT_DIR, `${template.id}.pdf`);
  fs.writeFileSync(outPath, buffer);
  const kb = (buffer.length / 1024).toFixed(1);
  console.log(`  [OK] ${template.id}.pdf  (${kb} KB)`);
}

(async () => {
  console.log(`Generating ${TEMPLATES.length} sample PDFs — this may take a few minutes...\n`);
  for (const t of TEMPLATES) {
    process.stdout.write(`  Generating ${t.id}...`);
    try {
      await generatePdf(t);
    } catch (err) {
      console.error(`\n  [ERR] ${t.id}: ${err.message}`);
    }
  }
  console.log(`\nDone — PDFs written to public/templates/samples/`);
})();
