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

**Rama:** session/YYYY-MM-DD-descripcion
**Completado:** [lista de milestones/tareas cerradas]
**Decisiones tomadas:** [lista o "ninguna"]
**Pendiente para próxima sesión:** [primera tarea según TASKS.md]
**Bloqueantes:** [ninguno / descripción]
```

### Paso 5 — Actualizar STATUS.md
Actualizar los campos:
- `Milestone activo` → primera tarea pendiente del siguiente milestone
- `Último milestone completado` → si aplica
- `Bloqueantes` → actualizar si hay nuevos o se resolvieron
- Eliminar la línea `Rama de sesión activa` (se añadirá en la próxima sesión)

Formato de última línea:
```
*Ultima actualizacion: YYYY-MM-DD HH:MM — Sesion cerrada. Proxima sesion: [nombre de la tarea pendiente].*
```

### Paso 6 — Actualizar PROJECT.md si hubo decisiones nuevas
Si el usuario confirmó nuevas decisiones durante la sesión que no estén ya en PROJECT.md, añadirlas a la tabla de decisiones confirmadas.

### Paso 7 — Commit de todos los cambios en la rama de sesión
Obtener el nombre de la rama actual:
```bash
git branch --show-current
```

Commitear todo el trabajo de la sesión:
```bash
git add -A
git status
git commit -m "feat: [descripción de lo trabajado en la sesión] — sesión YYYY-MM-DD"
git push origin session/YYYY-MM-DD-descripcion
```

### Paso 8 — Pedir confirmación al usuario antes del merge
Presentar al usuario un resumen de lo que se va a mergear:

```
✅ Trabajo de la sesión commiteado en: session/YYYY-MM-DD-descripcion

Cambios listos para mergear a main:
- [lista resumida de archivos o features modificados]

¿Confirmas el merge a main?
```

**Esperar respuesta del usuario. No hacer el merge sin confirmación explícita.**

### Paso 9 — Merge a main (solo si el usuario confirma)
```bash
git checkout main
git merge session/YYYY-MM-DD-descripcion --no-ff -m "merge: session/YYYY-MM-DD-descripcion"
git push origin main
```

El flag `--no-ff` preserva la rama de sesión como un merge commit visible en el historial.

### Paso 10 — Confirmar al usuario
Mensaje de cierre:
```
Estado del proyecto actualizado y sincronizado.

📍 Quedamos en: [nombre del siguiente milestone/tarea]
🌿 Mergeado: session/YYYY-MM-DD-descripcion → main
🔒 Archivos actualizados: [lista de los que cambiaron]

¡Hasta la próxima!
```

---

## Reglas
- **Nunca hacer el merge sin confirmación explícita del usuario**
- Si no hubo progreso en la sesión (solo consultas), solo actualizar STATUS.md y no crear merge commit
- No crear entradas vacías en PROGRESS.md
- Si hay tareas a medias (started pero no completadas), dejarlas como `[ ]` con una nota en STATUS.md
- Siempre hacer push de la rama de sesión antes de proponer el merge
- Si el usuario rechaza el merge, dejar la rama de sesión en remote para la próxima sesión
