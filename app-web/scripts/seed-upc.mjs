/**
 * BetterNotes — UPC seed script
 *
 * Seeds Universitat Politècnica de Catalunya (UPC) from normalized_UPC.json.
 * Handles UPC's non-standard curriculum structures:
 *   - Standard:  año_X → cuatrimestre_X → [courses]
 *   - Nested:    itinerario_X / mencion_X / especialidad_X / track_X / ... → año_X → cuatrimestre_X → [courses]
 *   - Flat:      cuatrimestre_X → [courses]  (top-level, no year grouping)
 *   - Optativas: optativas_disponibles → [courses]  (pooled electives, stored as year=0)
 *
 * Duplicate course names within the same programme are deduplicated — only the
 * first occurrence is kept (avoids storing identical rows from overlapping tracks).
 *
 * Usage (run from repo root):
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node app-web/scripts/seed-upc.mjs
 *
 * Safe to re-run — deletes existing UPC data first, then re-inserts.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE                = 500;
const UNIV_SLUG                 = 'upc';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

async function batchInsert(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`${table} batch ${i}: ${error.message}`);
    process.stdout.write(`  ${table}: inserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  console.log(`  done ${table}: ${rows.length} rows`);
}

/**
 * Recursively extract courses from a plan_estudios node.
 * Handles arbitrary nesting depth by checking whether a value looks like an
 * array of course objects or a sub-tree to recurse into.
 *
 * @param {object} node       - current sub-tree (plan_estudios or sub-object)
 * @param {number} depth      - recursion depth (0 = plan_estudios level)
 * @param {number|null} year  - year resolved from parent año_X key (null if unknown)
 * @param {number|null} sem   - semester resolved from cuatrimestre_X key (null if unknown)
 * @param {string|null} label - semester_label for non-standard groupings
 * @returns {{ year, semester, semester_label, name, ects, tipo }[]}
 */
function extractCourses(node, depth = 0, year = null, sem = null, label = null) {
  if (!node || typeof node !== 'object') return [];

  // If it's an array, it should be a list of course objects
  if (Array.isArray(node)) {
    return node
      .filter(c => c && typeof c === 'object' && c.asignatura)
      .map(c => ({
        year:           year ?? 0,
        semester:       sem,
        semester_label: label,
        name:           c.asignatura.trim(),
        ects:           typeof c.ects === 'number' ? c.ects : null,
        tipo:           c.tipo ?? null,
      }));
  }

  // It's a plain object — iterate keys and classify each
  const results = [];
  for (const [key, value] of Object.entries(node)) {
    const añoMatch  = key.match(/^año_(\d+)$/);
    const semMatch  = key.match(/^cuatrimestre_(\d+)$/);
    const isOptivas = key === 'optativas_disponibles';

    if (añoMatch) {
      // Standard year grouping — resolve year, keep descending
      const resolvedYear = parseInt(añoMatch[1], 10);
      results.push(...extractCourses(value, depth + 1, resolvedYear, sem, label));
    } else if (semMatch) {
      // Standard semester grouping — resolve semester, keep descending
      const resolvedSem = parseInt(semMatch[1], 10);
      results.push(...extractCourses(value, depth + 1, year, resolvedSem, null));
    } else if (isOptivas) {
      // Elective pool — store with year=0, no semester
      results.push(...extractCourses(value, depth + 1, 0, null, 'Optativas'));
    } else if (Array.isArray(value) && value.length > 0 && value[0]?.asignatura) {
      // Unlabelled array of courses at this level
      results.push(...extractCourses(value, depth + 1, year ?? 0, sem, label));
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Some other grouping key (itinerario, mencion, especialidad, track, plan, …)
      // Store it as a semester_label so it's queryable, then recurse
      const resolvedLabel = label ?? key;
      results.push(...extractCourses(value, depth + 1, year, sem, resolvedLabel));
    }
    // strings (like standalone "asignatura" meta-keys at some levels) are ignored
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const jsonPath = join(__dirname, '../../DataBase_Univ/normalized_UPC.json');
  console.log(`\nReading: ${jsonPath}`);

  const raw     = readFileSync(jsonPath, 'utf8');
  const data    = JSON.parse(raw);
  const uniData = data.universidades[0];

  console.log(`Seeding: ${uniData.nombre_universidad}  (slug: ${UNIV_SLUG})`);
  console.log(`Programs: ${uniData.programas.length}`);

  // ── 1. Upsert university ─────────────────────────────────────────────────
  const { data: uniRow, error: uniErr } = await supabase
    .from('universities')
    .upsert(
      {
        name:     uniData.nombre_universidad,
        slug:     UNIV_SLUG,
        country:  'ES',
        logo_url: null,
      },
      { onConflict: 'slug' },
    )
    .select('id')
    .single();

  if (uniErr) throw new Error(`university upsert: ${uniErr.message}`);
  const universityId = uniRow.id;
  console.log(`  done universities: 1 row  (id: ${universityId})`);

  // ── 2. Delete existing programs+courses for this university ──────────────
  // degree_programs CASCADE deletes courses automatically
  const { error: delErr } = await supabase
    .from('degree_programs')
    .delete()
    .eq('university_id', universityId);
  if (delErr) throw new Error(`delete degree_programs: ${delErr.message}`);
  console.log('  existing programs+courses cleared');

  // ── 3. Build & insert degree programmes ─────────────────────────────────
  const slugCount  = {};
  const programRows = uniData.programas.map((p) => {
    let slug = slugify(p.titulo);
    if (slugCount[slug] !== undefined) {
      slugCount[slug]++;
      slug = `${slug}-${slugCount[slug]}`;
    } else {
      slugCount[slug] = 0;
    }
    return {
      university_id: universityId,
      tipo:          p.tipo,
      title:         p.titulo.trim(),
      slug,
      url:           p.url ?? null,
    };
  });

  const { data: insertedPrograms, error: progErr } = await supabase
    .from('degree_programs')
    .insert(programRows)
    .select('id, slug');

  if (progErr) throw new Error(`degree_programs insert: ${progErr.message}`);
  console.log(`  done degree_programs: ${insertedPrograms.length} rows`);

  // slug → id
  const programIdBySlug     = Object.fromEntries(insertedPrograms.map((r) => [r.slug, r.id]));
  const orderedProgramIds   = programRows.map((r) => programIdBySlug[r.slug]);

  // ── 4. Build course rows ─────────────────────────────────────────────────
  const courseRows = [];
  let   skipped    = 0;

  uniData.programas.forEach((p, pIdx) => {
    const programId = orderedProgramIds[pIdx];
    if (!programId) { skipped++; return; }

    // Extract all courses recursively
    const courses = extractCourses(p.plan_estudios);

    // Deduplicate by name within the programme (keep first occurrence)
    const seen = new Set();
    for (const c of courses) {
      const key = c.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      courseRows.push({ degree_program_id: programId, ...c });
    }
  });

  if (skipped > 0) console.warn(`  warning: ${skipped} programmes had no resolved id`);
  console.log(`\nInserting ${courseRows.length} courses in batches of ${BATCH_SIZE}...`);
  await batchInsert('courses', courseRows);

  console.log(`\nDone! ${uniData.nombre_universidad} catalogue is live.\n`);
  console.log(`  Summary: 1 university · ${insertedPrograms.length} programmes · ${courseRows.length} courses`);
}

main().catch((err) => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
