# STATUS — BetterNotes v2

> Estado actual del proyecto en una lectura rápida.
> Actualizado por el director al inicio y cierre de cada sesión.

---

## Estado actual

**Fase:** 2 — Rediseño y mejoras
**Milestone activo:** — (pendiente revisión del plan de producto)
**Último milestone completado:** F2-M2b — Navegación, UX y flujo del producto
**Bloqueantes:** 🔴 Google OAuth pendiente de configurar en Supabase Dashboard

## Próxima acción — PRIORITARIA

🔴 **Revisar nuevo plan de producto** antes de continuar con F2-M5 o F2-M6.
Comparar con TASKS.md actual y reestructurar milestones si es necesario.

## Próximas tareas planificadas (F2-M5, sujetas a revisión del plan)

1. Mobile responsive funcional en teléfono 🔴
2. Landing page mejorada con ejemplo real de PDF
3. Onboarding interactivo para nuevos usuarios

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

*Última actualización: 2026-03-22 (sincronizado con TASKS.md)*
