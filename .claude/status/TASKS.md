# Tasks — BetterNotes

_Última actualización: 2026-04-26 — Legal pages (Terms of Use, Privacy Policy, Cookie Policy) publicadas con contenido completo. Pendientes legales identificados y añadidos abajo._
_Roadmap ampliado con visión estratégica de producto. Fase 5 expandida (catálogo de cursos, búsqueda semántica, reputación, fork/remix). Fases 8-10 añadidas (retención, colaboración, institucional). Ver STATUS.md para contexto estratégico completo._

---

## Legal — Pendientes a completar

> Todos los `[PENDING TO COMPLETE]` identificados en los PDFs legales (Terms of Use, Privacy Policy, Cookie Policy). Bloqueados hasta que se tenga la información societaria definitiva (CIF, domicilio) o se tome la decisión de producto correspondiente.

### Información societaria (bloquea los 3 documentos)

- [ ] **Last updated** — fecha de las tres políticas (Terms, Privacy, Cookie)
- [ ] **Tax ID / CIF** — CIF de BETTERNOTES SL (aparece en los 3 docs)
- [ ] **Registered address** — domicilio social registrado (aparece en los 3 docs)
- [ ] **Contact email** — email general de contacto (aparece en los 3 docs)
- [ ] **Privacy email** — email específico de privacidad/DPO (aparece en los 3 docs)

### Terms of Use — pendientes específicos

- [ ] **Section 3 — Minimum user age** — decidir y confirmar la edad mínima (Privacy Policy dice 14 per LOPDGDD; confirmar consistencia)
- [ ] **Section 12 — Default publication setting** — documentar si el contenido se crea privado o público por defecto
- [ ] **Section 15 — Current plan/pricing page URL** — añadir URL de la página de precios una vez publicada
- [ ] **Section 17 — Right of Withdrawal** — completar con texto definitivo una vez diseñado el checkout/subscription flow (actualmente placeholder)

### Privacy Policy — pendientes específicos

- [ ] **Section 12 — Specific retention periods** — definir periodos de retención concretos por tipo de dato (ej. logs: 90 días, billing: 7 años por Hacienda, etc.)
- [ ] **Section 18 — Default privacy setting for user content** — confirmar y documentar si el contenido de usuario es privado por defecto

### Cookie Policy — pendientes específicos

- [ ] **Section 7.1 — Cookie Settings tool** — implementar el banner/herramienta de gestión de cookies y añadir el link aquí
- [ ] **Section 9 — Real cookie inventory** — auditar las cookies reales del sitio en producción y actualizar la tabla (actualmente hay 4 cookies de plantilla: sb-access-token, _vercel_jwt, __stripe_mid, _ga)
- [ ] **Section 10 — Current third-party providers list** — listar los proveedores de cookies de terceros reales que se usen

### Infraestructura legal pendiente

- [ ] **Cookie banner / consent layer** — implementar el componente de consentimiento de cookies (requisito LSSI Art. 22.2) antes de activar cualquier cookie no esencial (analytics, etc.)
- [ ] **AEPD registration** — evaluar si BETTERNOTES SL debe inscribirse en el Registro de Actividades de Tratamiento (RAT) según RGPD Art. 30

---

---

## Fase 1 — COMPLETADA ✅

Milestones M1-M7 completados: Auth, generación de documentos LaTeX, chat IA con historial,
freemium/Stripe, PDF viewer inline, templates, sidebar, home dashboard, attachments con
carpetas, modo guest (anonymous auth). MVP en producción: https://www.better-notes.ai

---

## Fase 2 — TODOS LOS MILESTONES COMPLETADOS ✅ (2026-03-26)

| # | Milestone | Estado |
|---|-----------|--------|
| F2-M1 | Diagnóstico visual + propuesta de diseño | ✅ Completado |
| F2-M2 | Rediseño visual y estructura de navegación | ✅ Completado |
| F2-M3 | Organización de documentos | ✅ Completado |
| F2-M4 | Subida de archivos como contexto IA | ✅ Completado |
| F2-M2b | Navegación, UX y flujo del producto | ✅ Completado |

---

## Fase 2 — COMPLETADA ✅ (2026-03-26)

### F2-M5 — Auth refinements + Google OAuth + deuda técnica
_Prioridad: 🔴 Alta_

- [x] F2-M5.1 — Google OAuth verificado en producción: login y registro con Google funcionan correctamente (2026-03-26) · ✅ COMPLETADO
- [x] F2-M5.2 — Renombrar "Sign in" → "Log in" en todos los puntos de entrada (login, signup, navbar, modales guest) · ~30min
- [x] F2-M5.3 — Añadir "Forgot password?" con flujo de reset completo (resetPasswordForEmail + página /reset-password) · ~1h
- [x] F2-M5.4 — Poner logo BetterNotes en páginas de auth (login, signup, forgot-password, reset-password) · ~30min
- [x] F2-M5.5 — Fix race condition Stripe customer en doble click (UNIQUE constraint en profiles.stripe_customer_id + RPCs get_or_reserve_stripe_customer y set_stripe_customer_id + migración aplicada en Supabase Dashboard) · ~1h — EN PRODUCCIÓN
- [ ] F2-M5.6 — Configurar autodeploy de app-api en Railway con git push · ~1h
  > **BLOQUEADO por coste**: El plan trial de Railway tiene $4.86 restantes. Configurar
  > Root Directory (`app-api`) y Watch Paths (`app-api/**`) en el Dashboard consume crédito
  > en cada deploy (build con TexLive ~5-10min). `railway.json` ya está creado y commiteado.
  > Activar cuando se upgrade el plan o se decida gastar el crédito restante.

_Criterio de aceptación: Google OAuth funciona en producción, textos de auth consistentes, flujo de reset operativo, app-api se despliega automáticamente._

---

### F2-M6 — Nueva sidebar + All Documents revamp
_Prioridad: 🔴 Alta — COMPLETADO (F2-M6.1 a F2-M6.7 completados 2026-03-24)_

**Sidebar — nueva estructura:**

- [x] F2-M6.1 — Reestructurar sidebar con nueva jerarquía y separadores de sección · ~1h
  ```
  + New Project
  Home
  ———— Resources ————
  Cheat Sheets        (placeholder "Próximamente")
  Problem Solver      (placeholder "Próximamente")
  Exams               (placeholder "Próximamente")
  ———— Projects ————
  Search              (placeholder "Próximamente")
  All Documents
  My Studies          (placeholder "Próximamente")
  Templates
  ———— Recents ————
  [lista documentos recientes]
  ```
- [x] F2-M6.2 — Crear páginas placeholder para los 5 items nuevos (/cheat-sheets, /problem-solver, /exams, /search, /my-studies) en inglés · ~30min

**All Documents revamp:**

- [x] F2-M6.3 — Carpeta "Starred" siempre visible arriba con los marcados como favoritos (estado vacío si ninguno) · ~1h
- [x] F2-M6.4 — Orden: carpetas alfabéticamente arriba, ficheros sueltos abajo · ~30min
- [x] F2-M6.5 — Menú 3-dots en ficheros: rename, star/unstar, mover a carpeta, eliminar con modal · ~1h30min
- [x] F2-M6.6 — Menú 3-dots en carpetas: crear documento dentro, rename con modal, eliminar con modal · ~1h
  > Fixes de UX incluidos: navegación All Documents, highlight carpeta activa, transiciones sin flash,
  > 3-dots siempre visible y correctamente alineado. FolderSectionMenu usa createPortal (z-9999).
  > API POST /api/documents acepta folder_id.
- [x] F2-M6.7 — Vista de carpeta abierta: breadcrumb + header enriquecido + empty state mejorado · completado 2026-03-24
  > Fixes adicionales: carpetas en grid card en All Documents, botón "New document" unificado en header,
  > dropdowns flip upward (DocumentCard + FolderSectionMenu), DocumentCard menu a createPortal (z-9998),
  > carpetas colapsadas en vista All Documents (click abre folder-filtered view).

_Criterio de aceptación: Sidebar muestra nueva estructura completa. All Documents tiene Starred, orden correcto, menús 3-dots completos y vista de carpeta con miniaturas._

**Mejoras adicionales (2026-03-26 sesion 2) — COMPLETADAS:**

- [x] Star hover preview: hover sobre estrella marcada muestra icono outline (preview "quitar estrella") antes de confirmar — en documentos y carpetas
- [x] Carpetas starred se muestran en seccion "Starred" con el mismo formato card que en Folders. Desaparecen de la seccion Folders cuando estan starred.
- [x] Estrella en folder cards siempre visible (no solo al hover)
- [x] Alineacion horizontal en folder cards corregida: dot + icono + nombre + tres puntos + estrella + chevron
- [x] FolderSectionMenu — Change color: picker con 10 colores predefinidos, checkmark en color activo. PATCH /api/folders/[id]
- [x] FolderSectionMenu — Download PDFs: descarga PDFs de todos los documentos de la carpeta. GET /api/folders/[id]/download. Basico — sin ZIP ni progress.
- [x] FolderSectionMenu — Archive folder: archiva la carpeta (archived_at), la saca del listado. PATCH /api/folders/[id]. Migracion SQL: 20260326000003_folders_archived_at.sql aplicada en Supabase.

---

### F2-M7 — Templates revamp
_Prioridad: 🟡 Media_

- [x] F2-M7.1 — Reducir plantillas de 10 a 4 (marcar las demás `is_active = false`, no eliminar) · completado 2026-03-25
  - 2-Column Portrait → `2cols_portrait`
  - 3-Column Landscape → `landscape_3col_maths`
  - 3-Column Portrait → `study_form`
  - Long Notes (Chapters) → `lecture_notes`
  > Migración: 20260325000001_f2m7_templates_is_active.sql | Rama: feature/f2-m7-templates-revamp
- [x] F2-M7.2 — Generar thumbnails PNG para cada una de las 4 plantillas (primera página como imagen) · completado 2026-03-25
  > 4 PNGs en public/templates/thumbnails/ (480x360 px, ~15KB c/u). Script reproducible en scripts/generate-thumbnails.js. canvas como devDependency.
- [x] F2-M7.3 — Mostrar thumbnail PNG encima del esquemático CSS existente (PNG como capa superior, esquemático como fallback si PNG no carga o no existe) · completado 2026-03-25
  > `<Image fill>` con `onError→hidden` sobre el schematic CSS. Aplicado en grid de cards y panel de detalle derecho. commit b719fa5.
- [x] F2-M7.4 — PDF de muestra descargable por plantilla (estáticos en public/templates/samples/) · completado 2026-03-25
  > 9/10 PDFs generados (lecture_notes pendiente — regenerar tras reiniciar app-api). UI: botón "Sample" en card grid + "Preview sample PDF" en modal. commit be9528b.
- [x] F2-M7.5 — Mejorar estado visual de selección: borde accent + check badge en card seleccionada · completado 2026-03-25
- [x] Auto-template (extra) — Modo "Auto": gpt-4o-mini elige la plantilla óptima según el prompt · completado 2026-03-25
  > templateId 'auto' → pickTemplate() en app-api → actualiza template_id en DB con ID resuelto. commit a84f645.

_Criterio de aceptación: 4 plantillas activas, thumbnail PNG encima del esquemático, PDF de muestra descargable, estado de selección claro._

> **Estado:** COMPLETO — mergeado a main 2026-03-25. Pendiente menor: regenerar lecture_notes.pdf.

---

## Fase 3 — VISOR INTERACTIVO ⭐ COMPLETA ✅ (2026-03-28)

> **Feature estratégica más importante del roadmap.**
>
> El workspace `/workspace/[id]` se convierte en el visor interactivo.
> Los modos de vista actuales (PDF / PDF+LaTeX / LaTeX) se **ocultan en la UI** pero
> el código permanece intacto como fallback. La descarga PDF sigue disponible vía
> pdflatex (sin cambios en el backend).
>
> Arquitectura: patrón Typora — documento renderizado con KaTeX, click en fragmento
> para editar el LaTeX subyacente, re-renderiza al confirmar. Sin block editor externo.

---

### F3-M1 — Arquitectura + PoC ✅ COMPLETADO (2026-03-26)
_Prioridad: 🔴 Alta_

- [x] F3-M1.1 — Investigar y decidir estrategia de parsing LaTeX → bloques tipados · Completada: 2026-03-26
  > Decisión: Parser manual (regex + split). Justificación: LaTeX siempre generado por GPT-4o con 4 templates fijos
  > y prompts controlados — los patrones son predecibles. Cero dependencias externas, < 2kb, implementable en 2-4h.
  > Si en el futuro se necesita LaTeX arbitrario de usuario, migrar a unified-latex (la interfaz Block no cambia).
  > Alternativas descartadas: latex-utensils (over-engineering, ~150kb), unified-latex (curva alta, 12-16h integración).
- [x] F3-M1.2 — Validar compatibilidad KaTeX con las fórmulas que genera GPT-4o en nuestros templates · Completada: 2026-03-26
  > Validado en el PoC (F3-M1.4): KaTeX renderiza correctamente align*, equation*, $...$, pmatrix, mathbb, etc.
  > Macros custom \dd, \real, \cplex (landscape_3col_maths) declaradas en KaTeX via `macros`. Sin incompatibilidades bloqueantes.
- [x] F3-M1.3 — Definir modelo de datos para bloques en la DB · Completada: 2026-03-26
  > Decisión: on-the-fly desde `document_versions.latex_source`. Sin nueva tabla.
  > El parser corre en frontend (parseLatex()). Editar un bloque regenera el `.tex` y crea nueva versión.
- [x] F3-M1.4 — PoC mínimo: renderizar un `.tex` real como array de bloques con KaTeX en React · Completada: 2026-03-26
  > Pipeline verificado: LaTeX → parseLatex() → Block[] → LatexBlock → KaTeX.
  > Archivos: lib/latex-parser.ts, components/viewer/LatexBlock.tsx, components/viewer/LatexViewer.tsx
  > Página de prueba: app/(app)/viewer-poc/page.tsx → http://localhost:3000/viewer-poc
  > Los 4 templates cubiertos con samples hardcodeados. TypeScript limpio. 0 errores lint.
  > Fixes aplicados: espaciado inline math, {N} de multicols, \formulabox con braces anidadas, \sectionbar.

_Criterio de aceptación: Decisión técnica documentada aquí. PoC renderiza al menos 2 plantillas correctamente._
_Estado: ✅ COMPLETADO — todos los sub-milestones verificados. Gate para F3-M2 desbloqueado._

---

### F3-M2 — Renderizado base ✅ COMPLETADO (2026-03-26 sesion 3)
_Prerrequisito: F3-M1 completado_

- [x] F3-M2.1 — Parser LaTeX → bloques tipados completo para los 4 templates · Completada: lib/latex-parser.ts (validado en F3-M1, reutilizado sin cambios)
- [x] F3-M2.2 — Componente React por tipo de bloque con renderizado KaTeX correcto · Completada: components/viewer/LatexBlock.tsx (validado en F3-M1, reutilizado sin cambios)
- [x] F3-M2.3 — Layout multi-columna según plantilla activa (CSS grid) · Completada: LatexViewer recibe `templateId`, aplica grid-cols-1/2/3 según template
- [x] F3-M2.4 — Toolbar superior: navegación de páginas virtuales + zoom · Completada: toolbar con prev/next y presets 75/100/125/150% integrado en LatexViewer
- [x] F3-M2.5 — Ocultar toggles PDF / PDF+LaTeX / LaTeX en el workspace · Completada: envueltos en `<div className="hidden">`, código intacto
- [x] F3-M2.6 — Workspace muestra LatexViewer como vista principal · Completada: documents/[id]/page.tsx carga latexContent + template_id desde hook existente, tab "Interactive", layout CSS columns, titulo, separadores HR, MyBox visibles
- [x] F3-M2.7 — Botón "Descargar PDF" siempre visible · Verificado: ya existía en el header, visible cuando activePdfUrl está disponible (coexiste con el visor)
- [x] F3-M2.8 — Renderizado correcto de saltos de linea (`\\`) en bloques de texto/parrafos · COMPLETADO (2026-03-26 sesion 3)
  > Fix en latex-parser.ts y LatexBlock.tsx: `\\` → `<br/>` en parrafos. Fix catch-all regex que eliminaba texto visible. Fix hydration error home/page.tsx (localStorage→useEffect).

_Criterio de aceptación: Un documento con cualquiera de las 4 plantillas se visualiza en el workspace con layout correcto, fórmulas renderizadas y saltos de linea correctos en parrafos._
_Estado: ✅ COMPLETADO (2026-03-26 sesion 3). KaTeX env rendering (align*, equation*, gather*) resuelto en F3-M3._

---

### F3-M3 — Interactividad (patrón Typora) ✅ COMPLETADO (2026-03-27)
_Prerrequisito: F3-M2 completado_

- [x] F3-M3.1 — Hover sobre bloque → borde sutil resaltado · COMPLETADO
- [x] F3-M3.2 — Click en bloque → borde marcado, contenido sigue renderizado (estado "focused") · COMPLETADO
- [x] F3-M3.3 — Click/doble click en texto dentro del bloque → ese fragmento pasa a modo edición (muestra LaTeX crudo en input/textarea) · COMPLETADO
  - Ejemplo: "el radio es R > 4/3" → editable como "el radio es $R>\frac{4}{3}$"
  - El resto del bloque sigue renderizado
- [x] F3-M3.4 — Enter o click fuera → re-renderiza solo ese fragmento con KaTeX, persiste cambio · COMPLETADO
- [x] F3-M3.5 — Selección de texto con el ratón → click derecho → menú contextual con "Referenciar en chat" · COMPLETADO
- [x] F3-M3.6 — Toolbar de formato: H1/H2, bold, italic, underline, formula, color, boxed (afectan al bloque focused) · COMPLETADO
- [x] F3-M3.7 — Auto-detección del tipo de bloque para activar/desactivar acciones de toolbar · COMPLETADO

**Extras completados en esta sesión:**
- Fix KaTeX entornos \begin{align*}, \begin{equation*}, \begin{gather*} y similares
- Conexión onReferenceInChat: LatexViewer → ChatPanel prefillText (wired end-to-end)
- data-block-id añadido a todos los wrappers de bloque en LatexBlock.tsx
- Fix endpoint Download PDFs carpeta: ZIP real con fflate (antes devolvía solo URLs firmadas)
- DocumentCard: folderBadge con overflow detection (useLayoutEffect) y scroll-close
- FolderSectionMenu: downloadError state + mejoras de menú
- documents/page.tsx: looseDocs mejorado, contador "X folders · Y files"

_Commits: 481bf42, 258dc20, 3bd901e, 34aee68 + merge commits. Mergeado a main._

_Criterio de aceptación: El usuario puede editar cualquier fragmento inline, confirmar y ver el re-render KaTeX. Puede seleccionar texto y acceder al menú contextual. CUMPLIDO._

---

### F3-M4 — Chat contextual ✅ COMPLETADO (2026-03-28)
_Prerrequisito: F3-M3 completado_

- [x] F3-M4.1 — Panel lateral de chat en el workspace vinculado al visor · COMPLETADO
  - Sin referencia: "right-click a block in the viewer to edit it with AI"
  - Con referencia: chip encima del input + input placeholder contextual
- [x] F3-M4.2 — Chip visual con "x" para desreferenciar. BlockReference: { blockId, blockType, latex_source, adjacentBlocks[] } · COMPLETADO
- [x] F3-M4.3 — Endpoint POST /api/documents/[id]/edit-block + editBlock() en AIProvider · COMPLETADO
- [x] F3-M4.4 — Preview del fragmento modificado con KaTeX renderizado en BlockEditPreviewCard · COMPLETADO
- [x] F3-M4.5 — Botones "Apply" / "Discard" — Apply: actualización optimista en LatexViewer vía applyBlockEdit prop · COMPLETADO
- [x] F3-M4.6 — Al "Apply": reemplazar string exacto en .tex, llamar /compile, persistir versión en DB · COMPLETADO
- [x] F3-M4.7 — Undo/redo en memoria en LatexViewer (hasta 20 estados, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) · COMPLETADO

_Criterio de aceptación: El usuario puede referenciar un fragmento, pedir a la IA que lo modifique, ver el preview KaTeX y aplicarlo. El PDF descargado refleja los cambios. CUMPLIDO._

---

### F3-M5 — Publish to My Studies + polish ✅ COMPLETADO (2026-03-28)

- [x] F3-M5.1 backend — Migración SQL (is_published, published_at, university, degree, subject, visibility, keywords[]) + endpoint POST /api/documents/[id]/publish + endpoint POST /api/documents/[id]/suggest-keywords (GPT-4o directo desde Next.js) + GET /api/documents/published · COMPLETADO
- [x] F3-M5.1+M5.2 frontend — Botón "Publish" en header workspace + PublishModal.tsx (campos texto libre + keywords chips editables + sugerencia GPT-4o) + My Studies page (grid de cards de documentos publicados) · COMPLETADO
- [x] F3-M5.3 — Polish visual: skeleton loader visor, "Saved X ago" en header (onApplyPersisted), transition-opacity al cambiar viewerTab · COMPLETADO
- [x] F3-M5.4 — Accesibilidad LatexBlock: tabIndex=0, role="article", Enter/Space abre edición, aria-label en todos los tipos de bloque · COMPLETADO

_Criterio de aceptación: Documento publicable a My Studies con keywords auto-generadas. Visor con polish visual y accesibilidad básica. TODOS CUMPLIDOS._

---

## Extensiones post-F3 — IA Visor Interactivo

### IA-M1 — Fundamentos robustos de edición IA ✅ COMPLETADO (2026-03-31)

- [x] Sustitución de bloques por offsets sourceStart/sourceEnd (annotateBlockOffsets en parser)
- [x] Prevalidación LaTeX en Flujo C: chat-edit route compila antes de retornar el preview
- [x] Persistencia de mensajes block-edit en chat_messages (route apply guarda user+assistant)
- [x] Historial de conversación al prompt de editBlock (ConversationTurn[] en EditBlockArgs, ChatPanel acumula blockEditHistory)

_Pendiente: verificación funcional en navegador por el usuario._

---

### IA-M2 — Gestión dinámica de bloques ✅ COMPLETADO (2026-03-31)

- [x] BlockActionBar en LatexBlock: añadir bloque (arriba/abajo, tipos: párrafo, fórmula, lista, sección)
- [x] Eliminar bloque con confirmación
- [x] Reordenar bloques (subir/bajar)
- [x] reconstructLatexFromBlocks() en parser: reconstituye LaTeX completo desde Block[]
- [x] newBlockLatex() genera placeholders por tipo
- [x] onBlockMutation prop en LatexViewer: dispara compile+persist vía /api/documents/[id]/compile

_Pendiente: verificación funcional en navegador por el usuario._

---

### IA-M3 — Multi-modelo
_Para sesión futura._

Permitir al usuario elegir modelo IA (gpt-4o-mini, gpt-4o, Claude, etc.) por documento o globalmente. Requiere refactor del AIProvider para soportar múltiples proveedores.

---

## Fase 4 — ECOSISTEMA DE ESTUDIO

### F4-M1 — Problem Solver
_Prerrequisito: Visor interactivo (F3) completado_

Importar PDF con problema → IA resuelve detalladamente con soporte visual (tablas, diagramas).
Sub-chats minimizables que el usuario puede abrir en mitad de una solución para preguntas
específicas sin perder el hilo principal. Botón "Publish to My Studies".

---

### F4-M2 — Exams v1
Generación de exámenes por tema. Formatos: test a/b/c/d, fill-in numérico, fill-in texto,
verdadero/falso. El usuario introduce su respuesta → IA puntúa. Resultado siempre mostrado
en LaTeX (color diferenciado del enunciado), incluyendo el desarrollo completo aunque el
usuario haya acertado. Botón "Publish to My Studies".

---

### F4-M3 — Exams v2
_Prerrequisito: F4-M2 completado_

Progress tracking con estadísticas (tasa de acierto por materia, evolución temporal).
Flashcards como formato adicional. Temporizador activable. Animaciones estilo Duolingo:
mensajes motivacionales, racha de aciertos, pantalla de resultados. Estadísticas accesibles
desde el perfil de usuario.

---

## Fase 5 — COMUNIDAD Y DESCUBRIMIENTO

> **Objetivo estratégico:** construir la biblioteca académica STEM más completa y estructurada,
> organizada por cursos reales (no carpetas genéricas). El catálogo de contenido es el moat a largo plazo.

### F5-M1 — Catálogo de cursos estructurado ✅ COMPLETADO (2026-04-24)

Estructura jerárquica real: Universidad → Grado → Asignatura → Semestre.
- [x] Tablas `universities`, `degree_programs`, `courses` con RLS público de lectura
- [x] FK columns `university_id`, `program_id`, `course_id` en `documents`
- [x] UC3M seeded: 177 programas, 7.625 cursos (`seed-uc3m.mjs`)
- [x] Generic seed script `seed-university.mjs` — CLI flags `--file` y `--slug` para cualquier universidad
- [x] `GET /api/catalogue` — selects en cascada (universities → programs → courses)
- [x] Navegación árbol en My Studies (university → program → course)
- [x] Sistema de likes y visualizaciones por documento (upvotes + view_count)

---

### F5-M2 — Publish to My Studies workflow ✅ COMPLETADO (2026-04-24)

- [x] `PublishModal` reescrito: toggle "My University" vs "Independent"; selects en cascada (universidad → grado → curso agrupado por Año+Semestre); skeleton loaders; pre-fills al reabrir
- [x] `/api/documents/[id]/publish` acepta `university_id`, `program_id`, `course_id`; popula columnas denormalizadas
- [x] Keywords auto-generadas via GPT-4o
- [x] Visibilidad pública/privada

---

### F5-M3 — Búsqueda semántica
_Prerrequisito: F5-M2 completado_

Buscador con lista split: arriba "Tus Proyectos", abajo "Proyectos de otros" (con universidad y likes).
Filtros: Tipo (Cheat Sheet/Apuntes/Problemas/Examen), Universidad, Grado, Año, Materia, Idioma.
Ordenación por likes o más reciente. Thumbnails, autor y fecha en resultados.
- **Búsqueda semántica:** embeddings del contenido de los documentos (no solo metadatos). Permite buscar "Lagrangian mechanics exam problems" y encontrar documentos relevantes aunque no contengan esas palabras exactas. Usar pgvector en Supabase.
- Índice actualizado al publicar / editar un documento.

---

### F5-M4 — Sistema de reputación y señal de calidad
_Prerrequisito: F5-M3 completado_

Sin señal de calidad, la biblioteca se llena de contenido basura (problema de Course Hero).
- Upvotes, número de descargas y visualizaciones por documento.
- **Etiquetas verificadas de asignatura**: cuando 5+ estudiantes de la misma universidad etiquetan un documento con el mismo curso, se marca como "verificado".
- Badges para contribuidores top por universidad y materia.
- Filtro "Most trusted" además de "Most recent" y "Most liked".

---

### F5-M5 — Fork & Remix
_Prerrequisito: F5-M4 completado_

Modelo GitHub aplicado al contenido académico — crea el flywheel de contribución.
- Botón "Fork" en cualquier documento publicado: crea una copia en tu espacio con crédito al autor original.
- El fork es editable con el visor interactivo (F3).
- Al re-publicar, se muestra "Forked from [autor]" + enlace al original.
- Historial de forks visible: "Este documento ha sido forkeado 12 veces".

---

## Fase 6 — PERFIL Y CONFIGURACIÓN

### F6-M1 — User Profile ✅ COMPLETADO (2026-04-24)

- [x] `GET /api/profile/[userId]` — perfil + stats (published_count, total_views, total_likes, forks_received) + docs enriquecidos; respeta `profile_visibility`
- [x] `/profile/[userId]/page.tsx` — banner (gradiente o custom), avatar, nombre/@username, bio, stats bar, grid de notas públicas con like toggle
- [x] Perfil privado: pantalla de bloqueo para no propietarios
- [x] AuthorChip en community cards → navega a /profile/[userId]
- [x] Sidebar: "Edit profile" + "View public profile" en dropdown de cuenta

---

### F6-M2 — Settings completo
- **Account:** nombre, username, email, cambio de password, cuentas conectadas, eliminar cuenta
- **Profile Details:** foto, header/banner, bio, universidad, visibilidad pública
- **App Preferences:** appearance (light/dark/system), idioma (ES, EN, FR...)
- **Billing / Plan:** plan actual vs Pro, uso del mes, Stripe Customer Portal
- **Support:** formulario de contacto, FAQs
- **Documentation:** política de privacidad, términos de uso
- **Sign Out**

---

## Fase 7 — POLISH Y ESCALA

### F7-M1 — Mobile responsive completo
Auditoría completa en breakpoints móviles (iPhone SE, iPhone 14, iPad). El visor interactivo
necesita layout especial en móvil (sin panel lateral fijo, sheet inferior para el chat).

### F7-M2 — Landing page mejorada
Demo del visor interactivo embebida en la landing. Testimonios de usuarios. Sección FAQ.
Mejoras de SEO y meta tags Open Graph.

### F7-M3 — Onboarding interactivo
Tour guiado con tooltips al primer login. Cubre: crear primer documento, usar el visor
interactivo, publicar en My Studies. Omitible por el usuario. Estado persistido en DB.

---

---

## Fase 8 — RETENCIÓN Y HÁBITO DE ESTUDIO

> **Objetivo:** convertir BetterNotes en parte del flujo semanal del estudiante, no una herramienta puntual.
> Sin un loop de retención, los usuarios generan un PDF y no vuelven.

### F8-M1 — Repetición espaciada (Spaced Repetition)
_Prerrequisito: F4-M2 (Exams) completado_

- Auto-generar flashcards desde cualquier documento con un click.
- Algoritmo SM-2 (o similar) para programar revisiones: "tienes 12 tarjetas pendientes de Mecánica Cuántica".
- Integración con el calendario de estudio (F8-M2).
- Estadísticas de retención por materia.

---

### F8-M2 — Planificador de estudio
- El usuario registra sus asignaturas y fechas de examen.
- BetterNotes sugiere automáticamente: "Tu examen de Termodinámica es en 5 días — aquí están tus apuntes + flashcards pendientes".
- Notificaciones en app (y email opcional) con recordatorios de revisión.
- Vista de calendario semanal con sesiones de estudio planificadas.

---

### F8-M3 — Gamificación y rachas
_Prerrequisito: F8-M1 + F8-M2_

- Racha de días estudiando (estilo Duolingo).
- Pantalla de resultados animada tras completar examen o sesión de flashcards.
- Logros desbloqueables (primer documento publicado, 10 exámenes completados, etc.).
- Estadísticas de progreso accesibles desde el perfil de usuario.

---

## Fase 9 — COLABORACIÓN

> **Objetivo:** los estudiantes estudian en grupo — BetterNotes debe soportarlo.
> La colaboración también es el principal driver de adquisición orgánica (un usuario invita a varios).

### F9-M1 — Grupos de estudio
- Crear grupo con nombre e invitar miembros por email o link.
- Carpetas compartidas: los documentos de la carpeta son visibles y editables por todos los miembros.
- Feed de actividad del grupo: "Ana publicó apuntes de Álgebra Lineal".
- Chat básico de grupo (o integración con Discord/Slack).

---

### F9-M2 — Co-edición de documentos
_Prerrequisito: F9-M1_

- Edición colaborativa en tiempo real del visor interactivo (WebSockets o Supabase Realtime).
- Cursores de otros usuarios visibles en el documento.
- Comentarios inline: seleccionar un bloque → añadir comentario → otros miembros reciben notificación.
- Historial de cambios con atribución por usuario.

---

### F9-M3 — Importación desde cualquier fuente
> **Reducir el coste de migración a cero** — si importar es trivial, el switching cost desaparece.

- Import desde Notion (export JSON/HTML → parser → LaTeX).
- Import desde Google Docs (.docx → pandoc → LaTeX).
- Import desde Obsidian (Markdown + Math → LaTeX).
- Fotos de apuntes manuscritos → OCR + AI cleanup → LaTeX.
- Import desde PDF (ya implementado como adjunto — mejorar extracción estructurada).

---

## Fase 10 — INSTITUCIONAL

> **Objetivo estratégico:** el revenue real a escala está en licencias institucionales, no en $9/mes de usuarios individuales.
> Requiere masa crítica de contenido (Fase 5) y funcionalidades de colaboración (Fase 9) como prerrequisitos.

### F10-M1 — Herramientas para profesores
_Prerrequisito: F9-M1_

- Los profesores crean "asignaciones": template + prompt base → los estudiantes generan sus propios apuntes.
- El profesor puede ver y comentar los documentos generados por sus alumnos.
- Exportación masiva de documentos de clase en PDF.
- Panel de analytics: qué temas generan más dudas, qué estudiantes están activos.

---

### F10-M2 — Licencias universitarias
_Prerrequisito: F10-M1_

- Plan "University": acceso Pro para todos los estudiantes de una institución.
- SSO via SAML (integración con el sistema de identidad universitario).
- Panel de administración para IT de la universidad: usuarios activos, uso, etc.
- Pricing: negociado por institución (per-seat o flat fee).

---

### F10-M3 — Integración LMS (Canvas, Moodle, Blackboard)
_Prerrequisito: F10-M2_

- Plugin para Canvas y Moodle: BetterNotes aparece como herramienta dentro del LMS.
- Los estudiantes acceden desde el LMS sin registro adicional (LTI 1.3).
- Las entregas de apuntes o exámenes pueden enviarse directamente al gradebook.
- Objetivo: entrar en infraestructura universitaria sin ciclo de ventas.

---

## Backlog UI/UX — pendientes identificados en sesión 2026-03-26 (sesion 2)

| Prioridad | Tarea | Notas |
|-----------|-------|-------|
| ✅ Resuelto | **Bug — Download PDFs de carpeta RESUELTO**: endpoint reescrito, devuelve ZIP via fflate. GET /api/folders/[id]/download → application/zip. | Resuelto 2026-03-27. |
| 🟢 Baja | Mejorar Download PDFs de carpeta: progress indicator durante generacion del ZIP | ZIP funciona. Falta feedback visual de progreso. |
| 🟡 Media | Subcarpetas: New folder here + Move to | No implementado. Opciones en menu como "disabled/Soon". |
| 🟢 Baja | Archive folder: vista de carpetas archivadas + opcion de restaurar | Archive funciona (archived_at), pero no hay UI para ver ni restaurar las archivadas. |

---

## Deuda técnica conocida

| Severidad | Descripción | Milestone |
|-----------|-------------|-----------|
| ✅ Resuelto | Google OAuth verificado en producción — login y registro funcionan (2026-03-26) | F2-M5.1 |
| 🟡 Media | Chat consume cuota por intento, no por PDF generado | Decisión de producto pendiente |
| ✅ Resuelto | Race condition Stripe customer con doble click | F2-M5.5 |
| 🟡 Media | app-api requiere redeploy manual en Railway — autodeploy bloqueado porque repo es privado (no issue de crédito) | F2-M5.6 |
| 🟢 Baja | Plantillas hardcodeadas en app-api | Se resuelve en F2-M7 |
| 🟢 Baja | Exportar .tex además del PDF | Pendiente |
| 🟢 Baja | `onTrigger` en NewDocumentWatcher debería estar en useCallback | Pendiente |
| ✅ Resuelto | **Bug** — Download PDFs de carpeta resuelto: ZIP con fflate (2026-03-27) | fflate dependency añadida, endpoint reescrito |
| 🟢 Baja | Download PDFs de carpeta: añadir progress indicator durante generacion del ZIP | ZIP funciona, falta feedback visual |

---

## Decisiones técnicas fijadas

| Decisión | Valor | Fecha |
|----------|-------|-------|
| Visor interactivo | Patrón Typora sobre LaTeX existente — sin block editor externo | 2026-03-22 |
| Rendering fórmulas | KaTeX en frontend (preview interactivo) | 2026-03-22 |
| PDF final | pdflatex en backend Express — sin cambios | 2026-03-22 |
| Modos de vista actuales | Ocultos en UI, código intacto como fallback | 2026-03-22 |
| Templates thumbnails | PNG encima del esquemático CSS (esquemático como fallback) | 2026-03-22 |
| Workspace | `/workspace/[id]` se convierte en el visor interactivo | 2026-03-22 |
| Motor IA | GPT-4o como default, AIProvider desacoplado para Claude/Gemini | 2026-03-22 |
| Reescritura v2 | Branch `v2`, Supabase BetterNotesAI-3 (unnaedblaufyganyconl) | 2026-03-18 |
| Auth | @supabase/ssr SSR-safe | 2026-03-18 |
| AIProvider interface desacoplada | Permite cambiar modelo sin refactor | 2026-03-18 |
| Stripe Checkout hosted | Cero PCI scope | 2026-03-18 |
| Plantillas en DB (tabla templates) | Flexible, permite is_pro, previews, sort_order | 2026-03-18 |
| Adjuntos como contexto automático | Chat y generate reciben archivos del DB sin UI extra | 2026-03-20 |
| DocumentCreationBar fuera de (app) | Usable tanto en landing como en app | 2026-03-21 |
| Prompt vía ?prompt= URL param al workspace | Evita localStorage; InitialPromptSender auto-envía en draft | 2026-03-21 |
| Sidebar carpetas: create/rename/color/delete inline | Sin modal extra, acciones on-hover + color picker portal | 2026-03-21 |
