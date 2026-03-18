---
name: project-manager
description: >
  Sistema de gestión de contexto y progreso para proyectos de desarrollo. 
  SIEMPRE usa esta skill al inicio de cualquier sesión de programación, cuando el usuario 
  mencione trabajar en un proyecto, pida continuar donde lo dejaron, diga "vamos a trabajar 
  en X", abra un repositorio, o empiece una tarea técnica en un directorio. También actívala 
  cuando el usuario pida revisar el estado del proyecto, actualizar el progreso, crear 
  documentación, o planificar tareas y milestones. Si hay un directorio de proyecto involucrado 
  de cualquier forma, esta skill debe activarse.
---

# Project Manager Skill

Gestiona el contexto, tareas y progreso de proyectos de desarrollo para maximizar
la continuidad entre sesiones y mantener el foco en los objetivos.

## Filosofía

Cada sesión de trabajo debe empezar con contexto claro y terminar con el progreso
registrado. Los archivos `.claude/` son la memoria persistente del proyecto entre chats.

---

## RITUAL DE INICIO (ejecutar siempre al empezar una sesión)

### Paso 1 — Detectar directorio raíz

```bash
# Intentar detectar el root del proyecto
git rev-parse --show-toplevel 2>/dev/null || pwd
```

### Paso 2 — Leer documentación existente

Buscar el directorio `.claude/` en el root del proyecto:

```bash
ls -la .claude/ 2>/dev/null
```

**Si `.claude/` existe:** leer en este orden:
1. `.claude/PROJECT.md` → contexto general, objetivos, stack
2. `.claude/TASKS.md` → milestones, tareas activas, backlog
3. `.claude/PROGRESS.md` → últimas 30-50 líneas (sesiones recientes)

**Si NO existe:** proceder al Paso 3 y crear la estructura al final (ver sección CREACIÓN).

### Paso 3 — Explorar estructura del proyecto

```bash
# Estructura general (respetar .gitignore si existe)
find . -type f \
  -not -path '*/.git/*' \
  -not -path '*/node_modules/*' \
  -not -path '*/.next/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/.claude/*' \
  | sort | head -80
```

Para proyectos grandes, priorizar:
```bash
# Solo ver directorios de primer nivel + archivos clave
ls -la && find . -maxdepth 2 -type f -name "*.json" -o -name "*.toml" -o -name "*.yaml" \
  -not -path '*/node_modules/*' | head -20
```

### Paso 4 — Briefing al usuario

Tras la lectura, presentar un resumen conciso en este formato:

```
📁 PROYECTO: [nombre]
🎯 OBJETIVO: [1-2 líneas]
⚡ ESTADO: [En desarrollo / Alpha / Beta / etc.]

📌 MILESTONE ACTIVO: [nombre] ([X]% completado)
✅ ÚLTIMA SESIÓN: [qué se hizo]
🔄 PENDIENTE: [top 3 tareas]
⚠️  NOTAS: [bugs conocidos / cosas a revisar si las hay]

📂 STACK: [tecnologías principales detectadas]
```

Si no hay documentación previa, presentar solo el stack detectado y preguntar
por los objetivos antes de empezar.

---

## DURANTE LA SESIÓN — Qué capturar

Mientras trabajas, ir anotando mentalmente (para actualizar al final):

- **Decisiones técnicas** tomadas y por qué
- **Bugs o problemas** encontrados (resueltos o pendientes)
- **Mejoras identificadas** (technical debt, optimizaciones, refactors)
- **Cambios en la estructura** de archivos o arquitectura
- **Tareas completadas** y nuevas tareas que surjan
- **Dudas o cosas a revisar** en próximas sesiones

---

## RITUAL DE CIERRE (ejecutar al terminar o cuando se pida actualizar)

### Actualizar PROGRESS.md

Añadir una nueva entrada de sesión al principio del archivo:

```markdown
## Sesión [YYYY-MM-DD HH:MM]

### Completado
- [tarea 1]
- [tarea 2]

### Decisiones técnicas
- [decisión]: [razón]

### Problemas encontrados
- [bug/problema]: [estado: resuelto/pendiente]

### Mejoras identificadas (TODO)
- [ ] [mejora 1]
- [ ] [mejora 2]

### Próximos pasos
- [siguiente tarea prioritaria]
```

### Actualizar TASKS.md

- Marcar tareas completadas con `[x]`
- Añadir nuevas tareas detectadas
- Actualizar porcentaje de milestone si aplica
- Mover tareas entre secciones según estado

### Actualizar PROJECT.md (solo si hay cambios estructurales)

Actualizar stack, arquitectura o descripción si algo cambió significativamente.

---

## CREACIÓN — Cuando no existe `.claude/`

Si no hay documentación previa, crear la estructura **al final de la primera sesión**
(o antes si el usuario lo pide explícitamente):

```bash
mkdir -p .claude
```

Ver templates en `templates/` para el formato exacto de cada archivo.
Leer `templates/PROJECT.md`, `templates/TASKS.md` y `templates/PROGRESS.md`.

Rellenar con lo que se haya podido inferir del código existente + lo que el usuario
haya comentado. Preguntar solo lo que no se pueda inferir.

**Importante:** añadir `.claude/` al `.gitignore` si el usuario quiere mantenerlo
privado, o dejarlo en el repo si quiere compartir el contexto con el equipo.

---

## COMANDOS ÚTILES

```bash
# Ver estado git rápido
git log --oneline -10 2>/dev/null
git status 2>/dev/null

# Dependencias del proyecto
cat package.json 2>/dev/null | python3 -m json.tool | grep -A5 '"dependencies"'
cat requirements.txt 2>/dev/null | head -20
cat Cargo.toml 2>/dev/null | head -30
cat go.mod 2>/dev/null | head -20

# Últimos archivos modificados
git diff --name-only HEAD~5 HEAD 2>/dev/null || \
  find . -newer .git/index -type f -not -path '*/.git/*' 2>/dev/null | head -20
```

---

## INTEGRACIÓN CON dev-team SKILL

Cuando la skill `dev-team` esté disponible, el Project Manager actúa como
**Director General**: tras el ritual de inicio, decide qué agente especialista
activar según la tarea. Ver `references/agent-roles.md` para los roles disponibles.

---

## NOTAS DE COMPORTAMIENTO

- **No interrumpir el flujo:** el briefing debe ser conciso. Si el usuario ya
  sabe en qué está trabajando, no repetir lo obvio.
- **Actualizar progresivamente:** no esperar al final si se completa algo importante.
- **Priorizar la acción:** el objetivo es ayudar a trabajar, no generar burocracia.
  Si la documentación se vuelve un obstáculo, simplificarla.
- **Gitignore por defecto:** sugerir añadir `.claude/` a `.gitignore` en proyectos
  nuevos, a menos que el usuario prefiera compartirlo.
