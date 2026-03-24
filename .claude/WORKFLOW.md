# Flujo de Trabajo del Equipo de Agentes

Este documento describe el sistema de agentes, skills y procedimientos operativos del proyecto BetterNotes.

---

## Arquitectura general

El sistema funciona como un equipo de especialistas coordinados por un **director**. Cada agente tiene un rol acotado y herramientas específicas. El director es el único punto de entrada: recibe las instrucciones del usuario, decide qué agentes invocar y en qué orden, y consolida los resultados.

```
Usuario
  │
  ▼
CLAUDE
  │
  ▼
DIRECTOR  ───────────────────────────────────────┐
  │                                              │
  ├─► PLANNER                                    │
  ├─► ARCHITECT                                  │
  ├─► RESEARCHER                                 │
  ├─► BACKEND                                    │
  ├─► DB                                         │
  ├─► FRONTEND                                   │
  ├─► REVIEWER         ◄──── siempre al final    │
  ├─► REPORTER                                   │
  └─► MARKETER                                   │
                                                 │
  Skills (procedimientos invocables) ───────────►┘
    session-start / session-end / task-complete / milestone-complete
    phase-complete / agent-dispatch / github-sync / lessons-capture
```

---

## El equipo de agentes

Cada agente vive en `.claude/agents/<nombre>.md` y define su rol, modelo LLM y herramientas permitidas.

### Reglas comunes a todos los agentes
- La primera línea de cualquier output es: `=== [EMOJI NOMBRE] ACTIVO — [tarea en 1 línea] ===`
- Al inicio de su tarea, leen `.claude/status/PROJECT.md` y `.claude/status/LESSONS.md`
- Solo tienen acceso a las herramientas que necesitan para su rol (principio de mínimo privilegio)

---

## Las skills

Las skills son procedimientos estándar del equipo, invocables explícitamente. Viven en `.claude/skills/<nombre>.md`.

### `session-start` — Inicio de sesión
Ejecutar al comienzo de cada sesión de trabajo.

### `session-end` — Cierre de sesión
Ejecutar cuando el usuario indica que termina la sesión.

### `task-complete` — Cierre de tarea
Ejecutar al completar cada tarea individual dentro de un milestone.

### `milestone-complete` — Cierre de milestone
Ejecutar cuando todas las tareas de un milestone están completadas y el reviewer aprobó.

### `phase-complete` — Cierre de fase
Ejecutar al completar todos los milestones de una fase entera.

### `agent-dispatch` — Tabla de despacho
Guía del director para decidir qué agentes invocar y en qué orden según el tipo de tarea.

### `github-sync` — Commit
Hacer commit del trabajo del milestone en la rama de sesión activa. Usa Conventional Commits. **No hace push** — el push lo realiza el usuario manualmente.

### `lessons-capture` — Captura de lecciones
Registrar en LESSONS.md cualquier descubrimiento importante para el equipo.

---

## Archivos de estado del proyecto

Todos en `.claude/status/`. Son la fuente de verdad del proyecto.

| Archivo | Propósito | Quién lo actualiza |
|---------|-----------|-------------------|
| `STATUS.md` | Estado actual en lectura rápida (tarea en curso, bloqueantes, decisiones) | `session-end`, `task-complete`, `milestone-complete` |
| `TASKS.md` | Plan de trabajo completo con todas las tareas `[ ]` / `[x]` | `planner`, `task-complete`, `session-end` |
| `PROGRESS.md` | Log cronológico de sesiones con lo que se hizo | `reporter`, `session-end` |
| `PROJECT.md` | Documento técnico permanente: decisiones de arquitectura, ADRs, stack | `session-end` (solo si hay nuevas decisiones confirmadas) |
| `LESSONS.md` | Lecciones aprendidas por el equipo durante el desarrollo | `lessons-capture` |

---

## Procedimiento de inicio de sesión

```
/session-start
```

**Pasos internos:**

1. Lee los archivos de estado:
   - `STATUS.md` — tarea en curso y bloqueantes
   - `PROJECT.md` — decisiones de arquitectura vigentes
   - `TASKS.md` — siguiente tarea pendiente `[ ]`
   - `PROGRESS.md` (últimas 80 líneas) — contexto de sesiones recientes
   - `LESSONS.md` (últimas 20 líneas) — lecciones relevantes

2. Crea una rama de desarrollo para la sesión:
   ```bash
   git checkout main
   git checkout -b session/YYYY-MM-DD
   ```
   Todo el trabajo de la sesión (código y commits intermedios) ocurre en esta rama.

3. Actualiza `STATUS.md` con la línea:
   ```
   Sesión activa desde: YYYY-MM-DD HH:MM
   Rama de sesión: session/YYYY-MM-DD
   ```

4. Se presenta al usuario con:
   - **Fase y milestone activo**
   - **Tarea propuesta para esta sesión**
   - **Bloqueantes conocidos** (si los hay)

5. **Espera confirmación explícita del usuario** antes de hacer cualquier cosa.

6. Tras confirmación: consulta `agent-dispatch` y anuncia cada delegación antes de invocarla.

**Ejemplo de presentación al inicio:**

```
=== [🎯 DIRECTOR] ACTIVO — inicio de sesión ===

Estado actual:
- Fase X — ...
- Milestone X.X — ...
- Siguiente tarea: ...

Propongo ...
¿Confirmamos?
```

---

## Procedimiento de cierre de sesión

Cuando el usuario dice "lo dejamos por hoy", "cerramos", "hasta mañana" o similar:

```
/session-end
```

**Pasos internos:**

1. **Leer** todos los archivos de status actuales.

2. **Identificar** qué se hizo en la sesión:
   - Milestones o tareas o fases completadas
   - Decisiones tomadas
   - Cambios en el código o la arquitectura

3. **Actualizar `TASKS.md`:**
   - Marcar tareas completadas con `[x]` + fecha
   - Marcar milestones como `~~Nombre~~ COMPLETADO`

4. **Actualizar `PROGRESS.md`** (solo si hubo progreso real, no si fue solo revisión):
   ```markdown
   ## Sesión YYYY-MM-DD
   **Duración:** ~Xh | **Agentes:** director, backend, reviewer
   **Logrado:** ...
   **Decisiones:** ...
   **Siguiente:** ...
   ```

5. **Actualizar `STATUS.md`:**
   - Tarea en curso (o `Ninguna — sesión cerrada`)
   - Último milestone completado
   - Bloqueantes
   - Fecha de última actualización
   - Marcar sesión como cerrada

6. **Actualizar `PROJECT.md`** solo si hubo nuevas decisiones de arquitectura confirmadas.

7. **Commit en la rama de sesión** (solo archivos de `.claude/status/`):
   ```
   chore: actualizar estado al cierre de sesión YYYY-MM-DD
   ```
   No se hace `git push` — el push lo realiza el usuario manualmente.

8. **Proponer merge a main:**
   ```
   ¿Hacemos merge de session/YYYY-MM-DD a main y eliminamos la rama?
   ```
   - Si el usuario confirma:
     ```bash
     git checkout main
     git merge session/YYYY-MM-DD --no-ff -m "chore: merge sesión YYYY-MM-DD → main"
     git branch -d session/YYYY-MM-DD
     ```
   - Si rechaza: dejar la rama sin tocar.

9. **Confirmar al usuario** con un resumen de lo que se persistió y el estado de la rama.

**Reglas especiales:**
- Si no hubo progreso real: solo actualizar la línea de fecha en `STATUS.md`, no crear entrada en `PROGRESS.md`
- Nunca hacer `git push` — es responsabilidad del usuario
- El commit nunca incluye código fuente fuera de lo trabajado en la sesión

---

## Flujo completo de una sesión típica

```
Inicio
  │
  ▼
/session-start
  ├─ Lee estado del proyecto
  ├─ Propone siguiente tarea
  └─ Espera confirmación del usuario
          │
          ▼ (usuario confirma)
  Director decide agentes (agent-dispatch)
          │
          ├─ [tarea]    → ...
          ├─ [tarea]    → ...
          ├─ [tarea]    → ...
          └─ [tarea]    → ... → REVIEWER (siempre)
                  │
                  ▼ (reviewer aprueba)
          /task-complete
            ├─ Actualiza TASKS.md
            ├─ Actualiza STATUS.md
            └─ Si hubo gotcha → /lessons-capture
                  │
                  ▼ (todas las tareas del milestone completas)
          /milestone-complete
            ├─ Reporter genera HTML en .claude/reports/
            ├─ Actualiza TASKS.md, PROGRESS.md, STATUS.md
            └─ /github-sync (con commit en rama session/YYYY-MM-DD)
                  │
                  ▼ (todas las milestones de la fase completas)
          /fase-complete
            ├─ Reporter genera HTML en .claude/reports/
            ├─ Actualiza TASKS.md, PROGRESS.md, STATUS.md
            └─ /github-sync (con commit en rama session/YYYY-MM-DD)
                  │
                  ▼ (usuario indica fin de sesión)
          /session-end
            ├─ Actualiza todos los archivos de status
            ├─ Commit en rama session/YYYY-MM-DD
            ├─ Propone merge → main + eliminar rama
            └─ Confirma al usuario (push queda para el usuario)
```

---

## Reportes de milestone

Al completar cada milestone, el `reporter` genera un archivo HTML en `.claude/reports/` con:
- Header visual del milestone
- Resumen de tareas completadas
- Decisiones tomadas
- Lecciones capturadas
- Estado global del proyecto

## Reportes de fase

Al completar cada fase, el `reporter` genera un archivo HTML en `.claude/reports/` con:
- Header visual de la fase
- Resumen de milestones completadas
- Decisiones tomadas
- Lecciones capturadas
- Estado global del proyecto
- Al completar una fase entera, el reporte es más extenso e incluye la línea de tiempo de todos los milestones de la fase.
