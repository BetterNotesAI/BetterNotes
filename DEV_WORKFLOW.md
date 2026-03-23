# BetterNotes — Flujo de trabajo con Claude

Esta guía explica cómo trabajar con Claude Code de forma efectiva en este proyecto:
cómo arrancar una sesión, cómo cerrarla, y qué ocurre realmente por dentro.

---

## Cómo funciona el equipo

El proyecto está organizado como un equipo de especialistas.

Cuando le hablas a Claude y mencionas `@director`, Claude lanza un subproceso de sí
mismo con el rol y las instrucciones del Director. Ese subproceso lee el estado del
proyecto, decide qué hay que hacer y devuelve un plan. Luego es el Claude principal
quien recibe ese plan y lo ejecuta — escribe el código, edita los archivos, llama a
las herramientas.

En la práctica funciona así:

```
Tú → Claude → @director → lee STATUS/TASKS, coordina al equipo
                │
                ├─ lanza subproceso @planner   → actualiza TASKS.md
                ├─ lanza subproceso @researcher → investiga librerías o competidores
                └─ ...
```

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
Inicia sesión, ejecuta el protocolo sesion-start
```

Lo que ocurre por dentro:
1. Claude lanza al Director
2. El Director lee `STATUS.md`, `TASKS.md` y `PROGRESS.md`
3. Identifica el milestone activo y la siguiente tarea pendiente
4. Presenta un resumen y espera tu confirmación
5. Coordina al equipo

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
Cerramos sesión.
```
