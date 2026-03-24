# STATUS — BetterNotes v2

> Estado actual del proyecto en una lectura rápida.
> Actualizado por el director al inicio y cierre de cada sesión.

---

## Estado actual

**Fase:** 2 — Cierre y refinamiento
**Milestone activo:** F2-M6 — Nueva sidebar + All Documents revamp
**Último milestone completado:** F2-M5 (parcial — Google OAuth bloqueado, Railway bloqueado por trial)
**Bloqueantes:** 🔴 Google OAuth pendiente (Supabase + Google Cloud Console) | 🟡 Railway autodeploy bloqueado por crédito trial ($4.86)

## Plan reestructurado — 2026-03-22

Plan de producto revisado completamente. Nuevas fases y milestones en TASKS.md.
Feature estratégica central: **Visor Interactivo (Fase 3)** — patrón Typora sobre LaTeX,
workspace `/workspace/[id]` se convierte en el visor, modos de vista actuales ocultos.

## Completado en F2-M5

- [x] F2-M5.2 — "Sign in" → "Log in" rename (sesión anterior)
- [x] F2-M5.3 — Forgot Password + Reset Password flow
- [x] F2-M5.3 bugfix — useSearchParams() envuelto en Suspense en forgot-password/page.tsx (fix Vercel build error)
- [x] F2-M5.4 — Logo BetterNotes reposicionado en header externo en las 4 páginas de auth (login, signup, forgot-password, reset-password)
- [x] F2-M5.5 — Fix race condition Stripe customer con doble click (UNIQUE constraint + RPCs atómicas)
- [x] F2-M5.6 — railway.json creado en app-api/ + instrucciones Railway Dashboard documentadas

## Próximas tareas

**F2-M5** (pendientes):
1. 🔴 Google OAuth — requiere acceso a Supabase Dashboard + Google Cloud Console

**F2-M5.6 — ACCION MANUAL REQUERIDA:** Configurar en Railway Dashboard:
  - Settings > Source > Root Directory = `app-api`
  - Settings > Source > Watch Paths = `app-api/**`
  - Settings > Source > Branch = `main`
  - Verificar que autodeploy esta habilitado

**F2-M6** (en curso — rama `f2-m6-sidebar-all-documents`):
- [x] F2-M6.1 — Sidebar nueva estructura con separadores y badges Soon
- [x] F2-M6.2 — 5 páginas placeholder (/cheat-sheets, /problem-solver, /exams, /search, /my-studies)
- [x] F2-M6.3 — Carpeta Starred siempre visible arriba en All Documents
- [x] F2-M6.4 — Carpetas alfabéticamente arriba, ficheros sueltos abajo
- [x] F2-M6.5 — Menú 3-dots en ficheros: rename, star/unstar, mover a carpeta, eliminar con modal
- [x] F2-M6.6 — Menú 3-dots en carpetas: crear doc dentro, rename (modal), eliminar con modal
- [ ] F2-M6.7 — Vista carpeta con miniaturas + breadcrumb

**Después:** F2-M7 (templates revamp)

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

*Última actualización: 2026-03-24 — F2-M6.5 y F2-M6.6 completados. Menús 3-dots en ficheros (rename, star/unstar, mover a carpeta, eliminar con modal) y en secciones de carpeta (crear doc dentro, rename con modal, eliminar con modal). FolderSectionMenu usa createPortal para evitar clipping. API POST /api/documents acepta folder_id. Próximo: F2-M6.7 vista de carpeta.*
