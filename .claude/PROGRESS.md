# Progress Log — BetterNotes v2

_Las sesiones más recientes aparecen primero._

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
- AI abstraida detras de interface AIProvider (soportara Anthropic en el futuro sin refactor)

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
