# Skill: phase-complete
**Cuándo usar:** Cuando todos los milestones de una fase están completos.
Se ejecuta después del último milestone-complete de la fase. Cuando se completa una fase.

---

## Protocolo de cierre de fase

### Paso 1 — Verificar que todos los milestones están cerrados
```bash
grep -A 100 "## Milestones Fase" .claude/status/TASKS.md | grep "⏳\|🔄"
```
Si hay milestones sin completar, escalar al director antes de continuar.

### Paso 2 — Reporter genera el HTML de fase
El director lanza al reporter con el contexto completo de la fase:
- Número y nombre de la fase
- Lista de milestones completados con fechas
- Decisiones estratégicas más importantes de la fase
- Problemas relevantes y cómo se resolvieron
- Qué cambió respecto al plan original
- Estado del producto al cerrar la fase

El reporter genera:
- Briefing de texto extendido para el usuario
- HTML en `.claude/reports/FX_nombre.html`
  El HTML incluye: línea de tiempo visual, cards por milestone con
  enlace a sus reportes individuales, lecciones de LESSONS.md, y
  vista global del proyecto.

### Paso 3 — Actualizar documentos de estado

**TASKS.md** — marcar la fase como completada:
```markdown
## Milestones Fase X — COMPLETADOS ✅
```

**PROGRESS.md** — entrada de cierre de fase:
```markdown
---
## FASE [X] completada — [fecha]
Duración: [X sesiones / fechas]
Milestones: [lista]
Decisión más importante: [una línea]
Mayor aprendizaje: [una línea]
```

**STATUS.md** — actualizar con nueva fase activa.

### Paso 4 — Commit de cierre de fase
Ejecutar skill `github-sync` con tipo `fase` y título descriptivo:
```
feat(Fase-X): complete phase X — [nombre de la fase]
```

### Paso 5 — Presentar al usuario
```
[📊 REPORTER] Fase X completada.

[briefing extendido]

[🎯 DIRECTOR] La siguiente fase es: Fase X+1 — [nombre]
[Descripción de lo que viene]

¿Arrancamos?
```
