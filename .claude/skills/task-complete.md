# Skill: task-complete
**Cuándo usar:** Cuando una tarea individual dentro de un milestone está terminada.

---

## Protocolo de cierre de tarea

### Paso 1 — Reviewer valida
Lanzar al reviewer con qué archivos se modificaron y qué debería hacer el código.

Si el reviewer da REQUIERE CAMBIOS:
- Relanzar al agente con los issues específicos
- Volver al paso 1

Si el reviewer da APROBADO o APROBADO CON MEJORAS:
- Continuar al paso 2
- Registrar issues amarillos/verdes en TASKS.md como deuda técnica

### Paso 2 — Reporter informa al usuario
```
[📊 REPORTER] Tarea completada: [nombre]

Qué se hizo: [1-3 puntos concretos]
Decisiones: [si las hay]
Pendiente de mejora: [issues amarillos del reviewer, si los hay]

Siguiente: [nombre de la siguiente tarea]
¿Continuamos?
```

### Paso 3 — Actualizar TASKS.md
Marcar la tarea como completada con fecha.

### Paso 4 — Actualizar STATUS.md
Actualizar tarea en curso con la siguiente tarea.

### Paso 5 — Capturar lecciones si aplica
Si durante la tarea se encontraron gotchas o soluciones no obvias,
ejecutar skill `lessons-capture` antes de cerrar.

---

## Cuándo pedir confirmación explícita al usuario
- La siguiente tarea implica un cambio significativo de dirección
- El reviewer encontró issues críticos que cambian el scope
- Han surgido dudas que requieren decisión del usuario
En el resto de casos dentro de un flujo ya aprobado, presentar el resumen
y proponer la siguiente tarea sin bloquear.
