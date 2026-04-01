# STATUS — BetterNotes v2

> Estado actual del proyecto en una lectura rápida.
> Actualizado por el director al inicio y cierre de cada sesión.

---

## Estado actual

**Fase:** 3 — Visor Interactivo — COMPLETA ✅ (2026-03-28) + extensiones IA-M1/M2
**Milestone activo:** ninguno — IA-M1 e IA-M2 verificados y mergeados a main (2026-04-01)
**Tarea activa:** ninguna. Siguiente: F4-M1 Problem Solver o IA-M3 multi-modelo
**Último hito cerrado:** IA-M2 ✅ — gestión dinámica de bloques
**Fases cerradas:** Fase 2 ✅ (2026-03-26) · Fase 3 ✅ (2026-03-28)
**Rama activa:** main (merge completado 2026-04-01, commit 4ece957)
**Bloqueantes:** ninguno técnico.

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

*Última actualización: 2026-04-01 (cierre de sesión) — IA-M1 e IA-M2 verificados sin blockers. Fix color ecuaciones LaTeX (\textcolor en parrafos). Merge session/2026-03-30 → main (commit 4ece957). Pendientes operacionales documentados. Siguiente: F4-M1 Problem Solver (confirmar al inicio de proxima sesion).*
