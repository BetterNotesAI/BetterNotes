# STATUS — BetterNotes v2

> Estado actual del proyecto en una lectura rápida.
> Actualizado por el director al inicio y cierre de cada sesión.

---

## Estado actual

**Fase:** 3 — Visor Interactivo — COMPLETA ✅ (2026-03-28) + extensiones de sesión 2026-03-31
**Milestone activo:** ninguno — sesión 2026-03-31 cerrada. Siguiente: F4-M1 Problem Solver
**Tarea activa:** ninguna
**Último hito cerrado:** F3-M5 ✅ (2026-03-28) + visor PDF-like + AI document-level edits (2026-03-31)
**Fases cerradas:** Fase 2 ✅ (2026-03-26) · Fase 3 ✅ (2026-03-28)
**Rama activa:** main (commits d1c00c6, d5f1668 mergeados)
**Sesión cerrada:** 2026-03-31
**Bloqueantes:** ninguno técnico.

**Completado sesión 2026-03-31:**
- Visor PDF-like con perfiles de plantilla (`lib/template-profiles.ts`): TemplateProfile interface con geometría, tipografía, colores, layout y chrome para las 4 plantillas activas + default. Layout A4 blanco sobre fondo neutro (estilo PDF viewer real). Zoom via `transform: scale()` con wrapper two-div para scroll height correcto. CSS custom properties inyectadas por plantilla.
- Mejoras A-E al visor: (A) `lib/katex-macros.ts` constante compartida, (B) preview KaTeX en chips BlockReference, (C) contadores undo/redo en toolbar, (D) scroll automático al bloque editado tras Apply, (E) fix replace Nth-occurrence para bloques con latex_source idéntico.
- Fixes del reviewer: zoom wrapper con altura visual explícita, FormatToolbar dentro de !hideToolbar, IDs duplicados en multicols corregidos, botón redo usa redoCount state, fix color texto negro sobre hoja blanca.
- AI edita el documento vía prompts del chat: método `editDocument()` en AIProvider con JSON mode (clasifica entre edición de documento y respuesta conversacional), ruta `POST /latex/edit-document` en app-api, route handler `POST /api/documents/[id]/chat-edit` en app-web, LatexViewer prop `pendingDocumentEdit` con banner "AI preview" + outline indigo, ChatPanel con `DocumentEditPreviewCard` (Apply/Discard), page.tsx con estado y wiring completo.

**Pendiente operacional (no bloqueante para Fase 4):**
- Aplicar migración SQL de F3-M5 en Supabase Dashboard (is_published, published_at, university, degree, subject, visibility, keywords[])
- Añadir OPENAI_API_KEY a las variables de entorno de Vercel
- Rebuildar imagen Docker de app-api para incluir endpoints `/latex/edit-document` (o usar `npm run dev` directamente)

**Calidad de AI edits:** funcional pero parcial — la IA no siempre aplica cambios en todas las instancias del documento. Pendiente mejora en próxima sesión o como parte de F4.

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

*Última actualización: 2026-03-31 (cierre de sesión) — Sesión post-F3: visor PDF-like con perfiles de plantilla, mejoras A-E al visor interactivo, AI document-level edit con preview/confirm/discard. Commits: d1c00c6, d5f1668. Rama main actualizada. Siguiente: F4-M1 Problem Solver.*
