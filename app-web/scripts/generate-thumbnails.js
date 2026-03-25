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

// ── Main ──────────────────────────────────────────────────────────────────────

const RENDERERS = {
  '2cols_portrait':       render2ColsPortrait,
  'landscape_3col_maths': renderLandscape3Col,
  'study_form':           renderStudyForm,
  'lecture_notes':        renderLectureNotes,
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
