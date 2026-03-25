# STATUS — BetterNotes v2

> Estado actual del proyecto en una lectura rápida.
> Actualizado por el director al inicio y cierre de cada sesión.

---

## Estado actual

**Fase:** 2 — Cierre y refinamiento
**Milestone activo:** F2-M7 — Templates revamp — CASI COMPLETO
**Progreso F2-M7:** M7.1 ✅ M7.2 ✅ M7.3 ✅ M7.4 ✅ (UI) ⚠️ (lecture_notes.pdf pendiente) M7.5 ✅ Auto-template ✅
**Último milestone de main:** F2-M6 COMPLETO + fix "Unfiled→Documents" (b24f0a7 — 2026-03-25)
**Rama activa:** feature/f2-m7-templates-revamp
**Bloqueantes:** F2-M5.1 Google OAuth (requiere Supabase Dashboard + Google Cloud Console) | F2-M5.6 Railway autodeploy (bloqueado por crédito trial $4.86)

## Plan reestructurado — 2026-03-22

Plan de producto revisado completamente. Nuevas fases y milestones en TASKS.md.
Feature estratégica central: **Visor Interactivo (Fase 3)** — patrón Typora sobre LaTeX,
workspace `/workspace/[id]` se convierte en el visor, modos de vista actuales ocultos.

## Completado en F2-M5

- [x] F2-M5.2 — "Sign in" → "Log in" rename (sesión anterior)
- [x] F2-M5.3 — Forgot Password + Reset Password flow
- [x] F2-M5.3 bugfix — useSearchParams() envuelto en Suspense en forgot-password/page.tsx (fix Vercel build error)
- [x] F2-M5.4 — Logo BetterNotes reposicionado en header externo en las 4 páginas de auth (login, signup, forgot-password, reset-password)
- [x] F2-M5.5 — Fix race condition Stripe customer con doble click (UNIQUE constraint en profiles.stripe_customer_id + RPCs get_or_reserve_stripe_customer y set_stripe_customer_id + migración aplicada en Supabase Dashboard)
- [x] F2-M5.6 — railway.json creado en app-api/ + instrucciones Railway Dashboard documentadas (activación bloqueada por crédito trial)

## Completado en F2-M7 (sesión 2026-03-25)

- [x] F2-M7.1 — 4 plantillas activas, 6 marcadas is_active=false en DB (migración aplicada)
- [x] F2-M7.2 — 10 thumbnails PNG generados (480×360px) en public/templates/thumbnails/
- [x] F2-M7.3 — Thumbnail PNG sobre esquemático CSS con fallback en templates page
- [x] F2-M7.4 — 9/10 PDFs de muestra generados + botón "Sample" en card grid + "Preview sample PDF" en modal
- [x] F2-M7.5 — Selección visual: borde accent + check badge en card seleccionada
- [x] Auto-template — Modo "Auto": gpt-4o-mini elige la plantilla óptima según el prompt; resuelve en app-api y actualiza template_id en DB tras generar
- [⚠️] lecture_notes.pdf — Regenerar tras reiniciar app-api (fix workedexample ya aplicado en lecture_notes.ts)

## Próximas tareas

**F2-M5** (pendientes):
1. 🔴 Google OAuth — requiere acceso a Supabase Dashboard + Google Cloud Console

**F2-M5.6 — ACCION MANUAL REQUERIDA:** Configurar en Railway Dashboard:
  - Settings > Source > Root Directory = `app-api`
  - Settings > Source > Watch Paths = `app-api/**`
  - Settings > Source > Branch = `main`
  - Verificar que autodeploy esta habilitado

**F2-M7 — PENDIENTE antes de merge:**
- Regenerar lecture_notes.pdf (reiniciar app-api → ejecutar scripts/generate-sample-pdfs.js solo para lecture_notes)
- Merge feature/f2-m7-templates-revamp → main + PR

**Después:** F3 — Visor Interactivo (patrón Typora)

---

## Decisiones activas a recordar

| Decisión | Valor |
|----------|-------|
| Prompt al workspace | Vía `?prompt=` URL param — no localStorage |
| Componentes compartidos landing/app | Fuera de `(app)/` en `app/_components/` |
| Popovers | Siempre `createPortal` z-9999 si hay riesgo de clipping |
| Auth | `@supabase/ssr` SSR-safe |
| IA | OpenAI gpt-4o-mini vía AIProvider interface desacoplada |
| Forgot password link | Aparece solo tras el primer intento fallido de login |
| Template selection | localStorage key `lastTemplateId` — única fuente de verdad entre páginas |
| Auto-template | templateId `'auto'` → app-api llama gpt-4o-mini para elegir; actualiza DB con el ID resuelto |
| Template button toggle | null = Auto (IA elige); click sobre activo = deselecciona sin abrir dropdown |

---

*Última actualización: 2026-03-25 — F2-M7 completado (pendiente lecture_notes.pdf + merge). Features añadidas: thumbnails PNG, sample PDFs con UI, selección visual con borde accent, modo Auto con IA eligiendo plantilla. Próximo: merge F2-M7 → main, luego F3 Visor Interactivo.*
