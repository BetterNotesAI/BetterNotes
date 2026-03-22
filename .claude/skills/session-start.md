# Skill: session-start
**Cuándo usar:** Al inicio de cada sesión. El director la ejecuta en respuesta a cualquier mensaje de arranque.

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
- Milestone activo y su estado
- Primera tarea pendiente no bloqueada
- Bloqueantes activos si los hay

### Paso 3 — Crear la rama de sesión desde main
```bash
git checkout main
git pull origin main
```

Determinar el nombre de la rama usando el formato:
`session/YYYY-MM-DD-[descripcion-corta-del-milestone]`

Ejemplos:
- `session/2026-03-22-f2m5-auth`
- `session/2026-03-22-f3m1-visor-poc`
- `session/2026-03-22-f2m6-sidebar`

La descripción debe ser el milestone o tarea principal que se va a trabajar en la sesión.

```bash
git checkout -b session/YYYY-MM-DD-descripcion
```

Guardar el nombre de la rama en STATUS.md para el cierre de sesión.

### Paso 4 — Presentarse al usuario

Formato del mensaje de bienvenida:
```
[🎯 DIRECTOR] El equipo está activo y listo.

📍 Estado: [una línea desde STATUS.md]
🌿 Rama de sesión: session/YYYY-MM-DD-descripcion
🔴 Bloqueantes: [si los hay, o "ninguno"]

📋 Siguiente tarea según el plan:
**[Nombre de la tarea]** — [Milestone al que pertenece]
[1-2 líneas de qué implica]

¿Confirmamos que seguimos con esta tarea, o quieres ajustar algo?
```

### Paso 5 — Esperar confirmación
No proponer el plan detallado hasta que el usuario confirme.

### Paso 6 — Actualizar STATUS.md
Añadir la rama de sesión activa:
```markdown
**Rama de sesión activa:** session/YYYY-MM-DD-descripcion
```

---

## Reglas
- Siempre crear la rama desde `main` actualizado (`git pull` antes del `checkout -b`)
- Nunca trabajar directamente en `main`
- Si ya existe una rama de sesión del mismo día (sesión interrumpida), preguntar al usuario si quiere retomarla o crear una nueva
