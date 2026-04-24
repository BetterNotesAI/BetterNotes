# STATUS — BetterNotes v2

> Estado actual del proyecto en una lectura rápida.
> Actualizado por el director al inicio y cierre de cada sesión.

---

## Estado actual

**Fase:** 5 — Comunidad y Descubrimiento — EN PROGRESO
**Milestone activo:** ninguno — Community v1 (F5-M1, F5-M2, F6-M1 + extras) mergeado a main (2026-04-24)
**Tarea activa:** ninguna. Siguiente: F5-M3 (búsqueda semántica), F4-M1 (Problem Solver), o IA-M3 (multi-modelo)
**Último hito cerrado:** Community v1 ✅ — catálogo UC3M, publish flow, My Studies, explore pages, perfil público
**Fases cerradas:** Fase 2 ✅ (2026-03-26) · Fase 3 ✅ (2026-03-28)
**Rama activa:** main (merge completado 2026-04-24)
**Bloqueantes:** ninguno técnico.

**Sesion 2026-04-24 — cerrada:**
- Community v1 completo: catálogo UC3M (177 programas, 7.625 cursos), publish flow con selects en cascada, My Studies árbol navegable, explore pages por curso, perfil público con stats
- Generic seed script `seed-university.mjs` — añadir nueva universidad = un JSON + un comando
- Author attribution en community cards (AuthorChip → /profile/[userId])
- Sidebar: My Studies activo. Fork-to-chat gate para no propietarios.
- PRs mergeados: feature/community-v1, feature/profile-page

**Sesion 2026-04-01 — cerrada:**
- Verificacion funcional de IA-M1 e IA-M2 completada — sin blockers
- Fix bug color ecuaciones: `\textcolor{color}{text}` en parrafos renderiza `<span style="color:...">` en LatexBlock.tsx. Prompts de IA actualizados.
- Merge session/2026-03-30 → main (commit 4ece957)
- Pendiente operacional documentado en `.claude/reports/operational-pending-2026-04-01.md`

**Sesion 2026-03-31 — cerrada:**
- Visor PDF-like + perfiles de plantilla, mejoras A-E, AI document-level edits, IA-M1 y IA-M2

**Pendiente operacional (manual — ver `.claude/reports/operational-pending-2026-04-01.md`):**
- `git push origin main` (usuario)
- Añadir OPENAI_API_KEY a Vercel/Railway
- Rebuildar imagen Docker de app-api en Railway
- Aplicar migración SQL de F3-M5 en Supabase Dashboard

**Calidad de AI edits:** funcional pero parcial — la IA no siempre aplica cambios en todas las instancias del documento. Pendiente mejora como parte de F4.

---

## Fase 2 — CERRADA ✅ 2026-03-26

Todos los milestones de Fase 2 completados:
- F2-M1: Diagnóstico visual + propuesta de diseño ✅
- F2-M2: Rediseño visual y estructura de navegación ✅
- F2-M3: Organización de documentos ✅
- F2-M4: Subida de archivos como contexto IA ✅
- F2-M2b: Navegación, UX y flujo del producto ✅
- F2-M5: Auth refinements + Google OAuth ✅ (M5.1 verificado en producción 2026-03-26)
- F2-M6: Nueva sidebar + All Documents revamp ✅
- F2-M7: Templates revamp ✅

---

## Fase 3 — VISOR INTERACTIVO ⭐

Feature estratégica más importante del roadmap.

El workspace `/workspace/[id]` se convierte en el visor interactivo.
Los modos de vista actuales (PDF / PDF+LaTeX / LaTeX) se ocultan en la UI
pero el código permanece intacto como fallback.

Arquitectura: patrón Typora — documento renderizado con KaTeX, click en fragmento
para editar el LaTeX subyacente, re-renderiza al confirmar. Sin block editor externo.

**Milestones F3:**
- [x] F3-M1 — Arquitectura + PoC — COMPLETADO (2026-03-26)
- [x] F3-M2 — Renderizado base — COMPLETADO (2026-03-26 sesion 3)
- [x] F3-M3 — Interactividad (patrón Typora) — COMPLETADO (2026-03-27)
- [x] F3-M4 — Chat contextual — COMPLETADO (2026-03-28)
- [x] F3-M5 — Publish to My Studies + polish — COMPLETADO (2026-03-28)

**Fase 3: COMPLETA ✅ (2026-03-28)** — pendiente verificación en navegador + merge a main

---

## Visión estratégica — "GitHub para estudiantes STEM"

El valor diferencial de BetterNotes no es solo la generación de notas con IA — es la intersección de tres elementos que ningún competidor tiene juntos:
1. **IA que maneja notación STEM fluentemente** (LaTeX/KaTeX) — raro en el mercado
2. **Biblioteca de contenido organizada** por universidad → grado → asignatura → tema
3. **Efectos de red**: más estudiantes → más contenido → mejor búsqueda → más estudiantes

El roadmap actualizado prioriza construir esta plataforma de contenido académico estructurado, con herramientas de retención (repetición espaciada, planificador de estudio) y una capa institucional (herramientas para profesores, licencias universitarias) como vía de monetización real a escala.

**Fases añadidas (2026-04-15):**
- Fase 5 ampliada — Catálogo de cursos + búsqueda semántica + reputación + fork/remix
- Fase 8 — Retención y hábito (repetición espaciada, planificador, rachas)
- Fase 9 — Colaboración (grupos de estudio, co-edición, importación)
- Fase 10 — Institucional (herramientas para profesores, licencias universitarias, LMS)

---

## Decisiones activas a recordar

| Decisión | Valor |
|----------|-------|
| Visor interactivo | Patrón Typora sobre LaTeX existente — sin block editor externo |
| Rendering fórmulas | KaTeX en frontend (preview interactivo) |
| Parser LaTeX | Manual (regex + split) en `lib/latex-parser.ts` — sin librerías externas |
| Datos del visor | On-the-fly desde `document_versions.latex_source` — sin tabla `document_blocks` |
| Macros KaTeX custom | `\dd`, `\real`, `\cplex` declaradas vía `macros` en KaTeX |
| PDF final | pdflatex en backend Express — sin cambios |
| Modos de vista actuales | Ocultos en UI, código intacto como fallback |
| Workspace | `/workspace/[id]` se convierte en el visor interactivo |
| Prompt al workspace | Vía `?prompt=` URL param — no localStorage |
| Componentes compartidos landing/app | Fuera de `(app)/` en `app/_components/` |
| Popovers | Siempre `createPortal` z-9999 si hay riesgo de clipping |
| Auth | `@supabase/ssr` SSR-safe |
| IA | OpenAI gpt-4o-mini vía AIProvider interface desacoplada |
| Auto-template | templateId `'auto'` → app-api llama gpt-4o-mini para elegir; actualiza DB con el ID resuelto |

---

*Última actualización: 2026-04-24 — Community v1 completado y mergeado. F5-M1 (catálogo), F5-M2 (publish flow), F6-M1 (perfil público) implementados. Generic seed script para nuevas universidades. Ver TASKS.md para detalle completo.*
