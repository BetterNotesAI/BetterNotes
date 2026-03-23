# Skill: milestone-complete
**Cuándo usar:** Cuando todas las tareas de un milestone están completas y el reviewer ha dado el visto bueno. Cuando se completa un milestone.

---

## Protocolo de cierre de milestone

### Paso 1 — Verificación del reviewer
Antes de cerrar, confirmar que el reviewer ha aprobado el milestone.
Si no, lanzarlo con el contexto completo del milestone antes de continuar.

### Paso 2 — Reporter genera el HTML
El director lanza al reporter con:
- Nombre y número del milestone y la fase
- Lista de tareas completadas y sus outputs
- Decisiones tomadas durante el milestone
- Problemas encontrados y cómo se resolvieron
- Deuda técnica generada si aplica

El reporter genera:
- Briefing de texto para el usuario
- Archivo HTML en `.claude/reports/FX-MX-nombre.html`

### Paso 3 — Actualizar documentos de estado

**TASKS.md** — marcar milestone como completado:
```markdown
| F2-MX | Nombre | ✅ COMPLETADO | Descripción |
```

**PROGRESS.md** — añadir entrada al final:
```markdown
---
## Milestone [F2-MX] completado — [fecha]
Qué se logró: [resumen]
Decisiones clave: [lista]
Problemas: [lista o ninguno]
Deuda generada: [lista o ninguna]
```

**STATUS.md** — actualizar milestone activo y último completado.

### Paso 4 — Commit
Ejecutar skill `github-sync`:
- Tipo: `feat`
- Scope: nombre del milestone en kebab-case
- Ejemplo: `feat(f2-m2b): complete navigation UX and guest mode`

### Paso 5 — Presentar al usuario
```
[📊 REPORTER] Milestone FX-MX completado.
[briefing del reporter]

[🎯 DIRECTOR] Siguiente: Milestone F2-MX+1 — [nombre]
[descripción breve]
¿Continuamos?
```
