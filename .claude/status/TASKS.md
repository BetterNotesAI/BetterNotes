# Tasks — BetterNotes

_Última actualización: 2026-03-24 (cierre de sesión)_
_Reestructuración completa del plan de producto tras revisión del nuevo documento de visión._

---

## Fase 1 — COMPLETADA ✅

Milestones M1-M7 completados: Auth, generación de documentos LaTeX, chat IA con historial,
freemium/Stripe, PDF viewer inline, templates, sidebar, home dashboard, attachments con
carpetas, modo guest (anonymous auth). MVP en producción: https://www.better-notes.ai

---

## Fase 2 — Milestones previos COMPLETADOS ✅

| # | Milestone | Estado |
|---|-----------|--------|
| F2-M1 | Diagnóstico visual + propuesta de diseño | ✅ Completado |
| F2-M2 | Rediseño visual y estructura de navegación | ✅ Completado |
| F2-M3 | Organización de documentos | ✅ Completado |
| F2-M4 | Subida de archivos como contexto IA | ✅ Completado |
| F2-M2b | Navegación, UX y flujo del producto | ✅ Completado |

---

## Fase 2 — CIERRE Y REFINAMIENTO

### F2-M5 — Auth refinements + Google OAuth + deuda técnica
_Prioridad: 🔴 Alta_

- [ ] F2-M5.1 — Configurar Google OAuth en Supabase Dashboard + Google Cloud Console · ~1h
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

_Criterio de aceptación: Sidebar muestra nueva estructura completa. All Documents tiene Starred, orden correcto, menús 3-dots completos y vista de carpeta con miniaturas._

---

### F2-M7 — Templates revamp
_Prioridad: 🟡 Media_

- [ ] F2-M7.1 — Reducir plantillas de 10 a 4 (marcar las demás `is_active = false`, no eliminar) · ~30min
  - 2-Column Portrait
  - 3-Column Landscape
  - 3-Column Portrait
  - Long Notes (Chapters)
- [ ] F2-M7.2 — Generar thumbnails PNG para cada una de las 4 plantillas (primera página como imagen) · ~1h
- [ ] F2-M7.3 — Mostrar thumbnail PNG encima del esquemático CSS existente (PNG como capa superior, esquemático como fallback si PNG no carga o no existe) · ~30min
- [ ] F2-M7.4 — PDF de muestra descargable por plantilla (subir a Supabase Storage, abrir en nueva pestaña) · ~1h
- [ ] F2-M7.5 — Mejorar estado visual de selección: borde de color vistoso + check en esquina superior derecha · ~30min

_Criterio de aceptación: 4 plantillas activas, thumbnail PNG encima del esquemático, PDF de muestra descargable, estado de selección claro._

---

## Fase 3 — VISOR INTERACTIVO ⭐

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

### F3-M1 — Arquitectura + PoC *(gate obligatorio antes de F3-M2)*
_Prioridad: 🔴 Alta_

- [ ] F3-M1.1 — Investigar y decidir estrategia de parsing LaTeX → bloques tipados · ~2h
  - Evaluar: latex-utensils, unified/remark-latex, parser manual por bloques
  - Tipos de nodo mínimos: sección, párrafo, fórmula-block, fórmula-inline, tabla, lista
  - Cada bloque: `{ id: uuid, type, latex_source, children? }`
- [ ] F3-M1.2 — Validar compatibilidad KaTeX con las fórmulas que genera GPT-4o en nuestros templates · ~1h
  - Compilar 20+ fórmulas reales de documentos existentes con KaTeX
  - Documentar macros no soportadas y definir estrategia (fallback o prompt adjustment)
- [ ] F3-M1.3 — Definir modelo de datos para bloques en la DB · ~1h
  - ¿Nueva tabla `document_blocks` o derivar on-the-fly del `.tex` en `document_versions`?
  - Considerar que editar un bloque genera nueva versión del `.tex` reconstruido
- [ ] F3-M1.4 — PoC mínimo: renderizar un `.tex` real como array de bloques con KaTeX en React · ~2h
  - Sin interactividad. Solo verificar que el pipeline produce output correcto para las 4 plantillas.
  - **Este PoC es el gate de entrada a F3-M2.**

_Criterio de aceptación: Decisión técnica documentada aquí. PoC renderiza al menos 2 plantillas correctamente._

---

### F3-M2 — Renderizado base
_Prerrequisito: F3-M1 completado_

- [ ] F3-M2.1 — Implementar parser LaTeX → bloques tipados completo para los 4 templates · ~2h
- [ ] F3-M2.2 — Componente React por tipo de bloque con renderizado KaTeX correcto · ~2h
  - Cada componente recibe `{ id, type, latex_source }` y renderiza HTML
- [ ] F3-M2.3 — Layout multi-columna según plantilla activa (CSS columns/grid) · ~1h30min
- [ ] F3-M2.4 — Toolbar superior: navegación de páginas virtuales + zoom · ~1h
- [ ] F3-M2.5 — **Ocultar toggles PDF / PDF+LaTeX / LaTeX en el workspace** (código intacto, solo UI oculta) · ~30min
- [ ] F3-M2.6 — El workspace `/workspace/[id]` muestra el visor interactivo como vista principal · ~1h
- [ ] F3-M2.7 — Botón "Descargar PDF" siempre visible (llama al pdflatex del backend, sin cambios) · ~30min

_Criterio de aceptación: Un documento con cualquiera de las 4 plantillas se visualiza en el workspace con layout correcto y fórmulas renderizadas._

---

### F3-M3 — Interactividad (patrón Typora)
_Prerrequisito: F3-M2 completado_

- [ ] F3-M3.1 — Hover sobre bloque → borde sutil resaltado · ~30min
- [ ] F3-M3.2 — Click en bloque → borde marcado, contenido sigue renderizado (estado "focused") · ~30min
- [ ] F3-M3.3 — Click/doble click en texto dentro del bloque → ese fragmento pasa a modo edición (muestra LaTeX crudo en input/textarea) · ~1h30min
  - Ejemplo: "el radio es R > 4/3" → editable como "el radio es $R>\frac{4}{3}$"
  - El resto del bloque sigue renderizado
- [ ] F3-M3.4 — Enter o click fuera → re-renderiza solo ese fragmento con KaTeX, persiste cambio · ~1h
- [ ] F3-M3.5 — Selección de texto con el ratón → click derecho → menú contextual con "Referenciar en chat" · ~1h
- [ ] F3-M3.6 — Toolbar de formato: H1/H2, bold, italic, underline, formula, color, boxed (afectan al bloque focused) · ~2h
- [ ] F3-M3.7 — Auto-detección del tipo de bloque para activar/desactivar acciones de toolbar · ~30min

_Criterio de aceptación: El usuario puede editar cualquier fragmento inline, confirmar y ver el re-render KaTeX. Puede seleccionar texto y acceder al menú contextual._

---

### F3-M4 — Chat contextual
_Prerrequisito: F3-M3 completado_

- [ ] F3-M4.1 — Panel lateral de chat en el workspace vinculado al visor · ~1h
  - Sin selección: "Selecciona un fragmento para editar con IA"
  - Con fragmento referenciado: muestra el contexto en la parte superior
- [ ] F3-M4.2 — "Referenciar en chat" añade el fragmento como contexto visible en el panel · ~1h
- [ ] F3-M4.3 — El prompt se envía al backend junto con: fragmento seleccionado + tipo de bloque + bloques adyacentes como contexto · ~1h30min
- [ ] F3-M4.4 — Respuesta del backend: preview del fragmento modificado con KaTeX en el panel de chat · ~1h
- [ ] F3-M4.5 — Botones "Aplicar" / "Descartar" en el preview → aplicar reemplaza el bloque en el visor · ~1h
- [ ] F3-M4.6 — Cambios persistidos en DB: reconstruir `.tex` desde bloques y guardar nueva versión · ~1h30min
- [ ] F3-M4.7 — Undo/redo básico en memoria (Ctrl+Z / Ctrl+Y) dentro de la sesión · ~1h

_Criterio de aceptación: El usuario puede referenciar un fragmento, pedir a la IA que lo modifique, ver el preview y aplicarlo. El PDF descargado refleja los cambios._

---

### F3-M5 — Publish to My Studies + polish
_Prerrequisito: F3-M4 completado. F5-M1 debe estar al menos parcialmente listo._

- [ ] F3-M5.1 — Botón "Publish to My Studies" en el visor (modal: universidad, grado, asignatura, visibilidad, keywords) · ~1h
- [ ] F3-M5.2 — Keywords auto-generadas por GPT-4o al publicar (editables antes de confirmar) · ~1h
- [ ] F3-M5.3 — Polish visual: skeleton loader, transiciones suaves, indicador "Guardado hace Xs" · ~1h
- [ ] F3-M5.4 — Accesibilidad básica: bloques focusables con Tab, Enter abre edición, ARIA labels · ~1h

_Criterio de aceptación: Documento publicable a My Studies con keywords auto-generadas. Visor con polish visual y accesibilidad básica._

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

### F5-M1 — My Studies
Primera vez: picker de universidad (BD completa universidades españolas) + picker de grado.
Soporte multi-universidad con botón (+). Estructura jerárquica: Universidad → Grado →
Asignaturas → carpetas por tipo (apuntes, formularios, exámenes). Diseño estilo Proxus.
Sistema de likes y visualizaciones por documento.

---

### F5-M2 — Publish to My Studies workflow
_Prerrequisito: F5-M1 completado_

Workflow completo de publicación desde cualquier feature. Keywords auto-generadas via GPT-4o.
Visibilidad pública/privada. Categorización dentro de la estructura de My Studies. (Integra
con el botón ya implementado en F3-M5.)

---

### F5-M3 — Search
_Prerrequisito: F5-M2 completado_

Buscador con lista split: arriba "Tus Proyectos", abajo "Proyectos de otros" (con universidad
y likes). Filtros: Tipo (Cheat Sheet/Apuntes/Problemas/Examen), Universidad, Grado, Año,
Materia, Idioma. Ordenación por likes o más reciente. Thumbnails, autor y fecha en resultados.

---

## Fase 6 — PERFIL Y CONFIGURACIÓN

### F6-M1 — User Profile
Página /profile/[username]: foto de perfil, imagen de banner, bio corta, universidad/estudios,
botón "Edit" para el propio usuario. Catálogo público estilo Lovable (grid con thumbnails,
toggle visible/oculto por documento). Estadísticas (materias estudiadas, progreso en exámenes,
documentos publicados). Otros usuarios pueden visitar el perfil desde documentos publicados.

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

## Deuda técnica conocida

| Severidad | Descripción | Milestone |
|-----------|-------------|-----------|
| 🔴 Alta | Google OAuth pendiente en Supabase + Google Cloud | F2-M5.1 |
| 🟡 Media | Chat consume cuota por intento, no por PDF generado | Decisión de producto pendiente |
| ✅ Resuelto | Race condition Stripe customer con doble click | F2-M5.5 |
| 🟡 Media | app-api requiere redeploy manual en Railway — bloqueado por crédito trial ($4.86) | F2-M5.6 |
| 🟢 Baja | Plantillas hardcodeadas en app-api | Se resuelve en F2-M7 |
| 🟢 Baja | Exportar .tex además del PDF | Pendiente |
| 🟢 Baja | `onTrigger` en NewDocumentWatcher debería estar en useCallback | Pendiente |

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
