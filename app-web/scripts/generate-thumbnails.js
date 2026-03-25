/**
 * F2-M7.2 — Generate PNG thumbnails for the 4 active BetterNotes templates.
 *
 * Output: public/templates/thumbnails/{templateId}.png
 * Dimensions: 480 x 360 px  (4:3, matches the aspect-[4/3] used in the card grid)
 * Background: dark (#0d0d0f), matching the app dark theme.
 *
 * Run with: node scripts/generate-thumbnails.js
 */

'use strict';

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../public/templates/thumbnails');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const W = 480;
const H = 360;

// ── colour palette ────────────────────────────────────────────────────────────
const BG          = '#0d0d0f';
const LINE_BOLD   = 'rgba(255,255,255,0.36)';
const LINE_NORMAL = 'rgba(255,255,255,0.16)';
const BOX_BORDER  = 'rgba(255,255,255,0.22)';
const BOX_FILL    = 'rgba(255,255,255,0.04)';
const IMG_FILL    = 'rgba(255,255,255,0.09)';
const IMG_BORDER  = 'rgba(255,255,255,0.16)';
const DIVIDER     = 'rgba(255,255,255,0.20)';

// accent colours per template (matching page.tsx)
const ACCENTS = {
  '2cols_portrait':       '#6366f1',
  'landscape_3col_maths': '#8b5cf6',
  'study_form':           '#22c55e',
  'lecture_notes':        '#3b82f6',
  'cornell':              '#f59e0b',
  'problem_solving':      '#ef4444',
  'zettelkasten':         '#10b981',
  'academic_paper':       '#6b7280',
  'lab_report':           '#14b8a6',
  'data_analysis':        '#f97316',
};

// ── primitive drawing helpers ─────────────────────────────────────────────────

function fillBg(ctx, accent) {
  // solid dark base
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  // subtle accent gradient overlay
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, accent + '18');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // thin top accent bar
  ctx.fillStyle = accent + '55';
  ctx.fillRect(0, 0, W, 2);
}

/**
 * Draw a horizontal "text line" stub.
 * @param ctx
 * @param x  left edge
 * @param y  top of line
 * @param w  width in px
 * @param bold  use bolder colour
 */
function line(ctx, x, y, w, bold = false) {
  ctx.fillStyle = bold ? LINE_BOLD : LINE_NORMAL;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 3, 1.5);
  ctx.fill();
}

/**
 * Draw a box (border + fill).
 */
function box(ctx, x, y, w, h, accentHex) {
  ctx.fillStyle = accentHex ? accentHex + '12' : BOX_FILL;
  ctx.strokeStyle = accentHex ? accentHex + '55' : BOX_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();
}

/**
 * Draw an image placeholder.
 */
function imgPlaceholder(ctx, x, y, w, h) {
  ctx.fillStyle = IMG_FILL;
  ctx.strokeStyle = IMG_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();
  // mountain icon lines
  const cx = x + w / 2, cy = y + h / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + 4);
  ctx.lineTo(cx - 3, cy - 3);
  ctx.lineTo(cx + 1, cy + 1);
  ctx.lineTo(cx + 5, cy - 4);
  ctx.lineTo(cx + 9, cy + 4);
  ctx.stroke();
}

/**
 * Draw a horizontal divider.
 */
function divider(ctx, x, y, w) {
  ctx.strokeStyle = DIVIDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}

// ── Column helpers ────────────────────────────────────────────────────────────

/**
 * Draw a series of line stubs starting at (x, y), advancing by step each time.
 * specs: array of { pct: 0-1, bold?: bool }
 */
function drawLines(ctx, colX, colW, startY, specs, step = 8) {
  let y = startY;
  for (const s of specs) {
    line(ctx, colX, y, colW * s.pct, s.bold);
    y += step;
  }
  return y;
}

/**
 * Draw a box containing line stubs.
 * Returns the y coordinate after the box.
 */
function drawBox(ctx, colX, colW, startY, lineSpecs, accentHex, step = 8) {
  const pad = 5;
  const innerH = lineSpecs.length * step + pad;
  box(ctx, colX, startY, colW, innerH, accentHex);
  let y = startY + pad / 2 + 2;
  for (const s of lineSpecs) {
    line(ctx, colX + pad, y, (colW - pad * 2) * s.pct, s.bold);
    y += step;
  }
  return startY + innerH + 3;
}

// ── Template renderers ────────────────────────────────────────────────────────

function render2ColsPortrait(ctx) {
  const accent = ACCENTS['2cols_portrait'];
  fillBg(ctx, accent);

  const PAD = 22;
  const CONTENT_Y = PAD + 12;
  const GAP = 10;
  const colW = (W - PAD * 2 - GAP) / 2;

  // Document title bar
  ctx.fillStyle = accent + '22';
  ctx.fillRect(PAD, PAD - 4, W - PAD * 2, 16);
  line(ctx, PAD + 4, PAD + 2, (W - PAD * 2) * 0.52, true);

  // Two columns
  for (let col = 0; col < 2; col++) {
    const cx = PAD + col * (colW + GAP);
    let y = CONTENT_Y + 4;

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.70, bold: true },
      { pct: 0.88 },
      { pct: 0.72 },
      { pct: 0.84 },
    ]);
    y += 2;

    y = drawBox(ctx, cx, colW, y, [
      { pct: 0.78, bold: true },
      { pct: 0.58 },
    ], accent);

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.94 },
      { pct: 0.68 },
    ]);
    y += 4;

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.62, bold: true },
      { pct: 0.86 },
      { pct: 0.70 },
      { pct: 0.92 },
      { pct: 0.78 },
    ]);
    y += 2;

    y = drawBox(ctx, cx, colW, y, [
      { pct: 0.74, bold: true },
      { pct: 0.52 },
      { pct: 0.64 },
    ], accent);

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.88 },
      { pct: 0.58 },
      { pct: 0.76 },
    ]);
    y += 4;

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.66, bold: true },
      { pct: 0.90 },
      { pct: 0.73 },
      { pct: 0.85 },
    ]);
    y += 2;

    y = drawBox(ctx, cx, colW, y, [
      { pct: 0.80, bold: true },
      { pct: 0.60 },
    ], accent);

    drawLines(ctx, cx, colW, y, [
      { pct: 0.92 },
      { pct: 0.67 },
      { pct: 0.80 },
      { pct: 0.55, bold: true },
      { pct: 0.88 },
      { pct: 0.72 },
    ]);
  }
}

function renderLandscape3Col(ctx) {
  const accent = ACCENTS['landscape_3col_maths'];
  fillBg(ctx, accent);

  const PAD = 20;
  const CONTENT_Y = PAD + 14;
  const GAP = 8;
  const colW = (W - PAD * 2 - GAP * 2) / 3;

  // Title
  ctx.fillStyle = accent + '22';
  ctx.fillRect(PAD, PAD - 4, W - PAD * 2, 16);
  line(ctx, PAD + 4, PAD + 2, (W - PAD * 2) * 0.40, true);

  for (let col = 0; col < 3; col++) {
    const cx = PAD + col * (colW + GAP);
    let y = CONTENT_Y + 4;

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.80, bold: true },
      { pct: 0.90 },
      { pct: 0.68 },
      { pct: 0.84 },
    ]);
    y += 2;

    y = drawBox(ctx, cx, colW, y, [
      { pct: 0.75, bold: true },
      { pct: 0.58 },
    ], accent);

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.93 },
      { pct: 0.62 },
      { pct: 0.86 },
    ]);
    y += 4;

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.70, bold: true },
      { pct: 0.88 },
      { pct: 0.78 },
      { pct: 0.65 },
    ]);
    y += 2;

    y = drawBox(ctx, cx, colW, y, [
      { pct: 0.84 },
      { pct: 0.52 },
    ], accent);

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.72 },
      { pct: 0.93 },
      { pct: 0.60, bold: true },
      { pct: 0.85 },
      { pct: 0.74 },
    ]);
    y += 4;

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.77, bold: true },
      { pct: 0.90 },
      { pct: 0.65 },
    ]);
    y += 2;

    y = drawBox(ctx, cx, colW, y, [
      { pct: 0.68, bold: true },
      { pct: 0.56 },
    ], accent);

    drawLines(ctx, cx, colW, y, [
      { pct: 0.88 },
      { pct: 0.72 },
      { pct: 0.80 },
      { pct: 0.58 },
      { pct: 0.92 },
      { pct: 0.66, bold: true },
    ]);
  }
}

function renderStudyForm(ctx) {
  const accent = ACCENTS['study_form'];
  fillBg(ctx, accent);

  const PAD = 22;
  const CONTENT_Y = PAD + 14;
  const GAP = 8;
  const colW = (W - PAD * 2 - GAP * 2) / 3;

  // Title
  ctx.fillStyle = accent + '22';
  ctx.fillRect(PAD, PAD - 4, W - PAD * 2, 16);
  line(ctx, PAD + 4, PAD + 2, (W - PAD * 2) * 0.44, true);

  for (let col = 0; col < 3; col++) {
    const cx = PAD + col * (colW + GAP);
    let y = CONTENT_Y + 4;

    y = drawLines(ctx, cx, colW, y, [{ pct: 0.78, bold: true }]);
    y += 1;

    y = drawBox(ctx, cx, colW, y, [
      { pct: 0.84, bold: true },
      { pct: 0.68 },
      { pct: 0.58 },
    ], accent);

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.93 },
      { pct: 0.70 },
      { pct: 0.83 },
    ]);
    y += 2;

    y = drawBox(ctx, cx, colW, y, [
      { pct: 0.63, bold: true },
      { pct: 0.78 },
      { pct: 0.73 },
      { pct: 0.52 },
    ], accent);

    y = drawLines(ctx, cx, colW, y, [
      { pct: 0.88 },
      { pct: 0.65 },
      { pct: 0.86 },
    ]);
    y += 2;

    y = drawLines(ctx, cx, colW, y, [{ pct: 0.74, bold: true }]);
    y += 1;

    y = drawBox(ctx, cx, colW, y, [
      { pct: 0.80, bold: true },
      { pct: 0.62 },
      { pct: 0.71 },
    ], accent);

    drawLines(ctx, cx, colW, y, [
      { pct: 0.92 },
      { pct: 0.68 },
      { pct: 0.84 },
      { pct: 0.56, bold: true },
      { pct: 0.78 },
      { pct: 0.90 },
    ]);
  }
}

function renderLectureNotes(ctx) {
  const accent = ACCENTS['lecture_notes'];
  fillBg(ctx, accent);

  const PAD = 24;
  const colW = W - PAD * 2;
  let y = PAD;

  // Document title block
  ctx.fillStyle = accent + '22';
  ctx.fillRect(PAD, y - 2, colW, 18);
  line(ctx, PAD + 4, y + 3, colW * 0.52, true);
  y += 20;

  line(ctx, PAD, y, colW * 0.32);
  y += 12;

  // Learning objectives box
  y = drawBox(ctx, PAD, colW, y, [
    { pct: 0.38, bold: true },
    { pct: 0.82 },
    { pct: 0.74 },
  ], accent, 9);
  y += 4;

  // Section 1 header
  line(ctx, PAD, y, colW * 0.46, true);
  y += 10;

  y = drawLines(ctx, PAD, colW, y, [
    { pct: 0.90 },
    { pct: 0.76 },
    { pct: 0.84 },
  ], 9);
  y += 2;

  // image placeholder
  imgPlaceholder(ctx, PAD, y, colW * 0.72, 28);
  y += 34;

  y = drawLines(ctx, PAD, colW, y, [
    { pct: 0.62 },
    { pct: 0.86 },
  ], 9);
  y += 6;

  // Section 2 header
  line(ctx, PAD, y, colW * 0.50, true);
  y += 10;

  y = drawLines(ctx, PAD, colW, y, [
    { pct: 0.92 },
    { pct: 0.70 },
    { pct: 0.80 },
    { pct: 0.66 },
    { pct: 0.88 },
    { pct: 0.55 },
  ], 9);
  y += 6;

  // Section 3 header
  line(ctx, PAD, y, colW * 0.42, true);
  y += 10;

  y = drawLines(ctx, PAD, colW, y, [
    { pct: 0.84 },
    { pct: 0.72 },
    { pct: 0.91 },
  ], 9);
  y += 6;

  // Summary box at bottom
  divider(ctx, PAD, y, colW);
  y += 8;

  drawBox(ctx, PAD, colW, y, [
    { pct: 0.28, bold: true },
    { pct: 0.86 },
    { pct: 0.68 },
  ], accent, 9);
}

function renderCornell(ctx) {
  const accent = ACCENTS['cornell'];
  fillBg(ctx, accent);
  const PAD = 22;
  const colW = W - PAD * 2;
  let y = PAD;

  // Title
  ctx.fillStyle = accent + '22';
  ctx.fillRect(PAD, y - 2, colW, 16);
  line(ctx, PAD + 4, y + 3, colW * 0.48, true);
  y += 20;

  const cueW = colW * 0.28;
  const notesX = PAD + cueW + 10;
  const notesW = colW - cueW - 10;

  // vertical divider
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD + cueW + 4, y);
  ctx.lineTo(PAD + cueW + 4, H - 46);
  ctx.stroke();

  // Cue column
  drawLines(ctx, PAD, cueW, y, [
    { pct: 0.85, bold: true }, { pct: 0.70 }, { pct: 0.90 }, { pct: 0.60 },
    { pct: 0.80, bold: true }, { pct: 0.75 }, { pct: 0.65 },
    { pct: 0.85, bold: true }, { pct: 0.70 }, { pct: 0.90 }, { pct: 0.60 },
  ], 10);

  // Notes column
  drawLines(ctx, notesX, notesW, y, [
    { pct: 0.95 }, { pct: 0.80 }, { pct: 0.88 }, { pct: 0.72 }, { pct: 0.90 },
  ], 10);
  y += 56;
  imgPlaceholder(ctx, notesX, y, notesW * 0.82, 26);
  y += 32;
  drawLines(ctx, notesX, notesW, y, [
    { pct: 0.75 }, { pct: 0.88 }, { pct: 0.65 }, { pct: 0.92 }, { pct: 0.78 },
  ], 10);

  // Summary box at bottom
  divider(ctx, PAD, H - 42, colW);
  drawBox(ctx, PAD, colW, H - 38, [
    { pct: 0.28, bold: true }, { pct: 0.88 }, { pct: 0.72 },
  ], accent, 9);
}

function renderProblemSolving(ctx) {
  const accent = ACCENTS['problem_solving'];
  fillBg(ctx, accent);
  const PAD = 22;
  const colW = W - PAD * 2;
  let y = PAD;

  // Title
  ctx.fillStyle = accent + '22';
  ctx.fillRect(PAD, y - 2, colW, 16);
  line(ctx, PAD + 4, y + 3, colW * 0.44, true);
  y += 24;

  for (let i = 0; i < 3; i++) {
    const blockH = (H - y - PAD - 8) / 3;
    box(ctx, PAD, y, colW, blockH - 4, accent);
    let by = y + 6;
    line(ctx, PAD + 6, by, colW * 0.28, true); by += 10;
    drawLines(ctx, PAD + 6, colW - 12, by, [{ pct: 0.92 }, { pct: 0.78 }], 9); by += 20;

    const hw = (colW - 18) / 2;
    line(ctx, PAD + 6, by, hw * 0.50, true); by += 9;
    drawLines(ctx, PAD + 6, hw, by, [{ pct: 0.80 }, { pct: 0.65 }], 9);
    line(ctx, PAD + 6 + hw + 6, by - 9, hw * 0.45, true);
    drawLines(ctx, PAD + 6 + hw + 6, hw, by, [{ pct: 0.70 }], 9);
    by += 18;

    box(ctx, PAD + 6, by, colW - 12, 20, null);
    line(ctx, PAD + 10, by + 4, (colW - 20) * 0.32, true);
    drawLines(ctx, PAD + 10, colW - 20, by + 13, [{ pct: 0.85 }, { pct: 0.55 }], 7);

    y += blockH + 2;
  }
}

function renderZettelkasten(ctx) {
  const accent = ACCENTS['zettelkasten'];
  fillBg(ctx, accent);
  const PAD = 22;
  const colW = W - PAD * 2;
  let y = PAD;

  // Title
  line(ctx, PAD, y, colW * 0.44, true); y += 16;

  const cardW = (colW - 8) / 2;
  const cardH = (H - y - PAD - 4) / 2;

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const cx = PAD + col * (cardW + 8);
      const cy = y + row * (cardH + 4);
      box(ctx, cx, cy, cardW, cardH - 2, accent);

      // card ID dot + title
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.beginPath();
      ctx.arc(cx + 8, cy + 8, 4, 0, Math.PI * 2);
      ctx.fill();
      line(ctx, cx + 16, cy + 5, cardW * 0.72, true);

      let ly = cy + 17;
      drawLines(ctx, cx + 6, cardW - 12, ly, [
        { pct: 0.90 }, { pct: 0.72 }, { pct: 0.85 }, { pct: 0.60 },
      ], 9);
      ly += 40;

      // tags
      const tags = [0.26, 0.20, 0.28];
      let tx = cx + 6;
      for (const tw of tags) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(tx, ly, cardW * tw, 6, 3);
        ctx.fill();
        tx += cardW * tw + 4;
      }
    }
  }
}

function renderAcademicPaper(ctx) {
  const accent = ACCENTS['academic_paper'];
  fillBg(ctx, accent);
  const PAD = 22;
  const colW = W - PAD * 2;
  let y = PAD;

  // Title + authors
  ctx.fillStyle = accent + '22';
  ctx.fillRect(PAD, y - 2, colW, 16);
  line(ctx, PAD + 4, y + 3, colW * 0.62, true);
  y += 20;
  line(ctx, PAD, y, colW * 0.42); y += 12;

  // Abstract box
  y = drawBox(ctx, PAD, colW, y, [
    { pct: 0.28, bold: true }, { pct: 0.95 }, { pct: 0.88 }, { pct: 0.72 },
  ], accent, 9);
  y += 6;

  // Two-column body
  const hw = (colW - 8) / 2;
  for (let col = 0; col < 2; col++) {
    const cx = PAD + col * (hw + 8);
    let cy = y;
    cy = drawLines(ctx, cx, hw, cy, [
      { pct: 0.55, bold: true }, { pct: 0.90 }, { pct: 0.78 }, { pct: 0.85 },
    ], 9);
    cy += 2;
    cy = drawBox(ctx, cx, hw, cy, [{ pct: 0.70, bold: true }], accent, 9);
    cy = drawLines(ctx, cx, hw, cy, [
      { pct: 0.92 }, { pct: 0.68 }, { pct: 0.80 },
    ], 9);
    cy += 2;
    if (col === 0) imgPlaceholder(ctx, cx, cy, hw * 0.88, 22);
    else drawLines(ctx, cx, hw, cy, [{ pct: 0.88, bold: true }, { pct: 0.75 }, { pct: 0.90 }], 9);
  }
}

function renderLabReport(ctx) {
  const accent = ACCENTS['lab_report'];
  fillBg(ctx, accent);
  const PAD = 22;
  const colW = W - PAD * 2;
  let y = PAD;

  // Title
  ctx.fillStyle = accent + '22';
  ctx.fillRect(PAD, y - 2, colW, 16);
  line(ctx, PAD + 4, y + 3, colW * 0.52, true);
  y += 20;
  line(ctx, PAD, y, colW * 0.38); y += 14;

  // Introduction
  line(ctx, PAD, y, colW * 0.36, true); y += 10;
  drawLines(ctx, PAD, colW, y, [{ pct: 0.90 }, { pct: 0.78 }, { pct: 0.85 }], 9); y += 32;

  // Setup diagram
  imgPlaceholder(ctx, PAD, y, colW, 32); y += 38;

  // Data table
  line(ctx, PAD, y, colW * 0.28, true); y += 10;
  const cols = [0.35, 0.22, 0.22, 0.21];
  // header
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(PAD, y, colW, 12);
  ctx.strokeStyle = BOX_BORDER; ctx.lineWidth = 1;
  ctx.strokeRect(PAD, y, colW, 12);
  let hx = PAD;
  for (const cw of cols) {
    ctx.fillStyle = LINE_BOLD;
    ctx.beginPath(); ctx.roundRect(hx + 3, y + 4, colW * cw * 0.6, 3, 1.5); ctx.fill();
    hx += colW * cw;
  }
  y += 12;
  for (let row = 0; row < 3; row++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.strokeRect(PAD, y, colW, 10);
    let rx = PAD;
    for (const cw of cols) {
      ctx.fillStyle = LINE_NORMAL;
      ctx.beginPath(); ctx.roundRect(rx + 3, y + 3, colW * cw * 0.55, 3, 1.5); ctx.fill();
      rx += colW * cw;
    }
    y += 10;
  }
  y += 8;

  // Analysis
  line(ctx, PAD, y, colW * 0.33, true); y += 10;
  drawLines(ctx, PAD, colW, y, [{ pct: 0.88 }, { pct: 0.72 }], 9);
}

function renderDataAnalysis(ctx) {
  const accent = ACCENTS['data_analysis'];
  fillBg(ctx, accent);
  const PAD = 22;
  const colW = W - PAD * 2;
  let y = PAD;

  // Title
  ctx.fillStyle = accent + '22';
  ctx.fillRect(PAD, y - 2, colW, 16);
  line(ctx, PAD + 4, y + 3, colW * 0.50, true);
  y += 20;

  // Methodology
  line(ctx, PAD, y, colW * 0.40, true); y += 10;
  drawLines(ctx, PAD, colW, y, [{ pct: 0.90 }, { pct: 0.76 }, { pct: 0.84 }], 9); y += 32;

  // Chart placeholder (wide)
  imgPlaceholder(ctx, PAD, y, colW, 40); y += 46;

  // Results — two mini tables side by side
  const hw = (colW - 8) / 2;
  for (let col = 0; col < 2; col++) {
    const cx = PAD + col * (hw + 8);
    line(ctx, cx, y, hw * 0.45, true);
    let ty = y + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(cx, ty, hw, 10);
    ctx.strokeStyle = BOX_BORDER; ctx.lineWidth = 1;
    ctx.strokeRect(cx, ty, hw, 10);
    ty += 10;
    for (let r = 0; r < 3; r++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeRect(cx, ty, hw, 9);
      ctx.fillStyle = LINE_NORMAL;
      ctx.beginPath(); ctx.roundRect(cx + 3, ty + 3, hw * 0.55, 3, 1.5); ctx.fill();
      ty += 9;
    }
  }
  y += 52;

  // Conclusions
  line(ctx, PAD, y, colW * 0.38, true); y += 10;
  drawLines(ctx, PAD, colW, y, [{ pct: 0.88 }, { pct: 0.70 }, { pct: 0.82 }], 9);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const RENDERERS = {
  '2cols_portrait':       render2ColsPortrait,
  'landscape_3col_maths': renderLandscape3Col,
  'study_form':           renderStudyForm,
  'lecture_notes':        renderLectureNotes,
  'cornell':              renderCornell,
  'problem_solving':      renderProblemSolving,
  'zettelkasten':         renderZettelkasten,
  'academic_paper':       renderAcademicPaper,
  'lab_report':           renderLabReport,
  'data_analysis':        renderDataAnalysis,
};

for (const [id, renderFn] of Object.entries(RENDERERS)) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  renderFn(ctx);

  const outPath = path.join(OUT_DIR, `${id}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);

  const kb = (buffer.length / 1024).toFixed(1);
  console.log(`  [OK] ${id}.png  (${kb} KB)`);
}

console.log(`\nDone — ${Object.keys(RENDERERS).length} thumbnails written to public/templates/thumbnails/`);
