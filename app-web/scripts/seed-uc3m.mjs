/**
 * BetterNotes — UC3M seed script
 *
 * Reads ../DataBase_Univ/baseDatosUC3M_selenium.json and inserts:
 *   1 university → 177 degree programmes → 7,625 courses
 *
 * Usage (run from repo root):
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node app-web/scripts/seed-uc3m.mjs
 *
 * Safe to re-run — uses upsert on unique slugs.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────────
const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE                = 500;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

async function batchInsert(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { ignoreDuplicates: false });
    if (error) throw new Error(`${table} batch ${i}: ${error.message}`);
    process.stdout.write(`  ${table}: inserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ✓ ${table}: ${rows.length} rows`);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  // JSON is two levels up from app-web/scripts/
  const jsonPath = join(__dirname, '../../DataBase_Univ/baseDatosUC3M_selenium.json');
  const raw = readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  const uniData = data.universidades[0];

  console.log(`\n🎓  Seeding: ${uniData.nombre_universidad}`);
  console.log(`    Programs: ${uniData.programas.length}`);

  // ── 1. Upsert university ──────────────────────────────────
  const { data: uniRow, error: uniErr } = await supabase
    .from('universities')
    .upsert(
      { name: uniData.nombre_universidad, slug: 'uc3m', country: 'ES', logo_url: null },
      { onConflict: 'slug' }
    )
    .select('id')
    .single();

  if (uniErr) throw new Error(`university upsert: ${uniErr.message}`);
  const universityId = uniRow.id;
  console.log(`  ✓ universities: 1 row  (id: ${universityId})`);

  // ── 2. Build & upsert degree programmes ──────────────────
  const slugCount = {};
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
      tipo:  p.tipo,
      title: p.titulo.trim(),
      slug,
      url:   p.url ?? null,
    };
  });

  const { data: insertedPrograms, error: progErr } = await supabase
    .from('degree_programs')
    .upsert(programRows, { onConflict: 'university_id,slug' })
    .select('id, slug');

  if (progErr) throw new Error(`degree_programs upsert: ${progErr.message}`);
  console.log(`  ✓ degree_programs: ${insertedPrograms.length} rows`);

  // slug → id map for course linking
  const programIdBySlug = Object.fromEntries(insertedPrograms.map((r) => [r.slug, r.id]));
  const orderedProgramIds = programRows.map((r) => programIdBySlug[r.slug]);

  // ── 3. Build & batch-insert courses ──────────────────────
  const courseRows = [];
  uniData.programas.forEach((p, pIdx) => {
    const programId = orderedProgramIds[pIdx];
    if (!programId) return;
    for (const [yearKey, yearData] of Object.entries(p.plan_estudios)) {
      const year = parseInt(yearKey.replace('año_', ''), 10);
      for (const [semKey, courses] of Object.entries(yearData)) {
        // Standard: "cuatrimestre_1" → semester=1
        // Non-standard: "Módulo I: ..." → semester=null, semester_label=key
        const isCuatrimestre = /^cuatrimestre_\d+$/.test(semKey);
        const semester = isCuatrimestre
          ? parseInt(semKey.replace('cuatrimestre_', ''), 10)
          : null;
        const semester_label = isCuatrimestre ? null : semKey;

        for (const c of courses) {
          courseRows.push({
            degree_program_id: programId,
            year,
            semester,
            semester_label,
            name:  c.asignatura?.trim() ?? 'Unknown',
            ects:  c.ects ?? null,
            tipo:  c.tipo ?? null,
          });
        }
      }
    }
  });

  console.log(`\n📚  Inserting ${courseRows.length} courses in batches of ${BATCH_SIZE}...`);
  await batchInsert('courses', courseRows);

  console.log(`\n✅  Done! UC3M catalogue is live.\n`);
}

main().catch((err) => {
  console.error('\n❌ ', err.message);
  process.exit(1);
});
