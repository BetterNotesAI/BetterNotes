# BetterNotes — Flujo de trabajo con Claude

Esta guía explica cómo trabajar con Claude Code de forma efectiva en este proyecto:
cómo arrancar una sesión, cómo cerrarla, y qué ocurre realmente por dentro.

---

## Cómo funciona el equipo

El proyecto está organizado como un equipo de especialistas, pero todos son Claude.

Cuando le hablas a Claude y mencionas `@director`, Claude lanza un subproceso de sí
mismo con el rol y las instrucciones del Director. Ese subproceso lee el estado del
proyecto, decide qué hay que hacer y devuelve un plan. Luego es el Claude principal
quien recibe ese plan y lo ejecuta — escribe el código, edita los archivos, llama a
las herramientas.

En la práctica funciona así:

```
Tú → Claude (principal)
          │
          ├─ lanza subproceso @director  → lee STATUS/TASKS, devuelve plan
          ├─ lanza subproceso @planner   → actualiza TASKS.md
          ├─ lanza subproceso @researcher → investiga librerías o competidores
          └─ Claude principal ejecuta el trabajo: escribe código, edita archivos
```

No hay múltiples entidades independientes trabajando en paralelo de forma autónoma.
Es Claude coordinándose consigo mismo mediante subprocesos aislados, cada uno con
su contexto y rol. La metáfora del equipo sirve para mantener esos contextos limpios
y especializados, y para que tú puedas dirigirte a un rol concreto cuando lo necesites.

### Los roles disponibles

| Rol | Responsabilidad |
|-----|-----------------|
| **Director** | Lee el estado, decide qué hacer, coordina el orden de trabajo |
| **Planner** | Mantiene TASKS.md, descompone milestones en tareas atómicas |
| **Frontend** | Next.js, React, Tailwind, UI, componentes |
| **Backend** | Express, Railway, endpoints, lógica de negocio |
| **DB** | Supabase, PostgreSQL, migraciones, RLS, queries |
| **Researcher** | Investiga librerías, competidores, documentación externa |
| **Reviewer** | Code review y seguridad antes de cerrar cada feature |
| **Reporter** | Genera informes visuales al cerrar milestones |

### El estado del proyecto

Todo el contexto que Claude necesita para continuar entre sesiones vive en `.claude/status/`:

| Archivo | Contenido |
|---------|-----------|
| `STATUS.md` | Estado actual en una lectura rápida — milestone activo, bloqueantes |
| `TASKS.md` | Plan completo con fases, milestones y tareas atómicas |
| `PROGRESS.md` | Historial de sesiones — qué se hizo y cuándo |
| `LESSONS.md` | Lecciones aprendidas: errores encontrados y cómo se resolvieron |
| `PROJECT.md` | Descripción general, stack, arquitectura, decisiones técnicas |

Claude no tiene memoria entre sesiones por sí solo. Estos archivos son su memoria.
Por eso es importante abrir y cerrar cada sesión con los prompts correctos.

---

## Inicio de sesión

Usa este prompt al abrir Claude Code:

```
@director Inicia sesión. Lee los documentos de estado en .claude/status/ y dime cuál es la siguiente tarea según TASKS.md. Espera mi confirmación antes de proponer el plan detallado.
```

Lo que ocurre por dentro:
1. Claude lanza un subproceso con el rol de Director
2. El Director lee `STATUS.md`, `TASKS.md` y `PROGRESS.md`
3. Identifica el milestone activo y la siguiente tarea pendiente
4. Devuelve un resumen al Claude principal
5. Claude te lo presenta y espera tu confirmación

Tú decides si seguir con la tarea propuesta o ajustar el rumbo antes de empezar.

---

## Durante la sesión

Trabaja de forma natural. Algunos prompts útiles:

**Para empezar una tarea concreta:**
```
Empecemos con F2-M5. Propón el plan detallado.
```

**Para cambiar de rumbo en mitad de una sesión:**
```
Para. Antes de continuar quiero [ajuste]. Luego seguimos.
```

**Si algo no funciona como esperas:**
```
Esto no está bien. [Describe el problema]. Corrígelo.
```

**Para preguntar sin que toque código:**
```
Sin tocar nada todavía, explícame cómo funciona [X].
```

**Para pedir investigación antes de implementar:**
```
Antes de escribir código, investiga cómo [X] y propón el enfoque.
```

---

## Cierre de sesión

Usa este prompt cuando termines:

```
Cerramos sesión. Actualiza el estado del proyecto, marca las tareas completadas y haz commit del estado.
```

Lo que ocurre por dentro:
1. Claude lanza el subproceso de Director/Planner
2. Marca las tareas completadas en `TASKS.md`
3. Añade una entrada en `PROGRESS.md` con lo que se hizo
4. Actualiza `STATUS.md` con el siguiente milestone y bloqueantes
5. Hace commit y push de los archivos de `.claude/status/` a GitHub

Así la próxima sesión arranca con el contexto exacto de dónde quedaste,
aunque haya pasado días o semanas.

---

## Flujo completo de una sesión tipo

```
1. Abrir Claude Code en el proyecto
2. Prompt de inicio → Claude (vía Director) presenta el estado
3. Tú confirmas la tarea → Claude empieza a trabajar
4. Iterar: código → pruebas locales → correcciones
5. Confirmar que todo funciona
6. Prompt de cierre → Claude actualiza estado y hace commit
```

---

## Referencia rápida de prompts

| Momento | Prompt |
|---------|--------|
| **Inicio de sesión** | `@director Inicia sesión. Lee los documentos de estado en .claude/status/ y dime cuál es la siguiente tarea según TASKS.md. Espera mi confirmación.` |
| **Cierre de sesión** | `Cerramos sesión. Actualiza el estado del proyecto, marca las tareas completadas y haz commit del estado.` |
| **Empezar tarea** | `Empecemos con [F2-M5]. Propón el plan detallado.` |
| **Consulta sin código** | `Sin tocar nada, explícame cómo funciona [X].` |
| **Corrección** | `Esto no está bien: [descripción]. Corrígelo.` |
| **Pausa** | `Para. [Ajuste]. Luego seguimos.` |
| **Investigar antes de implementar** | `Antes de escribir código, investiga [X] y propón el enfoque.` |
