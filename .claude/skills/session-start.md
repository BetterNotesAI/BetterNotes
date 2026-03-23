# Skill: session-start
**Cuándo usar:** Al inicio de cada sesión. El director la ejecuta en respuesta a cualquier mensaje de arranque del usuario (generalmente con el primer mensaje del usuario basta).

---

## Protocolo de inicio de sesión

### Paso 1 — Leer el estado del proyecto
```bash
cat .claude/status/STATUS.md
echo "---"
cat .claude/status/PROJECT.md
echo "---"
cat .claude/status/TASKS.md
echo "---"
head -60 .claude/status/PROGRESS.md 2>/dev/null || echo "(PROGRESS vacío)"
echo "---"
tail -20 .claude/status/LESSONS.md 2>/dev/null
```

### Paso 2 — Identificar la siguiente tarea
Del TASKS.md y STATUS.md, extraer:
- Fase actual del proyecto
- Milestone activo y su estado
- Primera tarea pendiente no bloqueada
- Bloqueantes activos si los hay

### Paso 3 — Presentarse al usuario

Formato del mensaje de bienvenida:
```
[🎯 DIRECTOR] El equipo está activo y listo.

📍 Estado: [una línea desde STATUS.md]
🔴 Bloqueantes: [si los hay, o "ninguno"]

📋 Siguiente tarea según el plan:
**[Nombre de la tarea]** — [Milestone al que pertenece]
[1-2 líneas de qué implica]

¿Confirmamos que seguimos con esta tarea, o quieres ajustar algo?
```

### Paso 4 — Crear rama de desarrollo para la sesión
Antes de presentarse al usuario, crear una rama de trabajo:
```bash
# Asegurarse de estar en main y al día
git checkout main
# Crear rama con fecha de sesión (añadir -2, -3 si ya existe)
git checkout -b session/YYYY-MM-DD
```
Nombre de la rama: `session/YYYY-MM-DD` (ejemplo: `session/2026-03-22`).
Si ya existe una rama con esa fecha, usar `session/YYYY-MM-DD-2`, etc.

Todo el trabajo de la sesión (código, status, commits intermedios) se hace en esta rama.

### Paso 5 — Esperar confirmación del usuario
No proponer el plan detallado hasta que el usuario confirme.
Una vez confirmado, ejecutar el protocolo de la skill `task-complete` o proceder
con la ejecución según corresponda.

---

## Actualizar STATUS.md al arrancar
Tras leer el estado, actualizar STATUS.md con la sesión activa:
```
Sesión activa desde: [fecha y hora]
Rama de sesión: session/YYYY-MM-DD
Tarea en curso: [nombre de la tarea]
```
