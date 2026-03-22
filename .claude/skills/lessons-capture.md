# Skill: lessons-capture
**Cuándo usar:** Cuando cualquier agente descubre algo que el equipo debería recordar:
un gotcha de Next.js App Router, un comportamiento inesperado de Supabase, una
decisión de arquitectura que resultó buena o mala, un bug difícil de diagnosticar.

---

## Cuándo capturar una lección

Capturar cuando se encuentra:
- Un bug que tardó en diagnosticarse
- Un comportamiento no documentado de Supabase, Railway, Vercel, Stripe u OpenAI
- Una limitación de Next.js App Router o del stack
- Una decisión de diseño que resultó ser buena o mala
- Un patrón que funciona bien para este proyecto
- Un coste oculto o restricción descubierta en la práctica

## Formato de entrada en LESSONS.md

```markdown
---
## [Fecha] — [Categoría] — [Título corto]

**Descubierto por:** [agente]
**Contexto:** [en qué tarea/milestone se encontró]

**Lección:**
[Qué pasó, por qué importa.]

**Acción a tomar:**
[Qué hacer cuando esto aparezca en el futuro. Concreto y accionable.]

**Referencia:**
[Archivo, línea de código, URL de docs, o "ninguna"]
```

## Categorías disponibles
- `frontend` — Next.js, React, Tailwind, componentes
- `backend` — Express, Railway, APIs, workers
- `db` — Supabase, PostgreSQL, RLS, migraciones
- `auth` — Supabase Auth, SSR, OAuth, sesiones
- `infra` — Vercel, Railway, despliegue, CI/CD
- `pagos` — Stripe, webhooks, checkout
- `ia` — OpenAI, prompts, comportamiento del modelo
- `diseño` — decisiones de arquitectura del código
- `proceso` — workflow del equipo

## Cómo recuperar lecciones relevantes

```bash
grep -i "supabase\|RLS\|auth" .claude/status/LESSONS.md
grep -i "next\|router\|app router\|componente" .claude/status/LESSONS.md
grep -i "stripe\|webhook\|pago" .claude/status/LESSONS.md
grep -i "railway\|vercel\|deploy" .claude/status/LESSONS.md
```
