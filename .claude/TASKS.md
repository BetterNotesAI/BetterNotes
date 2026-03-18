# Tasks — BetterNotes v2

_Última actualización: 2026-03-19_

---

## Milestones

| # | Milestone | Estado | Descripción |
|---|-----------|--------|-------------|
| M1 | Arquitectura y diagnóstico | COMPLETADO | Analizar v1, diseñar v2, aprobar antes de implementar |
| M2 | Auth + DB + base del proyecto | COMPLETADO | Supabase Auth estable, esquema DB, estructura Next.js |
| M3 | Generación de documentos | COMPLETADO | IA → LaTeX → PDF compilado → preview en browser |
| M4 | Chat con historial | COMPLETADO | Chat de modificaciones persistente, flujo completo |
| M5 | Freemium + Stripe | COMPLETADO | Límites de tier, upgrade, gestión de suscripción |
| M6 | UX completa + pulido | COMPLETADO | Popup de specs, diseño del chat, onboarding, landing |
| M7 | MVP público | COMPLETADO | Deploy estable, beta users |

---

## Estado — Fase 1 completada ✅

**Fecha de cierre:** 2026-03-19
Todos los milestones M1–M7 completados. MVP en producción en https://www.better-notes.ai.
Próxima fase: mejoras iterativas sobre el producto según feedback de usuarios reales.

---

## Backlog post-MVP

_Prioridad: 🔴 Alta · 🟡 Media · 🟢 Baja_

### Gestión de documentos
- 🔴 Renombrar documentos (el endpoint PATCH ya existe — solo falta UI inline)
- 🟡 Carpetas para organizar documentos (requiere tabla `folders` en DB)
- 🟡 Archivar / ocultar documentos sin borrarlos
- 🟢 Ordenar y filtrar la lista de documentos (por fecha, plantilla, estado)
- 🟢 Marcar documentos como favoritos (estrella — columna `is_starred` ya existe)

### Generación con IA
- 🔴 Subir archivos en el popup de specs (PDF, DOCX, imagen) como contexto para la IA
- 🟡 Mejorar el prompt del sistema según feedback de usuarios reales
- 🟡 Soporte para más plantillas (actualmente 10)
- 🟢 Permitir editar el LaTeX directamente desde el workspace
- 🟢 Exportar también en formato .tex (además del PDF)

### UX y diseño
- 🔴 Mobile: layout responsive funcional en teléfono
- 🟡 Landing page mejorada: ejemplo real de PDF generado, testimonios, FAQ
- 🟡 Onboarding interactivo para nuevos usuarios (tooltip tour o modal guiado)
- 🟡 Sidebar expandible con nombres de los enlaces (no solo iconos)
- 🟢 Tema claro (light mode)
- 🟢 Atajos de teclado en el workspace

### Cuenta y billing
- 🟡 Página de perfil: cambiar nombre, avatar, contraseña
- 🟡 Historial de facturas (ya disponible en Stripe Customer Portal)
- 🟡 Plan anual con descuento
- 🟢 Tier Teams / multi-usuario

### Técnico / infraestructura
- 🔴 Tests end-to-end automáticos (Playwright) para el flujo principal
- 🟡 Monitorización de errores en producción (Sentry o similar)
- 🟡 Caché de PDFs — evitar recompilar si el LaTeX no cambió
- 🟡 Límites de uso más granulares (por documento, no solo mensual)
- 🟢 Soporte para Anthropic Claude como proveedor de IA alternativo (interface AIProvider ya preparada)

---

## Decisiones técnicas tomadas

| Decisión | Razón | Fecha |
|----------|-------|-------|
| Reescribir desde cero (v2) | Los errores de v1 están demasiado entrelazados para parchear | Marzo 2026 |
| Conservar Supabase + Stripe + Railway | Cuentas configuradas, stack adecuado para el producto | Marzo 2026 |
| DB v2: BetterNotesAI-3 (unnaedblaufyganyconl) | Proyecto vacío y limpio, separado de BetterNotesAI v1 | 2026-03-18 |
| Auth: @supabase/ssr con middleware SSR-safe | Evita el problema de sesiones no persistentes de v1 | 2026-03-18 |
| Esquema DB normalizado con FK diferida | documents <-> document_versions FK circular resuelta con DEFERRABLE | 2026-03-18 |
| RLS con SECURITY DEFINER owns_document() | Evita recursión en RLS de document_versions al hacer JOIN con documents | 2026-03-18 |
| AI interface AIProvider | Desacoplamiento para soporte futuro de Anthropic sin refactor | 2026-03-18 |
| Plantillas en DB (tabla templates) | Más flexible que archivos .tex estáticos; permite is_pro, previews, sort_order | 2026-03-18 |
