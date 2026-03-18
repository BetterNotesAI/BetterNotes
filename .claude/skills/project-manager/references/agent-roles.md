# Roles de Agentes — dev-team

> Referencia para cuando la skill dev-team esté disponible.
> El Project Manager (Director General) coordina y delega a estos roles.

---

## 🎯 Director General (Project Manager)
**Responsabilidad:** Contexto, coordinación y registro de progreso.  
**Activa en:** Inicio y cierre de cada sesión. Coordina al resto.  
**Artefactos:** `.claude/PROJECT.md`, `.claude/TASKS.md`, `.claude/PROGRESS.md`

---

## 🏗️ Arquitecto
**Responsabilidad:** Diseño de sistemas, patrones, estructura antes de codificar.  
**Activa en:** Nuevas features, refactors importantes, decisiones de stack.  
**Output:** Diagramas, ADRs (Architecture Decision Records), estructura de carpetas propuesta.

---

## 💻 Especialista Técnico
**Subtipos:**
- **Frontend** — UI, componentes, UX, accesibilidad, rendimiento cliente
- **Backend** — APIs, lógica de negocio, autenticación, rendimiento servidor
- **DB/Data** — Esquemas, queries, migraciones, optimización

**Activa en:** Implementación de tareas técnicas específicas.

---

## 🔍 Revisor
**Responsabilidad:** Bugs, seguridad, code review, testing.  
**Activa en:** Antes de mergear, tras implementar features, cuando algo falla.  
**Output:** Lista de issues con severidad, sugerencias de fix.

---

## 🔬 Investigador
**Responsabilidad:** Búsqueda de documentación, análisis de librerías, benchmarks, análisis de mercado.  
**Activa en:** Cuando se necesita evaluar una tecnología, resolver un problema desconocido, o investigar competidores.  
**Output:** Resumen de hallazgos con recomendación.

---

## 🎨 Marketer / Designer
**Responsabilidad:** Identidad de marca, copywriting, landing pages, assets visuales.  
**Activa en:** Lanzamiento de producto, necesidad de materiales de marketing.  
**Output:** Copy, estructura de landing page, brief de diseño.

---

## 📊 Reporter
**Responsabilidad:** Presentaciones, documentación de avance, explicar al usuario qué se hizo y cómo.  
**Activa en:** Fin de sprint, demos, cuando el usuario quiere entender el trabajo realizado.  
**Output:** Resumen ejecutivo, presentación, changelog legible.

---

## Protocolo de delegación (Director General)

```
1. Leer contexto del proyecto (.claude/)
2. Entender la tarea solicitada
3. Decidir qué rol(es) son necesarios
4. Briefing al agente: contexto relevante + tarea específica + output esperado
5. Revisar output del agente
6. Integrar resultado y actualizar .claude/PROGRESS.md
```
