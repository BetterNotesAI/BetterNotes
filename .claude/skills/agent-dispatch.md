# Skill: agent-dispatch
**Cuándo usar:** El director la consulta al planificar cualquier tarea para decidir
qué agentes invocar y en qué orden.

---

## Tabla de despacho por tipo de tarea

| Tipo de tarea | Agentes | Orden | Paralelo |
|---------------|---------|-------|----------|
| Nueva feature completa | architect → frontend + backend → reviewer → reporter | architect primero | frontend + backend ✅ |
| Bug en producción | reviewer → frontend o backend → reviewer (verificación) | secuencial | ❌ |
| Nuevo módulo o página | architect → frontend → reviewer | secuencial | ❌ |
| Cambio de esquema DB | db → backend (si afecta API) → reviewer | secuencial | ❌ |
| Integración externa (Stripe, OpenAI...) | researcher → backend → reviewer | secuencial | ❌ |
| Refactor | architect → especialista → reviewer | secuencial | ❌ |
| Decisión de tecnología | researcher → architect | secuencial | ❌ |
| Landing / copy / onboarding | marketer → frontend → reviewer | secuencial | ❌ |
| Optimización de BD o RLS | db → reviewer | secuencial | ❌ |
| Code review puntual | reviewer | — | — |
| Cualquier tarea completada | reviewer | siempre al final | ❌ |
| Cierre de milestone | reporter + github-sync | después del reviewer | — |

## Reglas de despacho

### Siempre antes de codificar
El **architect** diseña antes de que frontend o backend escriban código para
cualquier módulo nuevo o cambio estructural significativo.
Excepción: fixes menores, cambios de copy, ajustes de estilo puntuales.

### Siempre al final
El **reviewer** revisa antes de marcar cualquier tarea como completada.
Sin excepción. Puede ir después de cada agente si la tarea es larga.

### En paralelo
- frontend + backend pueden ir en paralelo si el contrato de API está definido
- researcher + architect pueden analizar en paralelo si son temas independientes
- Nunca en paralelo: architect (su output es input de otros), reviewer, reporter

## Briefing mínimo por agente

El director debe incluir en cada Task:
1. **Contexto**: fase activa, milestone, stack relevante (Next.js 14, Supabase, Railway...)
2. **Tarea específica**: qué hacer exactamente, qué no tocar
3. **Output esperado**: formato y entregable concreto
4. **Restricciones**: decisiones previas en PROJECT.md o LESSONS.md que respetar
5. **Skills relevantes**: si aplica

## Cuándo escalar al director (desde cualquier agente)
- La tarea es más grande de lo esperado
- Se descubre algo que invalida una decisión previa
- Hay conflicto entre lo pedido y lo que está en PROJECT.md o LESSONS.md
- Se necesita acceso a credenciales o configuración de producción