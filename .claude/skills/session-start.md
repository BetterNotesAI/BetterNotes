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

### Paso 4 — Esperar confirmación
No proponer el plan detallado hasta que el usuario confirme.

### Paso 5 — Actualizar STATUS.md
```bash
# Actualizar línea "Tarea en curso" con la sesión activa
```
