# BetterNotes v2

_Última actualización: 2026-03-19_

---

## Descripción
Plataforma web que permite a estudiantes (especialmente de física, matemáticas e ingeniería)
generar documentos de estudio mediante IA, basados en plantillas LaTeX.
El usuario selecciona una plantilla, describe lo que necesita y la IA genera un PDF
listo para imprimir. El documento puede refinarse mediante un chat iterativo con la IA.

## Propuesta de valor
- Documentos con calidad tipográfica LaTeX (fórmulas, símbolos) sin saber LaTeX
- Generación por IA con 10 plantillas académicas predefinidas
- Personalización mediante chat: el usuario refina el resultado iterativamente
- Freemium: tier gratuito funcional, upgrade a Pro por $9/mes con Stripe

## Estado actual
- **Fase:** Fase 2 en curso — F2-M2 completado
- **URL producción:** https://www.better-notes.ai
- **Rama activa:** v2
- **Último commit:** `cf6c6b5` — fix LaTeX syntax highlighting paleta completa

---

## Stack tecnológico

| Capa | Tecnología | Detalle |
|------|-----------|---------|
| Frontend | Next.js 14 (App Router) | Vercel — www.better-notes.ai |
| Backend API | Node.js + Express + TypeScript | Railway — betternotes-production.up.railway.app |
| Compilación LaTeX | pdflatex (TexLive) | Dentro del Dockerfile de app-api en Railway |
| Base de datos | Supabase PostgreSQL | Proyecto BetterNotesAI-3 (unnaedblaufyganyconl) |
| Auth | Supabase Auth + @supabase/ssr | SSR-safe, Google OAuth + email/password |
| Storage | Supabase Storage | Bucket documents-output — PDFs con signed URLs (1h) |
| Pagos | Stripe | Checkout hosted, Customer Portal, webhooks HMAC |
| IA generativa | OpenAI gpt-4o-mini | Interface AIProvider desacoplada (soporta Anthropic sin refactor) |
| Estilos | Tailwind CSS | Tema oscuro (#0a0a0a) |

---

## Arquitectura

```
[Usuario]
    ↓ selecciona plantilla + escribe specs + prompt
[app-web — Next.js / Vercel]
    ↓ Route Handler → POST /api/documents/[id]/generate
[app-api — Express / Railway]
    ↓ OpenAI → LaTeX → pdflatex → PDF binario
[Supabase Storage]
    ↓ PDF guardado, signed URL devuelto al frontend
[Workspace /documents/[id]]
    ↓ PDF viewer + chat iterativo
[chat → POST /api/documents/[id]/chat]
    ↓ LaTeX anterior + nuevo prompt → re-genera → re-compila → nueva versión
```

---

## Estructura del repositorio

```
BetterNotes/
├── app-web/          # Next.js 14 — frontend + API routes
│   ├── app/
│   │   ├── (auth)/   # login, signup, auth/callback
│   │   ├── (app)/    # layout con sidebar, documents, pricing, settings
│   │   ├── api/      # Route Handlers: documents, stripe, usage
│   │   └── page.tsx  # Landing pública
│   └── lib/supabase/ # cliente SSR y cliente browser
├── app-api/          # Express + TypeScript — compilación LaTeX + IA
│   ├── src/
│   │   ├── routes/   # /latex/generate-and-compile, /compile-only, /fix-latex
│   │   ├── lib/ai/   # AIProvider interface + OpenAIProvider
│   │   └── templates/# 10 plantillas LaTeX en TypeScript
│   └── Dockerfile    # Node 20 + TexLive
└── supabase/
    └── migrations/   # Esquema DB versionado
```

---

## Modelo de datos (tablas principales)

| Tabla | Descripción |
|-------|-------------|
| profiles | Extensión de auth.users — plan (free/pro), stripe_customer_id |
| documents | Documento del usuario — title, template_id, status, current_version_id |
| document_versions | Versión compilada — latex_content, pdf_storage_path, version_number |
| chat_messages | Historial del chat — role, content, version_id asociado |
| templates | 10 plantillas con displayName, isPro, sort_order |
| subscriptions | Sincronizado con Stripe webhooks |
| message_usage | Contador mensual de generaciones por usuario |

---

## Modelo de negocio

| Tier | Precio | Límite |
|------|--------|--------|
| Free | $0 | 20 generaciones/mes |
| Pro | $9/mes | Ilimitado |

Enforcement: RPC atómica `check_and_increment_usage()` en Supabase (evita race conditions).
Cobro: Stripe Checkout hosted + Customer Portal para gestión.

---

## Decisiones técnicas clave

| Decisión | Razón |
|----------|-------|
| Reescritura completa (v2) | Errores de v1 demasiado entrelazados para parchear |
| structureTemplate vacío con % FILL: | Evita que la IA copie contenido de ejemplo de la plantilla (bug v1) |
| RPC atómica check_and_increment_usage | Previene race conditions entre check de límite e incremento |
| Enforcement en Route Handlers (no middleware Edge) | Únicos con acceso a identidad Supabase + transacciones DB |
| Stripe Checkout hosted (no embedded) | Cero PCI scope, sin JS adicional |
| Auth con @supabase/ssr | Evita el problema de sesiones no persistentes de v1 |
| FK circular documents↔document_versions con DEFERRABLE | Resuelve la dependencia circular sin eliminar integridad referencial |
| RLS con SECURITY DEFINER owns_document() | Evita recursión en RLS de document_versions al hacer JOIN con documents |
