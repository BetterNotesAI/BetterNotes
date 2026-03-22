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

## Próximas tareas

**F2-M5** (siguiente):
1. Google OAuth en Supabase + Google Cloud
2. "Log in" rename, Forgot Password, logo en auth
3. Fix Stripe race condition + autodeploy Railway

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

---

*Última actualización: 2026-03-22 — Sesión cerrada. Próxima sesión: F2-M5 — Auth refinements + Google OAuth.*
