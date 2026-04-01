# Progress Log — BetterNotes v2

_Las sesiones más recientes aparecen primero._

---

## Sesion 2026-04-01 — Verificacion IA-M1/M2 + fix LaTeX color + merge a main

**Completado:**
- Verificacion funcional de IA-M1 (sustitución offset-based, prevalidacion LaTeX, historial conversacion, persistencia chat_messages) — sin blockers
- Verificacion funcional de IA-M2 (BlockActionBar, add/delete/reorder bloques, reconstructLatexFromBlocks) — sin blockers
- Fix bug color ecuaciones: `\textcolor{color}{text}` en parrafos ahora renderiza `<span style="color:...">` en LatexBlock.tsx. KaTeX lo soporta nativamente para formulas matematicas; el fix cubre parrafos de texto plano.
- Prompts de editBlock y editDocument actualizados para que la IA genere `\textcolor{red}{...}` correctamente
- Merge de `session/2026-03-30` a `main` — commit 4ece957
- Documentacion pendientes operacionales en `.claude/reports/operational-pending-2026-04-01.md`

**Decisiones tomadas:**
- IA-M1 e IA-M2 declarados estables — no requieren cambios adicionales
- Color en parrafos LaTeX: implementado via deteccion de `\textcolor` → `<span style="color">` en el parser de LatexBlock.tsx
- Siguiente milestone: F4-M1 Problem Solver (pendiente confirmacion usuario proxima sesion)

**Problemas encontrados:**
- Calidad de AI edits sigue siendo parcial (issue conocido, no bloqueante para avanzar a F4)

**Pendientes operacionales (manual):**
- `git push origin main` (usuario)
- OPENAI_API_KEY en Vercel/Railway (usuario)
- Rebuild Docker app-api en Railway (usuario)
- Migracion SQL F3-M5 en Supabase Dashboard (usuario)

**Lecciones capturadas:** no

**Siguiente:** F4-M1 Problem Solver — iniciar proxima sesion

---

## Sesion 2026-03-31 — Visor PDF-like + perfiles de plantilla + AI document-level edits

**Completado:**
- `lib/template-profiles.ts`: interface TemplateProfile con geometria, tipografia, colores, layout y chrome. Perfiles reales derivados de los preambles LaTeX de las 4 plantillas activas (lecture_notes, 2cols_portrait, landscape_3col_maths, study_form) + default.
- LatexViewer: layout A4 PDF-like (hoja blanca sobre fondo neutro, estilo visor PDF real). Zoom via `transform: scale()` con wrapper two-div para que scroll height sea correcto. CSS custom properties inyectadas por plantilla. Fix color texto negro sobre fondo blanco.
- Mejora A: `lib/katex-macros.ts` — constante KATEX_MACROS compartida entre LatexBlock y ChatPanel.
- Mejora B: preview KaTeX renderizado en chips de BlockReference.
- Mejora C: indicadores de pasos undo/redo en toolbar con contadores en estado React.
- Mejora D: scroll automatico al bloque editado tras Apply.
- Mejora E: fix replace fragil — estrategia Nth-occurrence para bloques con latex_source identico.
- Fixes del reviewer: FormatToolbar movida dentro de !hideToolbar, IDs duplicados en multicols (parseLatexInternal no resetea _idCounter), boton redo usa redoCount state en lugar de ref.current.
- AI edita el documento via prompts del chat: `editDocument()` en AIProvider con JSON mode para clasificar automaticamente entre edicion de documento y respuesta conversacional. Ruta `POST /latex/edit-document` en app-api. Route handler `POST /api/documents/[id]/chat-edit` en app-web (guarda mensajes en DB). LatexViewer: prop `pendingDocumentEdit` con banner "AI preview" y outline indigo. ChatPanel: `DocumentEditPreviewCard` con Apply/Discard. page.tsx: estado y wiring completo.

**Decisiones tomadas:**
- JSON mode en editDocument(): clasifica automaticamente el mensaje del usuario entre edicion de documento (devuelve nuevo latex_source) o respuesta conversacional (devuelve mensaje de texto). El clasificador esta en el propio prompt de sistema.
- Commits separados por feature: d1c00c6 (visor PDF-like + mejoras A-E) y d5f1668 (AI document-level edit).

**Problemas encontrados:**
- Calidad de AI edits parcial: la IA no aplica cambios en todas las instancias del documento consistentemente (ej: cambiar color de ecuaciones no afecta a todas). Pendiente mejora de prompt o estrategia de edicion.
- app-api en modo Docker no tiene los nuevos endpoints. Usuario debe rebuildar imagen o usar `npm run dev` directamente.

**Lecciones capturadas:** no

**Siguiente:** F4-M1 Problem Solver (primera feature de Fase 4)

---

## Sesion 2026-03-28 — F3-M4 + F3-M5 completados · Fase 3 CERRADA

**Completado:**
- F3-M4 — Chat contextual: chip visual BlockReference con boton "x" para desreferenciar, endpoint POST /api/documents/[id]/edit-block, editBlock() en AIProvider, BlockEditPreviewCard con preview KaTeX renderizado, botones Apply/Discard con actualizacion optimista en LatexViewer via applyBlockEdit prop, persistencia en DB + /compile al aplicar, undo/redo en memoria hasta 20 estados (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
- F3-M5 — Publish to My Studies: migracion SQL (is_published, published_at, university, degree, subject, visibility, keywords[]), endpoint POST /api/documents/[id]/publish, POST /api/documents/[id]/suggest-keywords (GPT-4o directo desde Next.js), GET /api/documents/published, PublishModal.tsx con chips de keywords editables y sugerencia IA, boton "Publish" en header workspace, My Studies page con grid de cards de documentos publicados
- F3-M5 polish: skeleton loader en visor, "Saved X ago" en header (onApplyPersisted callback), transition-opacity al cambiar viewerTab
- F3-M5 accesibilidad: LatexBlock con tabIndex=0, role="article", Enter/Space abre edicion, aria-label en todos los tipos de bloque

**Decisiones tomadas:**
- suggest-keywords llama GPT-4o directamente desde Next.js (no via app-api) para evitar latencia extra y simplificar el flujo
- Apply actualiza el estado local de LatexViewer de forma optimista antes de confirmar persistencia en DB
- Undo/redo se guarda en memoria del componente (no en DB) — suficiente para la sesion activa

**Problemas encontrados:**
- Ninguno bloqueante. La migracion SQL de F3-M5 aun no se ha aplicado en Supabase Dashboard (pendiente operacional)

**Estado de rama:** f3-m4-chat-contextual — SIN merge a main. Pendiente verificacion end-to-end en navegador.

**Lecciones capturadas:** no

**Siguiente:** Verificar visor interactivo en navegador (edicion bloques, chat contextual, Apply/Discard, undo/redo) → aplicar migracion SQL en Supabase → merge a main → abrir Fase 4 (F4-M1 Problem Solver)

---

## Sesion 2026-03-26 (sesion 3) — F3-M2 completado: fix `\\`, catch-all regex, hydration error

**Completado:**
- F3-M2.8 — Fix renderizado `\\` → `<br/>` en parrafos: modificados `latex-parser.ts` y `LatexBlock.tsx` para tratar `\\` como salto de linea en bloques de texto/parrafo
- Fix catch-all regex en `LatexBlock.tsx` que eliminaba texto visible de comandos LaTeX desconocidos — ahora el texto raw se muestra como fallback en lugar de suprimirse
- Fix hydration error en `home/page.tsx`: uso de `localStorage` en `useState` inicial → patron seguro con `useEffect` post-montaje

**Milestone cerrado:** F3-M2 — Renderizado base ✅

**Pendiente para próxima sesión:**
- KaTeX/LaTeX rendering issues: algunas ecuaciones no se renderizan correctamente — investigar en el contexto de F3-M3

**Lecciones capturadas:** no

**Siguiente:** F3-M3 — Interactividad (patrón Typora) — prereqs desbloqueados. Antes de arrancar: investigar KaTeX rendering issues pendientes.

---

## Sesion 2026-03-26 (session 2) — UI/UX stars + carpetas + FolderSectionMenu (Change color, Download, Archive)

**Completado:**
- Star hover preview: hover sobre estrella marcada muestra outline (preview de "quitar estrella") antes de confirmar el click — en documentos y carpetas
- Carpetas starred en seccion Starred: las carpetas con estrella aparecen en la seccion "Starred" con card identica a la de Folders, y desaparecen de la seccion Folders
- Estrella siempre visible en folder cards (no solo al hover), alineada con el comportamiento de documentos
- Alineacion horizontal corregida en folder cards: dot + icono + nombre + tres puntos + estrella + chevron sin desalineamientos
- FolderSectionMenu — Change color: picker con 10 colores predefinidos, checkmark en el color activo, llama PATCH /api/folders/[id]
- FolderSectionMenu — Download PDFs: descarga los PDFs de todos los documentos de la carpeta. Endpoint GET /api/folders/[id]/download creado. Funcionalidad basica operativa.
- FolderSectionMenu — Archive folder: archiva la carpeta (archived_at), la saca del listado. Endpoint PATCH /api/folders/[id] actualizado. Migracion SQL aplicada en Supabase.
- Archivos nuevos: supabase/migrations/20260326000003_folders_archived_at.sql, app-web/app/api/folders/[id]/download/route.ts
- Archivo actualizado: app-web/app/api/folders/[id]/route.ts (archive + color)

**Decisiones tomadas:**
- Change color y Archive no son Pro-only — disponibles para todos los planes
- Download PDFs tampoco es Pro-only por ahora
- Share y subcarpetas (New folder here, Move to) quedan como "disabled / Soon" en el menu
- La descarga de PDFs se hace de forma individual por ahora — ZIP real y progress indicator van al backlog

**Problemas encontrados:**
- Download PDFs: no descarga archivos individualmente sin ZIP real ni indicador de progreso. Queda en backlog para mejorar.

**Lecciones capturadas:** no

**Siguiente:** Revisar descarga de carpetas (ZIP + progress), luego implementar subcarpetas (New folder here / Move to), o retomar F3-M2 (saltos de linea `\\`) segun prioridad

---

## Sesión 2026-03-26 (session-end) — F3-M1 completado + F3-M2 visor integrado (en progreso)

**Completado:**
- F2-M5.1: Google OAuth verificado en producción — registro y login con Google funcionan (confirmado al inicio de sesion)
- Fase 2 cerrada oficialmente: todos los milestones completados. HTML de cierre generado: .claude/reports/F2_cierre.html
- F3-M1.1: Decision parser manual (regex + split en lib/latex-parser.ts) — sin librerias externas
- F3-M1.2: KaTeX validado — compatible con los 4 templates, macros custom \dd, \real, \cplex declaradas
- F3-M1.3: Decision on-the-fly desde document_versions.latex_source — sin tabla document_blocks
- F3-M1.4: PoC funcional — pipeline LaTeX→bloques→KaTeX verificado, pagina /viewer-poc operativa
- F3-M1 COMPLETADO — gate para F3-M2 desbloqueado
- F3-M2: Visor integrado en /documents/[id] con tab "Interactive", layout CSS columns segun template, toolbar pagination/zoom, titulo, separadores HR, MyBox renderizado. Sub-milestones M2.1-M2.7 completados.

**Pendiente (F3-M2 no cerrado):**
- Renderizado de saltos de linea (`\\`) en bloques de texto/parrafos — sin resolver, se deja para proxima sesion
- lecture_notes.pdf en public/templates/samples/ — el usuario lo anadira cuando pueda

**Decisiones tomadas:**
- Parser LaTeX manual (regex + split) — cero dependencias, <2kb, interfaz Block estable para futura migracion
- Datos del visor on-the-fly desde document_versions — sin nueva tabla en DB
- KaTeX con macros custom en frontend para los 4 templates
- F3-M2 se deja abierto (pendiente `\\`) — no se declara completo hasta resolver

**Tareas opcionales identificadas (no en plan, a debatir):**
- Mejorar menu 3-dots de documentos con opciones adicionales
- Boton "Crear carpeta" en All Documents
- Mejorar vista previa de templates al hacer click
- Otras mejoras UI secundarias

**Problemas encontrados:**
- Renderizado de `\\` en parrafos: el parser/LatexBlock no mapea doble backslash a salto de linea — queda para F3-M2 proxima sesion

**Lecciones capturadas:** no

**Siguiente:** Resolver `\\` en parrafos para cerrar F3-M2, luego iniciar F3-M3 (Interactividad — patron Typora)

---

## Sesión 2026-03-26 — CIERRE FASE 2 + F2-M5.1 Google OAuth verificado en producción

**Completado:**
- F2-M5.1: Google OAuth verificado en producción — registro y login con Google funcionan correctamente en https://www.better-notes.ai
- Fase 2 cerrada oficialmente: todos los milestones completados (F2-M1 a F2-M7 + F2-M2b + F2-M5)
- STATUS.md actualizado: Fase 3 activa
- TASKS.md actualizado: F2 cerrada, deuda técnica de Google OAuth marcada resuelta
- HTML de cierre de fase generado: .claude/reports/F2_cierre.html

**Decisiones tomadas:**
- F2-M5.6 (autodeploy Railway) queda en deuda técnica abierta — no bloquea el cierre de Fase 2 ni el inicio de Fase 3
- Fase 3 inicia con F3-M1: Arquitectura + PoC del visor interactivo (gate obligatorio)

**Lecciones capturadas:** no

**Siguiente:** F3-M1 — Investigar estrategia de parsing LaTeX → bloques tipados, validar KaTeX, definir modelo de datos, PoC mínimo

---

## Sesión 2026-03-24 — F2-M5.5 fix Stripe + F2-M5.6 railway.json + F2-M6 sidebar y All Documents revamp

**Completado:**
- F2-M5.5: fix race condition Stripe customer en producción
  - UNIQUE constraint en profiles.stripe_customer_id
  - RPC get_or_reserve_stripe_customer (reserva atómica del customer_id en el primer checkout)
  - RPC set_stripe_customer_id (escritura definitiva tras webhook de Stripe)
  - Migración aplicada manualmente en Supabase Dashboard — en producción
- F2-M5.6: railway.json creado en app-api/ con Root Directory y Watch Paths configurados
  - Activación pendiente por crédito trial ($4.86 restantes)
- F2-M6.1: sidebar nueva con secciones Resources / Projects / Recents, separadores y badges "Soon"
- F2-M6.2: 5 páginas placeholder en inglés (/cheat-sheets, /problem-solver, /exams, /search, /my-studies)
- F2-M6.3: carpeta Starred siempre visible arriba en All Documents (vacía si ninguno marcado)
- F2-M6.4: carpetas ordenadas alfabéticamente arriba, ficheros sueltos abajo
- F2-M6.5: menú 3-dots en ficheros (rename, star/unstar, mover a carpeta, eliminar con modal de confirmación)
- F2-M6.6: menú 3-dots en carpetas (crear doc dentro, rename con modal, eliminar con modal)
- Fixes de UX: navegación All Documents, highlight carpeta activa, transiciones sin flash, 3-dots alineado
- Todo mergeado a main

**Decisiones tomadas:**
- FolderSectionMenu usa createPortal (z-9999) para evitar clipping en la sidebar
- API POST /api/documents extendida para aceptar folder_id (creación directa dentro de carpeta)
- Páginas placeholder en inglés (alineado con el idioma base de la app)
- railway.json no se activa hasta upgrade del plan Railway

**Problemas encontrados:**
- 3-dots en carpetas tenia clipping por overflow hidden del contenedor sidebar — resuelto con createPortal
- Transiciones de navegacion generaban flash visual — resuelto ajustando los estados de carga

**Lecciones capturadas:** no

**Siguiente:** F2-M6.7 — Vista de carpeta abierta con ficheros internos en miniaturas + breadcrumb

---

## Sesión 2026-03-23 — F2-M5.4 Logo BetterNotes en páginas de auth

**Completado:**
- F2-M5.4: logo BetterNotes reposicionado en las 4 páginas de auth
  - Páginas afectadas: login, signup, forgot-password, reset-password
  - El logo se movió de dentro de la tarjeta (card) a un header centrado en la parte superior de la página
  - Diseño consistente con el header de la landing: logo + nombre de la app, centrado y fuera de cualquier contenedor de formulario
  - Rama `feat/f2-m5.4-auth-logo` mergeada a `main`, pendiente push a origin

**Decisiones tomadas:**
- Header de auth: logo encima de la tarjeta, no dentro — coherencia visual con landing
- Las 4 páginas del flujo de auth comparten el mismo patrón de layout (header externo + card centrada)

**Pendiente para próxima sesión:** F2-M5.5 (race condition Stripe) o F2-M5.1 (Google OAuth si hay acceso a paneles)
**Bloqueantes:** 🔴 Google OAuth requiere acceso a Supabase Dashboard + Google Cloud Console

---

## Sesión 2026-03-23 — F2-M5.3 Forgot Password + Reset Password

**Completado:**
- F2-M5.3: flujo completo de reset de contraseña
  - `/forgot-password` — formulario email + estado success, llama a `resetPasswordForEmail`
  - `/reset-password` — formulario nueva password + confirm, valida coincidencia y min 8 chars, llama a `updateUser`
  - `/auth/callback` — si falla el exchange con `next=/reset-password`, redirige a `/forgot-password?error=link_expired`
  - Login: link "Forgot password?" aparece solo tras el primer intento fallido
  - Middleware: `/forgot-password` y `/reset-password` añadidos a `isAuthRoute`
- Rama `feat/f2-m5.3-forgot-password` mergeada a `main`

**Decisiones tomadas:**
- "Forgot password?" oculto inicialmente — aparece tras el primer error de login (UX más limpia)
- `redirectTo` apunta a `/auth/callback?next=/reset-password`, no directamente a `/reset-password`

**Pendiente para próxima sesión:** F2-M5.4 (logo en auth) o F2-M5.1 (Google OAuth si hay acceso a paneles)
**Bloqueantes:** 🔴 Google OAuth requiere acceso a Supabase Dashboard + Google Cloud Console

---

## Sesión 2026-03-22 — Planificación completa y setup del proyecto

**Completado:**
- Revisión completa del nuevo plan de producto (nuevo_plan.pdf)
- Reestructuración total de TASKS.md: Fases 2-7 con milestones y tareas atómicas
- Investigación de gpai.app: arquitectura del visor interactivo (patrón Typora sobre LaTeX)
- Decisión técnica: visor interactivo = KaTeX + inline editing, sin block editor externo
- Creación de guías: DEV_LOCAL.md y DEV_WORKFLOW.md
- Skills actualizados: session-start y session-end con flujo de ramas por sesión
- Estrategia de ramas: session/YYYY-MM-DD-descripcion → merge a main al cierre
- Rama `legacy` creada (snapshot v1), `v2` mergeada a `main`
- Resolución de problema Vercel (trial Pro expirado → nuevo proyecto personal)
- Eliminación de MIGRATION_SUMMARY.txt

**Decisiones tomadas:**
- Visor interactivo reemplaza modos PDF/LaTeX/PDF+LaTeX en workspace (ocultos, no eliminados)
- Templates: PNG encima del esquemático CSS como fallback
- pdflatex backend sin cambios — PDF final sigue compilando en Express
- Workflow: cada sesión trabaja en rama propia, merge a main con confirmación del usuario

**Pendiente para próxima sesión:** F2-M5 — Auth refinements + Google OAuth
**Bloqueantes:** ninguno (Vercel resuelto)

---

## Sesión 2026-03-21

### Completado
- Fix entorno local: react-pdf downgrade v10→v7, pdfjs-dist v5→v3, worker copiado a public/
- next.config.ts: añadido alias `canvas: false` para webpack
- B2: blobs animados + grid en AppBackground (afecta todo el dashboard)
- B7: Modo guest completo — anonymous auth de Supabase
  - Migración DB: `profiles.is_anonymous`, RPC `check_guest_limits`, RPC `get_guest_status`
  - Backend: chequeo guest en POST /documents, /generate, /chat + endpoint GET /api/guest-status
  - Frontend: `signInAnonymously()` en landing y home, banner amber en workspace, GuestSignupModal
  - Fixes post-review: generate bloqueaba por doc_limit (fix condición), humanizeError suprime errores guest, banner desaparece con onAuthStateChange

### Decisiones técnicas
- react-pdf v7 + pdfjs-dist v3: necesario para Next.js dev mode (v10+pdfjs-dist v5 falla en webpack dev)
- Blobs en AppBackground en lugar de home/page.tsx: consistencia visual en todo el dashboard
- linkIdentity para Google + updateUser para email/password: preservan user_id del guest
- onAuthStateChange en workspace: el banner guest desaparece automáticamente tras registro

### Deuda técnica pendiente
- [ ] Race condition creación simultánea de docs (2 tabs): requiere RPC atómica o constraint DB
- [ ] Email confirmations: si está activo en Supabase, mostrar "check your email" en vez de reload

### Próximos pasos
- F2-M5: Mobile responsive, onboarding, página de perfil

---

## Sesión 2026-03-22 — F2-M2b: B3 completo + pulido DocumentCreationBar + fixes UX

### ✅ Completado

**B3 — Página de Templates**
- Grid de 10 cards glassmorphism (lg:grid-cols-3) con scroll corregido (`h-full` en lugar de `flex-1 overflow-hidden`)
- Schematics CSS enriquecidos: más líneas de texto, cuadrados simulando imágenes, cajas de fórmulas, tablas de datos, tags pills
- Click en card → modal con preview proporcional (aspect-[4/3], tamaño `w-44` centrado) + DocumentCreationBar preseleccionada
- Schematic del modal ya no se deforma (mismo ratio que las cards)

**DocumentCreationBar — rediseño UX**
- Layout 2 filas: textarea arriba (ancho completo, hasta 160px), botonera debajo [attach][template][specs] — spacer — [Build now]
- Specs con estado "aplicado": botón neutro → click abre popover → botón Apply confirma (queda en indigo) → click de nuevo deselecciona. Sin Apply = `specs: null`
- Popovers via `createPortal` (document.body, z-9999) — ya no quedan solapados por overflow-hidden ni modales
- `selectedTemplateId` prop + `onTemplateChange` callback para sincronización bidireccional con cards padre

**Landing page**
- Sección "Popular templates" con 3 cards interactivas (2-col, 3-col, lecture notes)
- Click en card: selecciona plantilla en la barra + scroll suave hacia arriba
- Card muestra badge "Selected" y feedback; al cambiar plantilla en la barra, card se deselecciona
- Subtítulo sección "How it works" paso 01 actualizado: menciona adjuntos y opciones de ajuste

**Home page**
- Sección "Popular templates" idéntica a landing (antes de Recent documents)
- Sincronización bidireccional: cards ↔ barra de creación
- "View all" → /templates; scroll a barra al seleccionar card
- Corregido `h-full flex flex-col` para scroll correcto

**Auth fixes**
- Login email + auth callback + landing redirect → `/home` (antes `/documents`)
- "or continue with" divider: flex layout, ya no se solapa con la línea

### Decisiones técnicas
- `LandingInteractive`: client component unificado (barra + cards) para compartir estado sin prop-drilling entre server components
- `createPortal` para popovers de DocumentCreationBar: mismo patrón que sidebar color picker
- `specs: null` cuando no se aplican ajustes (antes siempre se enviaban los defaults)

### Problemas encontrados
- Google OAuth: `Unsupported provider` — provider no habilitado en Supabase Dashboard → **pendiente, añadido a deuda técnica 🔴**
- Modal preview deformado: aspect-[16/5] → corregido a aspect-[4/3]
- Scroll roto en templates/home: `flex-1` sin flex parent con altura definida → corregido a `h-full`
- Popover solapado por overflow-hidden → resuelto con createPortal

### Próximos pasos
- **B2**: añadir blobs animados al fondo del Home (animate-blob1/2/3) + grid sutil — es el único bloque pendiente antes de B7
- **B7**: modo guest con Supabase anonymous auth
- **Google OAuth**: configurar en Supabase Dashboard + Google Cloud Console

---

## Sesión 2026-03-20 — F2-M4 completo: subida de archivos como contexto IA

### ✅ Completado

**UI — Componentes de subida**
- `AttachmentDropzone.tsx`: zona drag & drop en modal de specs (crear documento). Soporta PDF, imágenes (jpg/png/webp), DOCX. Límite 5MB por archivo, máximo 3 archivos por generación.
- `WorkspaceAttachmentsPanel.tsx`: panel colapsable en workspace (sobre el chat). Muestra adjuntos del documento actual con botones de eliminar.

**Backend — Endpoints completados**
- `POST /api/attachments/upload`: manejo multipart/form-data, guarda en bucket `document-attachments`, devuelve metadata (id, url, type, size)
- `GET/POST/DELETE /api/documents/[id]/attachments`: listar, crear referencias, eliminar adjuntos por documento
- `chat/route.ts`: incorpora automáticamente adjuntos del documento en cada mensaje a OpenAI (visión para imágenes, texto extraído para PDFs/DOCX)
- `compile/route.ts + app-api compile-only`: imágenes se pasan a pdflatex via `graphicx` package con `float` y `[H]` placement (garantiza posición)
- `openai.provider.ts`: instrucciones actualizadas — soporte para `content` array (text + image_url), extrapolación de PDFs via pdf-parse, DOCX via mammoth

**Fixes en esta sesión**
- `ChatPanel`: layout roto con h-full overflow → flex-1 min-h-0 wrapper en columna derecha con overflow-hidden
- `WorkspaceAttachmentsPanel`: no solapamiento con barras superiores (z-index + padding correcto)
- `chat/route.ts`: ahora incluye adjuntos de DB además de los que pasa el cliente en el payload
- Version selector eliminado de la UI (badge estático que quedó muerto en M4)
- Ctrl+scroll zoom: window listener con passive:false + getBoundingClientRect check para viewport
- Favicon: actualizado a `/brand/logo.png` vía metadata `icons` en `layout.tsx`
- Page reload post-compilar: isLoading solo bloquea en carga inicial (docData=null), no en operaciones posteriores
- Rename inline en workspace: doble-click en título del header → input editable
- Menú 3 puntos en home: z-index fix (top-full en lugar de bottom-full incorrecta) + opción Rename en DocumentCard
- PDF download: fetch blob + `URL.createObjectURL` para forzar Save-As dialog en navegador
- "Move to folder": siempre visible en menú, con hint cuando no hay carpetas

**Commits rama v2 (sesión 2026-03-20)**
- feat(F2-M4): workspace attachments panel
- fix: compile version_number+status, figure placement, ctrl+scroll zoom
- fix: no full-page reload after generate/compile + working ctrl+scroll zoom
- fix: ctrl+scroll zoom via window listener + favicon from logo.png
- feat: inline rename in workspace + fix card menu z-index + Rename option
- fix: proper PDF download via blob + folder option always visible

### 🧠 Decisiones tomadas
- Adjuntos como contexto automático (sin selector extra en chat) — simplifica UX, reduce clicks
- AttachmentDropzone en modal de specs vs WorkspaceAttachmentsPanel panel — separación clara entre "subida para generación" (specs) y "gestión posterior" (workspace)
- Imágenes via `graphicx + float + [H]` — placement determinístico sin saltos de página
- Límites de archivo y cantidad — 5MB/archivo, 3 máximo evita timeouts de OpenAI + pdflatex
- Panel colapsable por defecto (no siempre visible) — menos distracción cuando no hay adjuntos

### ⚠️ Deuda técnica introducida
- AttachmentDropzone: no validación en tiempo real de formato (solo en upload, backend valida después) — mejorable con file type checks en onChange
- WorkspaceAttachmentsPanel: no lazy loading de previews — si hay muchos archivos, renderizado pesado (no probado a escala)
- Chat: adjuntos incluidos en cada mensaje aún si el usuario no especificó (contexto "siempre llevado") — podría ser inesperado en algunos flujos

### ✅ F2-M4 CERRADO — Archivos como contexto funcional en chat y LaTeX

---

## Sesión 2026-03-19 (3) — F2-M3 completo: organización de documentos

### ✅ Completado

**Base de datos — Migración `20260319000001_f2m3_folders_and_archive.sql`**
- Nueva tabla `folders` (id, user_id, name, color, created_at, updated_at)
- Nuevas columnas en `documents`: `archived_at` (timestamptz nullable), `folder_id` (uuid FK con ON DELETE SET NULL)
- RLS en `folders`: 4 policies patrón owner-only (igual que documents)
- 4 índices de performance: idx_documents_user_archived, idx_documents_user_folder, idx_documents_user_starred, idx_folders_user_id

**Backend — Endpoints ampliados**
- `GET /api/documents`: query params `sort` (date_desc/date_asc/title_asc/template), `starred`, `archived`, `folder_id`. Por defecto excluye archivados (`.is('archived_at', null)`)
- `PATCH /api/documents/[id]`: soporta `is_starred`, `archived_at`, `folder_id` con validación de ownership de folder_id
- `GET /api/folders` + `POST /api/folders`: listar y crear carpetas
- `PATCH /api/folders/[id]` + `DELETE /api/folders/[id]`: renombrar y eliminar carpetas

**Frontend — Componentes principales**
- `DocumentCard.tsx`: extraído del map en page.tsx. Rename inline (doble-click), star siempre visible (optimistic), menú ⋯ con Archive/Delete
- `DocumentFilters.tsx`: barra de filtros con select de sort + chips "Starred only" / "Show archived" + botón "Clear filters"
- `FolderPanel.tsx`: panel lateral colapsable (208px). Lista carpetas con contador de documentos, crear/renombrar/eliminar inline
- `page.tsx`: integra los 3 componentes. 5 estados de filtro internos, loadDocuments con query params, 4 handlers con rollback en optimistic updates

**Fixes tras revisión**
- folder_id validation en PATCH documents: ownership check antes de usar
- Rollback en handleRename y handleStar si el PATCH falla
- handleDeleteFolder y handleRenameFolder actualizan estado solo si respuesta es 2xx

### 🧠 Decisiones tomadas
- Archivados excluidos por defecto de listado (lógica `.is('archived_at', null)` en query) — separa documentos activos de histórico
- Carpetas con `color` como string hexadecimal — UI puede renderizar badges coloreadas sin tabla de opciones
- Operaciones optimistas en todos los handlers para UX fluida — rollback automático si backend rechaza
- FolderPanel solo se muestra si hay carpetas ya creadas — menor UX, registrado en deuda

### ⚠️ Deuda técnica conocida
- FolderPanel no tiene botón visible para crear la primera carpeta (sin carpetas, panel no se renderiza) — menor, UX
- `document_count` en carpetas no se actualiza cuando se archiva doc desde vista con filterStarred activo — edge case, low priority
- `loadDocuments` usa stale closures (eslint-disable) — mejorable con useCallback en futuro, no bloqueante

### ✅ F2-M3 CERRADO — Carpetas, archivo y filtros en producción

---

## Sesión 2026-03-19 (2) — F2-M2 completo: visor PDF, editor LaTeX, ajustes visuales

### ✅ Completado

**Visor de PDF — react-pdf (commits 8b0d4bb, 0e9baa0)**
- Migración de `<iframe>` a `react-pdf` (Document + Page como canvas)
- Fondo transparente: el AppBackground es visible alrededor de las páginas
- Contador de páginas real X/Y via `onDocumentLoadSuccess`
- Worker pdfjs servido desde `/public/pdf.worker.min.mjs` (evita problemas SSR)

**Barra unificada (commit 8b0d4bb)**
- Tabs PDF/LaTeX/Split + controles zoom/página + botón Compile fusionados en una sola barra
- Zoom 50–200%, página ‹ X/Y ›, botón Compile solo visible cuando LaTeX pane está activo
- Estado zoom/currentPage/totalPages migrado a `page.tsx`; PdfViewer recibe props

**Split view resizable (commit 1bad018)**
- Divisor arrastrable entre paneles PDF y LaTeX (30%–70%)
- `useCallback` + `removeEventListener` en mouseup para evitar memory leaks

**Editor LaTeX con syntax highlighting (commits 1bad018, 9a57426, cf6c6b5)**
- Componente `LatexHighlighter.tsx`: técnica textarea+overlay
- Paleta de colores completa fiel a v1:
  - `\commands` → naranja `#fb923c`
  - `{` `}` → gris `#64748b`
  - `{contenido entre llaves}` → cyan `#67e8f9`
  - `$math$` `\(...\)` `\[...\]` → verde `#86efac`
  - `% comentarios` → violeta italic `#c4b5fd`
  - Texto llano → gris azulado `#94a3b8`
- Fix Chrome: `WebkitTextFillColor: transparent` en textarea
- `useMemo` en tokenizador para evitar recálculo en cada render

**Botón Compile (commit 1bad018)**
- Nuevo route handler `POST /api/documents/[id]/compile`
- Llama a `app-api /latex/compile-only`, guarda nueva versión en Storage, devuelve signed URL
- Validación input: try/catch JSON, type check, límite 500KB
- Error feedback visible en barra (banner rojo descartable)

**Auth glassmorphism (commit 1bad018)**
- Login y signup: Background animado (blobs) + card glassmorphism
- Inputs `bg-black/20 border-white/20`, botón `bg-white text-neutral-950`

**Sidebar (commits e201f3d, 1bad018)**
- `bg-neutral-950/70 backdrop-blur-xl border-r border-white/10`
- Item activo: `bg-white/15 border-r-2 border-indigo-400`

### 🧠 Decisiones tomadas
- react-pdf elegido sobre iframe para control total del fondo y total de páginas
- Worker pdfjs en /public/ (ruta estática) en lugar de `new URL(import.meta.url)` — más fiable en Next.js SSR
- Técnica textarea+overlay para highlighting (sin CodeMirror) — zero new deps salvo react-pdf
- `braceContent` como token separado (no `plain`) para distinguir argumentos de comandos LaTeX
- Soporte `\(...\)` y `\[...\]` añadido porque el AI genera LaTeX con esos delimitadores, no `$...$`

### ⚠️ Deuda visual conocida (diferida a F2-M5)
- `/login` y `/signup`: fondo animado añadido pero botón Google aún no tiene estilo final
- `/pricing` y `/settings/billing`: usan `bg-[#0a0a0a]` que tapa el AppBackground
- `DocumentsIcon` en Sidebar.tsx definido pero no usado — dead code menor
- Navegación de página (scroll inverso → actualizar página en padre) no implementada — manual solamente

### ✅ F2-M2 CERRADO — Todos los elementos visuales implementados y en producción

---

## Sesión 2026-03-19 — F2-M2 (parte 2): Elementos visuales pendientes — PDF viewer + Sidebar

### ✅ Completado
- `app/(app)/documents/[id]/page.tsx`: sistema de 3 vistas en el visor — tabs PDF / LaTeX / Split. Tab activo `bg-white/20`, inactivo `text-white/60 hover:bg-white/10`. Split view 50/50 con `border-r border-white/10`. LaTeX en `<pre>` con `font-mono text-xs text-white/70 overflow-auto`.
- `app/(app)/_components/Sidebar.tsx`: glassmorphism completo — `bg-black/40 backdrop-blur-md border-r border-white/10`. Item activo: `bg-white/15 border-r-2 border-indigo-400`. Hover: `hover:bg-white/10 hover:text-white`. Footer perfil: `bg-black/20 border-t border-white/10`. Popup perfil: `bg-black/60 backdrop-blur-xl border-white/20`.
- `app/(app)/documents/page.tsx`: modal "New Document" → `bg-black/60 backdrop-blur-xl border-white/20`
- `app/(app)/documents/_components/PdfViewer.tsx`: fondos sólidos → `bg-black/40` para que se vea el AppBackground a través

### 🧠 Decisiones tomadas
- Split view usa `w-1/2` fijo (no flex proporcional) — garantiza widths iguales estables
- Border activo `border-r-2 border-indigo-400` se oculta en sidebar colapsada (64px) — el `bg-white/15` es suficiente indicador en modo icono
- `latexContent` viene directamente del hook `useDocumentWorkspace`, se actualiza automáticamente al switchVersion o generar

### ⚠️ Deuda visual conocida (diferida a F2-M5)
- `DocumentsIcon` en Sidebar.tsx definido pero no usado — limpieza pendiente
- `bg-gray-800` en barra de progreso de PdfViewer — menor inconsistencia estética, no visual priority
- Delete de documentos en documents/page.tsx es optimista (no verifica respuesta del servidor) — bug menor pre-existente

### ✅ F2-M2 CERRADO — Todos los elementos visuales implementados

---

## Sesión 2026-03-19 — F2-M2: Rediseño visual y estructura de navegación

### ✅ Completado
- `globals.css`: design tokens completos (CSS vars dark mode), Geist font vars, keyframes blob1/2/3 (14/16/18s), animate-blob1/2/3, fadeIn, scaleIn
- `app/layout.tsx`: Geist Sans + Geist Mono via next/font/google
- `app/components/Background.tsx`: fondo landing con blobs animados + gradientes radiales + grid + grain
- `app/components/AppBackground.tsx`: fondo app (fixed, sin blobs, gradientes suaves)
- `app/page.tsx`: landing completa con glassmorphism — badge, h1 gradiente indigo→fuchsia→emerald, 3 feature cards, CTA, footer
- `app/(app)/layout.tsx`: AppBackground añadido, bg-transparent en contenedor
- `app/(app)/_components/Sidebar.tsx`: rewrite completo — expandible 64px↔224px, toggle con persistencia localStorage, auto-colapsa en /documents/[id], 5 nav items (Home/Templates/Starred/Settings/Support) con icons + labels, sección Recent (fetch /api/documents, slice 5), profile footer con avatar + email + sign out
- `public/brand/logo.png`: extraído de rama main (98KB)
- `app/(app)/documents/page.tsx`: glassmorphism aplicado — cards docs, modal New Document, onboarding steps
- `app/(app)/documents/_components/ChatPanel.tsx`: glassmorphism aplicado — fondo, input, botón send, burbujas
- `app/(app)/documents/[id]/page.tsx`: colores de borde/fondo actualizados al nuevo sistema
- Stubs: `app/(app)/templates/page.tsx` y `app/(app)/support/page.tsx`

### 🧠 Decisiones tomadas
- Sidebar: 5 items (no 6) — "Home" y "Documents" apuntaban a la misma ruta, se eliminó el duplicado
- Sidebar: sidebar auto-colapsa en /documents/ (editor) pero no en /documents (lista) — editor necesita espacio
- Logo: reutilizado el logo.png de v1 (rama main) — branding nuevo diferido a F2-M5
- Páginas /templates y /support: stubs con estilo glassmorphism, implementación real en milestones posteriores
- No se tocaron: auth pages, pricing, settings/billing — deuda visual registrada para F2-M5

### ⚠️ Deuda visual conocida (diferida a F2-M5)
- `/login` y `/signup`: todavía usan `bg-[#0a0a0a]` sólido sin Background animado
- `/pricing` y `/settings/billing`: usan `bg-[#0a0a0a]` que tapa el AppBackground

---

## Sesión 2026-03-19 — F2-M1: Diagnóstico visual + propuesta de diseño

### ✅ Completado
- Análisis completo de rama main (v1): paleta, tipografía, componentes, animaciones, assets
- Mapeo de flujo de navegación de v1: landing → auth → workspace → workspace/[projectId] → projects → templates
- Análisis diferencial v1 vs v2: qué existe en v1 pero no en v2
- Propuesta de orden óptimo para Fase 2: F2-M2 → M3 → M4 → M5 → M6

### 🧠 Diagnóstico visual extraído

**Paleta v1:**
- Fondo: `#0a0a0a` (neutral-950)
- Texto: `#ededed` / white/70 (secundario)
- Acento indigo: `#6366f1` | fuchsia: `#d946ef` | emerald: `#34d399`
- CTA primario: `bg-white text-neutral-950` | CTA glass: `bg-white/10 border-white/20`
- Gradiente hero: `from-indigo-500 via-fuchsia-500 to-emerald-400`

**Tipografía:** Geist Sans + Geist Mono (ya en v2)

**Background animado:** 3 blobs (indigo/fuchsia/emerald) + radial gradients + grid 56px + grain SVG

**Componentes clave:** glassmorphism cards (rounded-2xl, bg-white/10, backdrop-blur, shadow doble)

**Assets:** `/public/brand/logo.png` (PNG 36x36) + apple-icon + template thumbnails

### 📊 Diferencias principales v2 vs v1
- Landing v2: sin blobs animados, sin template cards, sin prompt box glassmorphism
- Sidebar v2: 56px fija solo iconos vs v1 expandible 160-320px con labels + Recent + ThemeToggle
- Rutas v2 faltantes: /workspace (hub), /projects (carpetas), /templates (galería), /settings/profile
- Logo v2: SVG genérico azul vs v1: PNG real de marca

### 📋 Orden propuesto Fase 2
F2-M2 (rediseño visual base) → F2-M3 (organización docs) → F2-M4 (adjuntos IA) → F2-M5 (UX/polish) → F2-M6 (infra)

---

## Sesión 2026-03-19 — Cierre Fase 1 / M7: MVP público

### ✅ Completado
- Deploy app-api en Railway (`betternotes-production.up.railway.app`) — Dockerfile Node 20 + TexLive
- Deploy app-web en Vercel con dominio custom `www.better-notes.ai`
- Supabase Auth configurado: Site URL + redirect URLs para producción y localhost
- Stripe webhook registrado y verificado con HMAC — 3 eventos activos
- Post-deploy fix: sidebar de navegación (Documents / Pricing / Billing / Logout)
- Post-deploy fix: borrar documentos desde la lista (icono papelera en hover + DELETE /api/documents/[id])
- Documentación del proyecto actualizada (PROJECT.md, TASKS.md, PROGRESS.md)
- **Fase 1 — Reestructuración y creación desde cero — CERRADA**

### 🧠 Decisiones tomadas
- Sidebar icon-only (w-14) integrada en el layout de (app) — no rompe el workspace split-pane
- Delete con confirmación nativa (`confirm()`) — sin modal extra, suficiente para MVP
- h-full en workspace y h-full overflow-y-auto en documents list — adaptación al nuevo layout flex

### ⚠️ Deuda técnica conocida
- Stripe: race condition al crear customer con dos clicks rápidos (mitigación parcial en prod)
- Chat: cuota consumida por intento, no por PDF generado — pendiente decisión de producto
- STRIPE_WEBHOOK_SECRET en Railway con valor placeholder inicial — ya corregido con whsec_ real

### 📋 Backlog post-MVP priorizado
Ver TASKS.md — 5 categorías con prioridades 🔴🟡🟢:
- 🔴 Alta: subir archivos a specs, renombrar docs, mobile, tests E2E
- 🟡 Media: carpetas, landing mejorada, perfil, Sentry, plan anual
- 🟢 Baja: light mode, editor LaTeX, Teams, Claude como IA alternativa

---

## Sesión 2026-03-18 — M5: Freemium + Stripe

### ✅ Completado
- DB: RPC `check_and_increment_usage()` — atómica (check + increment en una transacción), aplicada en Supabase BetterNotesAI-3
- Enforcement: `generate/route.ts` y `chat/route.ts` verifican ownership del documento ANTES de consumir cuota, luego llaman a la RPC. Devuelven 402 `{ error: 'limit_reached' }` al superar el límite free (20/mes)
- Stripe Checkout: `POST /api/stripe/checkout` — busca-o-crea Stripe customer, crea hosted checkout session, embeds `supabase_user_id` en metadata
- Stripe Portal: `POST /api/stripe/portal` — crea billing portal session para gestión (cancelar, cambiar pago)
- Webhook: `POST /api/stripe/webhook` — verifica firma HMAC, maneja `checkout.session.completed` (activa pro), `customer.subscription.updated` (downgrade si `past_due`/`unpaid`), `customer.subscription.deleted` (revierte a free). Usa `service_role` para bypass de RLS
- Usage API: `GET /api/usage` — wraps RPC `get_usage_status()`
- UI: `/pricing` (tarjetas free vs pro), `/settings/billing` (barra de uso + portal), `UsageBanner` (aviso ≤5 generaciones), `UpgradeModal` (aparece en workspace al recibir 402)

### 🧠 Decisiones tomadas
- "Uso" = generaciones de PDF, no mensajes de chat — chat-only sin PDF no consume cuota
- Enforcement en route handlers (no en middleware Edge ni en app-api): únicos con acceso a identidad + Supabase transaccional
- Stripe Checkout hosted (no embedded): cero PCI, sin JS adicional
- RPC atómica evita race condition entre read-limit y write-count

### ⚠️ Deuda técnica documentada (no bloqueante para MVP)
- `chat/route.ts` incrementa cuota ANTES de saber si la respuesta será PDF o mensaje de texto. Si la IA responde con solo texto, el slot ya fue consumido. Decisión de producto pendiente: "pagar por intento" vs "pagar por PDF generado"
- Race condition al crear Stripe customer (dos clicks rápidos pueden crear dos customers). Mitigación: guardar `stripe_customer_id` inmediatamente tras crearlo, antes del webhook

### ➡️ Próximos pasos (M6 — pendiente aprobación)
- M6: UX completa + pulido — landing page, onboarding, popup de specs, diseño del chat

---

## Sesión 2026-03-18 — M4: Chat con historial

### ✅ Completado
- Bug fix: tras primera generación, `reloadMessages()` no se llamaba → el historial aparecía vacío hasta recargar la página. Ahora se hace `Promise.all([reloadDocument(), reloadMessages()])`.
- Timestamps en todas las burbujas del chat (campo `created_at` ya existía en DB, faltaba mostrarlo en UI)
- Indicador "Document updated" reemplazado por chip teal con checkmark cuando el mensaje de IA crea una versión nueva
- Nuevo componente `VersionSelector.tsx`: dropdown en el header del workspace que muestra el historial de versiones (número, fecha, estado de compilación, prompt truncado). Permite navegar a cualquier versión anterior cargando su PDF firmado.
- Hook `useDocumentWorkspace` actualizado: expone `versions`, `activeVersionId`, `versionNumber`, `switchVersion()`
- `ChatMessage` interface ampliada con `version_number?: number | null` (forward-compatible)

### 🧠 Decisiones tomadas
- `switchVersion()` limpia `currentPdfUrl` antes de llamar al hook, para que el PDF viewer use el signed URL actualizado del hook state en lugar del override local
- `VersionSelector` se cierra automáticamente con `mousedown` fuera del dropdown
- Historial de sesión anterior funciona desde M3 (mensajes se cargan desde `chat_messages` al montar el componente) — M4 corrige el bug de primera generación

### ➡️ Próximos pasos (M5 — pendiente aprobación)
- M5: Freemium + Stripe — límites de tier, upgrade, gestión de suscripción

---

## Sesión 2026-03-18 — M3: Generación de documentos

### ✅ Completado
- 10 plantillas implementadas (un archivo TypeScript por plantilla) con estructura v2:
  preamble + styleGuide + structureTemplate (skeleton con % FILL:) + structureExample (referencia)
- Plantillas nuevas creadas desde cero: `study_form` (alta densidad 3 cols) y `lecture_notes` (multi-página)
- OpenAIProvider completo: generateLatex() con modo refinamiento (roleplay pattern), fixLatex()
- Soporte de archivos adjuntos: imágenes (visión) + PDFs (extracción de texto)
- Endpoint POST /latex/generate-and-compile: genera → compila → fix automático si falla → responde PDF binario
- Endpoint POST /latex/compile-only: solo compila LaTeX (sin IA)
- Endpoint POST /latex/fix-latex: solo fix IA (sin compilar)
- Route Handlers en app-web: GET/POST /api/documents, POST /api/documents/[id]/generate, POST /api/documents/[id]/chat
- Workspace /documents/[id]/page.tsx: 3 paneles (visor PDF, chat, selector de plantilla)
- Seed aplicado a Supabase: 10 plantillas en tabla `templates` de BetterNotesAI-3
- Commit 88f0106 en rama v2

### 🧠 Decisiones tomadas
- structureTemplate vacío con % FILL: separa estructura de contenido → evita el bug de v1 donde IA copiaba el ejemplo
- Modo refinamiento: IA recibe el LaTeX anterior como su respuesta previa (roleplay) + nuevo prompt → más coherente
- Fix automático con un reintento: si pdflatex falla, GPT-4o corrige el LaTeX y recompila una vez antes de devolver error
- Plantillas hardcodeadas en app-api Y en DB: app-api usa TypeScript (seguro), frontend consulta DB (flexible)

### ⚠️ Puntos de atención
- Chat sin persistencia hasta M4 — el endpoint existe pero el historial no se guarda aún en chat_messages
- Plantillas en app-api son hardcodeadas — añadir plantilla nueva requiere deploy de app-api
- PDF preview en browser: componente PdfViewer implementado pero no probado end-to-end

### ➡️ Próximos pasos (M4)
- Implementar persistencia completa del chat en chat_messages
- Historial de chat visible en UI con burbujas usuario/assistant
- Vinculación chat_messages.version_id → document_versions
- Lista de documentos mejorada con estado, plantilla, fecha

---

## Sesión 2026-03-18 — M2: Auth + DB base (rama v2)

### Completado
- Creada rama v2 desde main
- Limpiado repo: eliminado todo el código de v1 en app-web, app-api/src/routes/, app-api/templates/, supabase/*.sql
- Conservado del v1: Dockerfile, package.json base, tsconfig.json, src/lib/latex.ts, src/lib/errors.ts
- Migraciones Supabase aplicadas al proyecto BetterNotesAI-3 (unnaedblaufyganyconl):
  - 8 tablas: profiles, subscriptions, templates, documents, document_versions, chat_messages, document_attachments, message_usage
  - FK circular diferida documents <-> document_versions
  - RLS completo en todas las tablas (owner_all + public select para templates)
  - SECURITY DEFINER owns_document() para evitar recursion en RLS de document_versions
  - Trigger on_auth_user_created -> handle_new_user() -> INSERT en profiles
  - RPCs: get_usage_status(), increment_message_count()
  - 4 Storage buckets: documents-output (privado), document-attachments (privado), template-previews (publico), user-avatars (publico) con politicas RLS de storage
- app-web reescrito limpio con @supabase/ssr SSR-safe:
  - lib/supabase/client.ts (browser), server.ts (server component), middleware.ts (updateSession)
  - middleware.ts: protege /documents, /settings, /templates, /pricing; redirige auth si ya logueado
  - app/(auth)/login y signup: formularios email+password + Google OAuth
  - app/(app)/documents: placeholder protegido (verifica sesion server-side)
  - app/auth/callback: handler OAuth code exchange
  - Build de Next.js: OK sin errores de TypeScript
- app-api nueva estructura base:
  - src/server.ts limpio (solo /health, sin rutas de v1)
  - src/lib/ai/types.ts: interfaces AIProvider, GenerateLatexArgs, etc.
  - src/lib/ai/openai.provider.ts: stub para M3
  - src/lib/ai/index.ts: factory createAIProvider()
  - .env.example completo
- .env.local de app-web actualizado para apuntar a BetterNotesAI-3
- Commit bb833b1 en rama v2

### Decisiones tomadas
- Usar BetterNotesAI-3 como proyecto Supabase de v2 (vacío y limpio)
- Auth via @supabase/ssr (no el antiguo supabase.ts monolitico de v1)
- RLS con SECURITY DEFINER owns_document() para evitar la recursion que causaba problemas en v1
- Plantillas almacenadas en tabla `templates` de Supabase (no archivos .tex estaticos)
- AI abstraída detras de interface AIProvider (soportara Anthropic en el futuro sin refactor)

### Proximos pasos (M3)
1. Disenar las plantillas iniciales (campos: preamble, style_guide, structure_template, structure_example)
2. Implementar OpenAIProvider.generateLatex() y fixLatex()
3. Crear endpoints backend: POST /documents/generate, POST /documents/:id/compile
4. Implementar UI de generacion de documentos

---

## Sesión 2026-03-18 — Setup inicial y análisis del producto

### ✅ Completado
- Análisis completo del producto y sus bloqueantes
- Documentación PROJECT.md, TASKS.md, PROGRESS.md creada
- Stack confirmado: Next.js + Supabase + Stripe + Railway + Vercel
- Modelo de negocio definido: freemium

### 🧠 Decisiones tomadas
- **Reescribir v2 desde cero:** los errores de v1 están demasiado entrelazados
- **La rama main se conserva intacta:** v2 es rama nueva y puede vaciarse
- **Supabase, Stripe y Railway se conservan:** cuentas ya configuradas
- **Stack frontend abierto:** Next.js por defecto pero el equipo puede proponer alternativa
- **IA abierta:** actualmente GPT-4, pero el Investigador debe evaluar si Claude es mejor para LaTeX antes de implementar

### 🐛 Problemas heredados de v1 (a no repetir en v2)
- Auth de Supabase mal integrado — sesiones no persisten
- Plantillas pasadas a la IA sin separación clara entre estructura y contenido teórico
- Chat sin persistencia en DB — mensajes se pierden al recargar
- RLS de Supabase probablemente mal configurado — datos de usuarios mezclados
- Sin manejo de errores de compilación LaTeX — fallos silenciosos

### 💡 Cosas importantes a resolver en M1
- El sistema de plantillas es la decisión más crítica del producto:
  cómo pasar la plantilla a la IA sin que confunda estructura con contenido
- Evaluar tectonic vs pdflatex para compilación (tectonic es más rápido y moderno)
- Definir claramente el flujo de modificaciones via chat: ¿la IA recibe el LaTeX
  anterior completo? ¿Solo el diff? ¿Un resumen?

### ➡️ Próximos pasos
1. Lanzar el equipo en Claude Code con el prompt de arranque
2. Investigador evalúa GPT-4 vs Claude para generación LaTeX
3. Arquitecto diseña la arquitectura v2 completa
4. **ESPERAR aprobación antes de implementar**

---
