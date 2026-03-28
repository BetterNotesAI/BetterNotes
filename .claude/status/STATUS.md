# STATUS — BetterNotes v2

> Estado actual del proyecto en una lectura rápida.
> Actualizado por el director al inicio y cierre de cada sesión.

---

## Estado actual

**Fase:** 3 — Visor Interactivo (+ mejoras UI/UX en paralelo)
**Milestone activo:** F3-M5 — Publish to My Studies + polish COMPLETADO ✅ (2026-03-28)
**Tarea activa:** ninguna — Fase 3 completa, pendiente cierre de fase
**Último hito cerrado:** F3-M5 — Publish to My Studies + polish ✅ (2026-03-28)
**Fase cerrada:** Fase 2 — Cierre y Refinamiento ✅ (2026-03-26)
**Rama activa:** main
**Bloqueantes:** ninguno.
**Completado hoy (2026-03-28):** F3-M5 — migración SQL publish, endpoint POST /publish, POST /suggest-keywords (GPT-4o directo), PublishModal.tsx con keywords chips + AI suggest, botón Publish en header workspace, My Studies page grid, accesibilidad LatexBlock (tabIndex/role/aria/Enter), skeleton loader visor, "Saved X ago" header.

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
- [ ] F3-M4 — Chat contextual ← PRÓXIMO
- [ ] F3-M5 — Publish to My Studies + polish

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

*Última actualización: 2026-03-27 (cierre de sesión) — F3-M3 completado: interactividad patrón Typora (M3.1–M3.7): hover highlight, focused state, edición inline LaTeX, re-render KaTeX, context menu "Reference in chat", toolbar de formato, auto-detección de bloque. Fix KaTeX entornos \begin{align*} etc. Conexión onReferenceInChat con ChatPanel (prefillText). data-block-id en todos los wrappers. Fixes adicionales de sesión: Download PDFs ZIP (fflate), folderBadge DocumentCard, overflow detection useLayoutEffect, scroll-close. Mergeado a main. Commits: 481bf42, 258dc20, 3bd901e, 34aee68. Siguiente milestone: F3-M4 — Chat contextual.*
