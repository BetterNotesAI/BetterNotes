# Tasks — BetterNotes v2

_Última actualización: 2026-03-19_

---

## Milestones Fase 1 — COMPLETADOS ✅

| # | Milestone | Estado |
|---|-----------|--------|
| M1 | Arquitectura y diagnóstico | ✅ COMPLETADO |
| M2 | Auth + DB + base del proyecto | ✅ COMPLETADO |
| M3 | Generación de documentos | ✅ COMPLETADO |
| M4 | Chat con historial | ✅ COMPLETADO |
| M5 | Freemium + Stripe | ✅ COMPLETADO |
| M6 | UX completa + pulido | ✅ COMPLETADO |
| M7 | MVP público | ✅ COMPLETADO |

**MVP en producción:** https://www.better-notes.ai

---

## Milestones Fase 2

| # | Milestone | Estado | Descripción |
|---|-----------|--------|-------------|
| F2-M1 | Diagnóstico visual + propuesta de diseño | ✅ COMPLETADO | Analizar v1 (rama main), proponer orden óptimo, referencias visuales |
| F2-M2 | Rediseño visual y estructura de navegación | ✅ COMPLETADO | Recuperar estilo v1, nueva landing, flujo de páginas, icono/marca |
| F2-M3 | Organización de documentos | ⏳ Pendiente | Carpetas, renombrar docs, favoritos, filtros |
| F2-M4 | Subida de archivos como contexto IA | ⏳ Pendiente | PDF, imágenes, DOCX → contexto para generación + imágenes en LaTeX |
| F2-M5 | Mejoras de UX y pulido | ⏳ Pendiente | Mobile responsive, onboarding, sidebar expandible, perfil |
| F2-M6 | Infraestructura y calidad | ⏳ Pendiente | Tests E2E, Sentry, caché de PDFs, monitorización |

---

## Detalle y backlog por milestone

### F2-M1 — Diagnóstico visual + propuesta de diseño ✅
- [x] Analizar rama main: paleta, tipografía, componentes visuales clave
- [x] Mapear flujo de navegación de v1 (landing → workspace → workspace/[id] → projects → templates)
- [x] Proponer orden óptimo de implementación de Fase 2 con justificación
- [x] **PAUSA — esperando aprobación antes de F2-M2**

### F2-M2 — Rediseño visual y estructura de navegación
_Prioridad: 🔴 Alta_

- [ ] Recuperar paleta de colores, tema y tipografía de v1
- [ ] Icono / favicon de la aplicación
- [ ] Landing page rediseñada: página de presentación inicial que ve el usuario al entrar
- [ ] Flujo de navegación: landing → login → workspace → documents / templates
- [ ] Sidebar expandible con nombres de los enlaces (no solo iconos) 🟡
- [ ] Workspace /documents/[id]: recuperar estilo visual del visor de PDF de v1
- [ ] Revisor valida consistencia visual antes de cerrar milestone

### F2-M3 — Organización de documentos
_Prioridad: 🔴/🟡_

- [ ] 🔴 Renombrar documentos inline (endpoint PATCH ya existe — solo falta UI)
- [ ] 🟡 Carpetas para organizar documentos (requiere tabla `folders` en DB)
- [ ] 🟡 Archivar / ocultar documentos sin borrarlos
- [ ] 🟢 Ordenar y filtrar lista de documentos (por fecha, plantilla, estado)
- [ ] 🟢 Marcar documentos como favoritos (columna `is_starred` ya existe en DB)

### F2-M4 — Subida de archivos como contexto IA
_Prioridad: 🔴 Alta_

- [ ] UI: zona de subida en popup de specs (drag & drop + click)
- [ ] Tipos soportados: PDF, imágenes (jpg/png/webp), DOCX
- [ ] Backend: extracción de texto de PDFs (pdf-parse ya en dependencias)
- [ ] Backend: extracción de texto de DOCX (mammoth.js)
- [ ] Backend: visión para imágenes (ya soportado en OpenAIProvider)
- [ ] Imágenes en el LaTeX: el usuario sube una imagen y la IA la incluye en el PDF generado
- [ ] Storage: guardar adjuntos en bucket `document-attachments` (ya existe en Supabase)
- [ ] Límites: tamaño máximo por archivo, número máximo por generación
- [ ] 🟡 Mejorar el prompt del sistema según feedback de usuarios reales
- [ ] 🟡 Soporte para más plantillas (actualmente 10)
- [ ] 🟢 Permitir editar el LaTeX directamente desde el workspace
- [ ] 🟢 Exportar también en formato .tex (además del PDF)

### F2-M5 — Mejoras de UX y pulido
_Prioridad: 🔴/🟡_

- [ ] 🔴 Mobile: layout responsive funcional en teléfono
- [ ] 🟡 Landing page mejorada: ejemplo real de PDF generado, testimonios, FAQ
- [ ] 🟡 Onboarding interactivo para nuevos usuarios (tooltip tour o modal guiado)
- [ ] 🟡 Página de perfil: cambiar nombre, avatar, contraseña
- [ ] 🟡 Historial de facturas (ya disponible en Stripe Customer Portal)
- [ ] 🟡 Plan anual con descuento (Stripe)
- [ ] 🟢 Tema claro (light mode)
- [ ] 🟢 Atajos de teclado en el workspace
- [ ] 🟢 Tier Teams / multi-usuario

### F2-M6 — Infraestructura y calidad
_Prioridad: 🔴/🟡_

- [ ] 🔴 Tests E2E automáticos con Playwright (flujo principal: login → generar → chat)
- [ ] 🟡 Sentry para monitorización de errores en producción
- [ ] 🟡 Caché de PDFs: evitar recompilar si el LaTeX no cambió
- [ ] 🟡 Límites de uso más granulares (por documento, no solo mensual)
- [ ] 🟢 Soporte Anthropic Claude como IA alternativa (AIProvider ya preparada)

---

## Deuda técnica conocida (heredada de Fase 1)

| Severidad | Descripción | Estado |
|-----------|-------------|--------|
| 🟡 Media | Chat consume cuota por intento, no por PDF generado — decisión de producto pendiente | Pendiente |
| 🟡 Media | Race condition al crear Stripe customer con dos clicks rápidos | Mitigación parcial |
| 🟢 Baja | Plantillas hardcodeadas en app-api — añadir plantilla nueva requiere deploy | Pendiente |
| 🟢 Baja | Exportar .tex además del PDF | Pendiente |

---

## Decisiones técnicas tomadas (Fase 1)

| Decisión | Razón | Fecha |
|----------|-------|-------|
| Reescritura completa (v2) | Errores de v1 demasiado entrelazados | Marzo 2026 |
| DB: BetterNotesAI-3 (unnaedblaufyganyconl) | Proyecto vacío y limpio separado de v1 | 2026-03-18 |
| Auth: @supabase/ssr SSR-safe | Evita sesiones no persistentes de v1 | 2026-03-18 |
| Esquema DB normalizado con FK diferida | documents ↔ document_versions resuelto con DEFERRABLE | 2026-03-18 |
| RLS con SECURITY DEFINER owns_document() | Evita recursión en RLS de document_versions | 2026-03-18 |
| AIProvider interface desacoplada | Permite cambiar a Anthropic sin refactor | 2026-03-18 |
| structureTemplate con % FILL: | Evita que IA copie contenido de ejemplo (bug v1) | 2026-03-18 |
| RPC atómica check_and_increment_usage | Previene race conditions en límite freemium | 2026-03-18 |
| Stripe Checkout hosted | Cero PCI scope, sin JS adicional | 2026-03-18 |
| Plantillas en DB (tabla templates) | Flexible, permite is_pro, previews, sort_order | 2026-03-18 |