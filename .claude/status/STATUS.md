# STATUS — BetterNotes v2

> Estado actual del proyecto en una lectura rápida.
> Actualizado por el director al inicio y cierre de cada sesión.

---

## Estado actual

**Fase:** 3 — Visor Interactivo (+ mejoras UI/UX en paralelo)
**Milestone activo:** F3-M3 — Interactividad (patrón Typora) — en progreso
**Tarea activa:** fixes previos al inicio de F3-M3 — completados (2026-03-27)
**Último hito cerrado:** F3-M2 — Renderizado base ✅ (2026-03-26 sesion 3)
**Fase cerrada:** Fase 2 — Cierre y Refinamiento ✅ (2026-03-26)
**Rama activa:** f3-m3-interactivity
**Bloqueantes:** ninguno.
**Fixes aplicados (2026-03-27):** KaTeX env rendering (align*, equation*, gather*), onReferenceInChat wired (LatexViewer → ChatPanel prefillText), data-block-id en todos los wrappers de LatexBlock. Commit: 3bd901e.

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
- [x] F3-M2 — Renderizado base — COMPLETADO (2026-03-26 sesion 3) — pendiente próxima sesión: KaTeX/LaTeX rendering issues en ecuaciones
- [ ] F3-M3 — Interactividad (patrón Typora) ← PRÓXIMO
- [ ] F3-M4 — Chat contextual
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

*Última actualización: 2026-03-27 — Fixes post-F3-M2: bug Download PDFs resuelto (ZIP con fflate), folderBadge en DocumentCard (starred y loose docs muestran carpeta de origen), menús 3-dots con overflow detection (useLayoutEffect) y scroll-close en DocumentCard y FolderSectionMenu. Rama activa: f3-m3-interactivity. Siguiente milestone: F3-M3 — Interactividad (patrón Typora).*
