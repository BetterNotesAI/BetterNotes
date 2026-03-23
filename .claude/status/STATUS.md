# STATUS — BetterNotes v2

> Estado actual del proyecto en una lectura rápida.
> Actualizado por el director al inicio y cierre de cada sesión.

---

## Estado actual

**Fase:** 2 — Cierre y refinamiento
**Milestone activo:** F2-M5 — Auth refinements + Google OAuth + deuda técnica
**Último milestone completado:** F2-M2b — Navegación, UX y flujo del producto
**Bloqueantes:** 🔴 Google OAuth pendiente de configurar en Supabase Dashboard

## Plan reestructurado — 2026-03-22

Plan de producto revisado completamente. Nuevas fases y milestones en TASKS.md.
Feature estratégica central: **Visor Interactivo (Fase 3)** — patrón Typora sobre LaTeX,
workspace `/workspace/[id]` se convierte en el visor, modos de vista actuales ocultos.

## Completado en F2-M5

- [x] F2-M5.2 — "Sign in" → "Log in" rename (sesión anterior)
- [x] F2-M5.3 — Forgot Password + Reset Password flow
- [x] F2-M5.3 bugfix — useSearchParams() envuelto en Suspense en forgot-password/page.tsx (fix Vercel build error)
- [x] F2-M5.4 — Logo BetterNotes reposicionado en header externo en las 4 páginas de auth (login, signup, forgot-password, reset-password)

## Próximas tareas

**F2-M5** (pendientes):
1. 🔴 Google OAuth — requiere acceso a Supabase Dashboard + Google Cloud Console
2. F2-M5.5 — Fix race condition Stripe customer
3. F2-M5.6 — Autodeploy app-api en Railway

**Después:** F2-M6 (sidebar nueva + All Documents), F2-M7 (templates revamp)

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

---

*Última actualización: 2026-03-23 — Sesión cerrada. F2-M5.4 completado: logo BetterNotes reposicionado en header externo en las 4 páginas de auth. Merge en main, pendiente push a origin. Próxima sesión: F2-M5.5 (race condition Stripe) o F2-M5.1 (Google OAuth si hay acceso a paneles).*
