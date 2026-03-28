# STATUS — BetterNotes v2

> Estado actual del proyecto en una lectura rápida.
> Actualizado por el director al inicio y cierre de cada sesión.

---

## Estado actual

**Fase:** 3 — Visor Interactivo — COMPLETA ✅ (2026-03-28)
**Milestone activo:** ninguno — Fase 3 cerrada. Pendiente apertura Fase 4.
**Tarea activa:** verificar visor interactivo end-to-end en navegador antes de merge a main
**Último hito cerrado:** F3-M5 — Publish to My Studies + polish ✅ (2026-03-28)
**Fases cerradas:** Fase 2 ✅ (2026-03-26) · Fase 3 ✅ (2026-03-28)
**Rama activa:** f3-m4-chat-contextual (SIN merge a main — pendiente verificación)
**Bloqueantes:** ninguno técnico. Pendiente de verificación manual en navegador.

**Pendiente crítico antes de mergear a main:**
- Verificar en navegador que el visor interactivo funciona end-to-end: edición de bloques (patrón Typora), chat contextual con chip de referencia, Apply/Discard de sugerencias IA, undo/redo (Ctrl+Z/Y)
- Verificar que "Saved X ago" aparece en header tras Apply
- Verificar PublishModal y My Studies page

**Pendiente operacional (no bloqueante para Fase 4):**
- Aplicar migración SQL de F3-M5 en Supabase Dashboard (is_published, published_at, university, degree, subject, visibility, keywords[])
- Añadir OPENAI_API_KEY a las variables de entorno de Vercel

**Completado sesión 2026-03-28:**
- F3-M4: chip visual BlockReference, preview KaTeX en BlockEditPreviewCard, Apply/Discard con actualización optimista, /api/documents/[id]/edit-block, undo/redo hasta 20 estados (Ctrl+Z/Y/Shift+Z)
- F3-M5: migración SQL publish, POST /publish, POST /suggest-keywords (GPT-4o directo desde Next.js), GET /api/documents/published, PublishModal.tsx (keywords chips + AI suggest), botón Publish en header workspace, My Studies page grid, accesibilidad LatexBlock (tabIndex/role/aria/Enter), skeleton loader visor, "Saved X ago" en header (onApplyPersisted), transition-opacity al cambiar viewerTab

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

*Última actualización: 2026-03-28 (cierre de sesión) — Fase 3 COMPLETA. F3-M4 (chat contextual: chip BlockReference, preview KaTeX, Apply/Discard optimista, edit-block endpoint, undo/redo Ctrl+Z/Y) y F3-M5 (Publish modal, suggest-keywords GPT-4o, My Studies page, skeleton loader, "Saved X ago", accesibilidad LatexBlock) completados. Rama activa: f3-m4-chat-contextual — pendiente verificación en navegador antes de merge a main. Siguiente: abrir Fase 4 (F4-M1 Problem Solver) tras verificación y merge.*
