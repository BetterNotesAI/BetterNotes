# Skill: session-end
**Cuándo usar:** Cuando el usuario indica que termina la sesión ("lo dejamos por hoy", "hasta mañana", "cerramos", etc.). Ejecutar SIEMPRE antes de despedirse.

---

## Protocolo de cierre de sesión

### Paso 1 — Leer el estado actual de todos los archivos de status
```bash
cat .claude/status/STATUS.md
echo "---"
cat .claude/status/TASKS.md
echo "---"
tail -60 .claude/status/PROGRESS.md 2>/dev/null || echo "(PROGRESS vacío)"
echo "---"
cat .claude/status/PROJECT.md
```

### Paso 2 — Revisar qué se hizo en la sesión
A partir del contexto de la conversación actual, identificar:
- Milestones completados en esta sesión
- Tareas completadas en esta sesión (para marcarlas `[x]` en TASKS.md)
- Decisiones nuevas tomadas por el usuario
- Cambios en el plan o en el scope
- Problemas encontrados o pendientes

### Paso 3 — Actualizar TASKS.md si hay tareas completadas
Para cada tarea completada en la sesión:
```markdown
- [x] Tarea X.Y.Z — descripción · Completada: YYYY-MM-DD
```
Para el milestone actual, si está completo:
```markdown
### ~~Milestone X.X: Nombre~~ ✅ COMPLETADO YYYY-MM-DD
```

### Paso 4 — Actualizar PROGRESS.md si se avanzó en algo significativo
Añadir entrada solo si hubo progreso real (no si la sesión fue solo de revisión):
```markdown
---
## Sesión YYYY-MM-DD — [resumen en 1 línea]

**Completado:** [lista de milestones/tareas cerradas]
**Decisiones tomadas:** [lista o "ninguna"]
**Pendiente para próxima sesión:** [primera tarea según TASKS.md]
**Bloqueantes:** [ninguno / descripción]
```

### Paso 5 — Actualizar STATUS.md
Actualizar los campos:
- `Tarea en curso` → primera tarea pendiente del siguiente milestone
- `Último milestone completado` → si aplica
- `Bloqueantes` → actualizar si hay nuevos o se resolvieron
- `Última actualización` → fecha y hora actual con nota de sesión cerrada

Formato de última línea:
```
*Ultima actualizacion: YYYY-MM-DD HH:MM — Sesion cerrada. Proxima sesion: [nombre de la tarea pendiente].*
```

### Paso 6 — Actualizar PROJECT.md si hubo decisiones nuevas
Si el usuario confirmó nuevas decisiones durante la sesión que no estén ya en PROJECT.md, añadirlas a la tabla de decisiones confirmadas.

### Paso 7 — Commit y push de los cambios de status
Solo commitear archivos de `.claude/status/` que hayan cambiado:
```bash
git diff --name-only .claude/status/
```
Si hay cambios:
```bash
git add .claude/status/STATUS.md .claude/status/TASKS.md .claude/status/PROGRESS.md .claude/status/PROJECT.md
git commit -m "chore: actualizar estado al cierre de sesión YYYY-MM-DD"
git push origin main
```

### Paso 8 — Confirmar al usuario
Mensaje de cierre:
```
Estado del proyecto actualizado y sincronizado.

📍 Quedamos en: [nombre del siguiente milestone/tarea]
🔒 Archivos actualizados: [lista de los que cambiaron]

¡Hasta la próxima!
```

---

## Reglas
- Si no hubo progreso en la sesión (solo consultas), solo actualizar la línea de `Ultima actualizacion` en STATUS.md
- No crear entradas vacías en PROGRESS.md
- Si hay tareas a medias (started pero no completadas), dejarlas como `[ ]` con una nota en STATUS.md
- Siempre hacer push para que el estado quede respaldado en GitHub
