# Tasks — BetterNotes v2

_Última actualización: 2026-03-21_

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
| F2-M1 | Diagnóstico visual + propuesta de diseño | ✅ COMPLETADO | Analizar v1, proponer orden óptimo |
| F2-M2 | Rediseño visual y estructura de navegación | ✅ COMPLETADO | Estilo v1, landing, visor PDF, sidebar |
| F2-M3 | Organización de documentos | ✅ COMPLETADO | Carpetas, renombrar, favoritos, filtros |
| F2-M4 | Subida de archivos como contexto IA | ✅ COMPLETADO | PDF, imágenes, DOCX + imágenes en LaTeX |
| F2-M2b | Navegación, UX y flujo del producto | 🔄 **EN CURSO** (5/7 bloques) | Sidebar, Home dashboard, landing bar, chat IA, modo guest |
| F2-M5 | Mejoras de UX y pulido | ⏳ Pendiente | Mobile responsive, onboarding, perfil |
| F2-M6 | Infraestructura y calidad | ⏳ Pendiente | Tests E2E, Sentry, caché PDFs |

---

## Detalle por milestone

### F2-M2b — Navegación, UX y flujo del producto 🔄 EN CURSO
_Prioridad: 🔴 Alta — implementar antes de F2-M5 y F2-M6_

#### Progreso de bloques

| Bloque | Descripción | Estado |
|--------|-------------|--------|
| B5 | Respuestas IA descriptivas + indicador carga multifase | ✅ COMPLETADO |
| B6 | Carpetas en Attachments + drag & drop | ✅ COMPLETADO |
| B1 | Sidebar reestructurada + fix useSearchParams Suspense | ✅ COMPLETADO |
| B4 | DocumentCreationBar (landing, home, documents) | ✅ COMPLETADO |
| B3 | Página de Templates — look v1 | ⏳ SIGUIENTE |
| B2 | Home dashboard completo (blobs, polish visual) | ⏳ Pendiente |
| B7 | Modo guest (Supabase anonymous auth) | ⏳ Pendiente |

#### Detalle de bloques pendientes

##### B3 — Página de Templates
- [ ] Grid de plantillas estilo v1 (glassmorphism cards, referencia VISUAL_IDENTITY.md)
- [ ] Al clicar plantilla → modal/popover con preview en zoom
- [ ] Botón "Use template" que abre la creation bar con esa plantilla preseleccionada
- [ ] Mantener ruta `/templates`

##### B2 — Home dashboard (polish visual)
- [ ] Añadir blobs animados al fondo (igual que landing — animate-blob1/2/3)
- [ ] Grid sutil de fondo (igual que AppBackground)
- [ ] El contenido (barra + recientes) ya está implementado en B4
- [ ] Añadir acceso rápido a plantillas populares (opcional)

##### B7 — Modo guest
- [ ] Solución técnica: Supabase anonymous auth (propuesta del equipo)
- [ ] Restricciones: 1 documento, máximo 2-3 mensajes
- [ ] Al superar límite → modal de registro con propuesta de valor
- [ ] Recuperar documento guest si el usuario se registra inmediatamente
- [ ] Implementar en landing (creation bar) y home

#### Notas de implementación (B4 completado)
- `DocumentCreationBar` en `app-web/app/_components/` (fuera de `(app)` para ser usable en landing)
- `LandingCreationBar` en `app-web/app/components/` — wrapper client para landing
- El prompt de la barra se pasa como `?prompt=` URL param al workspace
- `InitialPromptSender` en workspace page (Suspense-wrapped) auto-envía el primer mensaje
- Modal de documents page reemplaza el flujo 2-pasos (TemplateSelector + SpecsModal)

---

### F2-M5 — Mejoras de UX y pulido ⏳ Pendiente
_Implementar después de F2-M2b_

- [ ] 🔴 Mobile: layout responsive funcional en teléfono
- [ ] 🟡 Landing page mejorada: ejemplo real de PDF generado, testimonios, FAQ
- [ ] 🟡 Onboarding interactivo para nuevos usuarios (tooltip tour o modal guiado)
- [ ] 🟡 Página de perfil: cambiar nombre, avatar, contraseña
- [ ] 🟡 Historial de facturas (Stripe Customer Portal)
- [ ] 🟡 Plan anual con descuento (Stripe)
- [ ] 🟢 Tema claro (light mode)
- [ ] 🟢 Atajos de teclado en el workspace
- [ ] 🟢 Tier Teams / multi-usuario

### F2-M6 — Infraestructura y calidad ⏳ Pendiente

- [ ] 🔴 Tests E2E automáticos con Playwright
- [ ] 🟡 Sentry para monitorización de errores en producción
- [ ] 🟡 Caché de PDFs
- [ ] 🟡 Límites de uso más granulares
- [ ] 🟢 Soporte Anthropic Claude como IA alternativa

---

## Deuda técnica conocida

| Severidad | Descripción | Estado |
|-----------|-------------|--------|
| 🟡 Media | Chat consume cuota por intento, no por PDF — decisión de producto pendiente | Pendiente |
| 🟡 Media | Race condition al crear Stripe customer con dos clicks rápidos | Mitigación parcial |
| 🟡 Media | app-api (Railway) requiere redeploy manual — B5 changes no se autodeploy con git push | Pendiente |
| 🟢 Baja | Plantillas hardcodeadas en app-api — añadir plantilla requiere deploy | Pendiente |
| 🟢 Baja | Exportar .tex además del PDF | Pendiente |
| 🟢 Baja | `onTrigger` en NewDocumentWatcher debería estar en useCallback para evitar re-renders | Pendiente |

---

## Decisiones técnicas tomadas

| Decisión | Razón | Fecha |
|----------|-------|-------|
| Reescritura completa (v2) | Errores de v1 demasiado entrelazados | Marzo 2026 |
| DB: BetterNotesAI-3 (unnaedblaufyganyconl) | Proyecto vacío y limpio separado de v1 | 2026-03-18 |
| Auth: @supabase/ssr SSR-safe | Evita sesiones no persistentes de v1 | 2026-03-18 |
| Esquema DB normalizado con FK diferida | documents ↔ document_versions con DEFERRABLE | 2026-03-18 |
| RLS con SECURITY DEFINER owns_document() | Evita recursión en RLS | 2026-03-18 |
| AIProvider interface desacoplada | Permite cambiar a Anthropic sin refactor | 2026-03-18 |
| structureTemplate con % FILL: | Evita que IA copie contenido de ejemplo (bug v1) | 2026-03-18 |
| RPC atómica check_and_increment_usage | Previene race conditions en límite freemium | 2026-03-18 |
| Stripe Checkout hosted | Cero PCI scope | 2026-03-18 |
| Plantillas en DB (tabla templates) | Flexible, permite is_pro, previews, sort_order | 2026-03-18 |
| Adjuntos como contexto automático | Chat y generate reciben archivos del DB sin UI extra | 2026-03-20 |
| DocumentCreationBar fuera de (app) | Usable tanto en landing (Server Component) como en app | 2026-03-21 |
| Prompt vía ?prompt= URL param al workspace | Evita localStorage; InitialPromptSender auto-envía en draft | 2026-03-21 |
| Sidebar carpetas: create/rename/color/delete inline | Sin modal extra, acciones on-hover + color picker portal | 2026-03-21 |
