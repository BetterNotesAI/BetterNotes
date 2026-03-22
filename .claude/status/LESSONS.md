# LESSONS — BetterNotes v2

> Lecciones aprendidas durante el proyecto. Cualquier agente puede añadir entradas.
> Consultar antes de empezar cualquier tarea relacionada con el tema.

---

## Cómo consultar

```bash
grep -i "supabase\|RLS\|auth" .claude/status/LESSONS.md
grep -i "next\|router\|componente" .claude/status/LESSONS.md
grep -i "stripe\|pago" .claude/status/LESSONS.md
```

---

## 2026-03-18 — db — FK circular requiere DEFERRABLE en Supabase

**Descubierto por:** db
**Contexto:** Diseño del esquema documents ↔ document_versions (Fase 1)

**Lección:**
La relación circular entre `documents` (tiene `current_version_id`) y `document_versions`
(tiene `document_id`) no puede resolverse con FK normales en PostgreSQL — viola la restricción
al insertar. Supabase PostgreSQL lo acepta con `DEFERRABLE INITIALLY DEFERRED`.

**Acción a tomar:**
Al diseñar esquemas con referencias circulares, declarar la FK problemática como
`DEFERRABLE INITIALLY DEFERRED`. Wrappear los inserts relacionados en una transacción.

**Referencia:** `supabase/migrations/` — migración inicial del esquema

---

## 2026-03-18 — db — RLS con JOIN en tabla relacionada causa recursión

**Descubierto por:** db
**Contexto:** RLS policies en document_versions (Fase 1)

**Lección:**
Una RLS policy en `document_versions` que hace JOIN con `documents` para verificar
ownership entra en recursión infinita si `documents` también tiene RLS activo con
una policy que accede a `document_versions`.

**Acción a tomar:**
Romper la recursión con una función `SECURITY DEFINER` que bypasea RLS internamente.
Ejemplo: `owns_document(doc_id uuid)` verifica ownership sin trigger RLS.
Nunca escribir RLS policies con JOINs circulares sin esta protección.

**Referencia:** `supabase/migrations/` — función `owns_document()`

---

## 2026-03-18 — ia — structureTemplate vacío evita que la IA copie ejemplos

**Descubierto por:** backend
**Contexto:** Bug detectado en v1, corregido en v2 desde el inicio

**Lección:**
Si el template LaTeX incluye contenido de ejemplo real (fórmulas, texto), la IA
tiende a copiarlo literalmente en lugar de generarlo desde el prompt del usuario.
El resultado es un documento que parece del template, no del usuario.

**Acción a tomar:**
Los templates deben usar `% FILL: descripción` como placeholders, sin contenido
de ejemplo real. La IA rellena los placeholders guiándose por el prompt.

**Referencia:** `app-api/src/templates/` — todos los templates usan este patrón

---

## 2026-03-18 — pagos — Race condition en creación de Stripe customer

**Descubierto por:** backend
**Contexto:** Implementación de Stripe (F1-M5)

**Lección:**
Si el usuario hace dos clicks rápidos en "Upgrade", pueden lanzarse dos requests
simultáneas que ambas detectan "no tiene customer_id" y ambas crean un customer
en Stripe, generando duplicados.

**Acción a tomar:**
Usar la RPC atómica `check_and_increment_usage()` para operaciones críticas.
Para creación de customer: añadir un lock optimista o verificar + crear en una
sola transacción DB. Mitigación actual es parcial.

---

## 2026-03-21 — frontend — Popovers dentro de contenedores overflow:hidden se clipean

**Descubierto por:** frontend
**Contexto:** DocumentCreationBar specs popovers (F2-M2b B4)

**Lección:**
Los popovers de selección de specs se clipaban porque el contenedor padre tenía
`overflow: hidden` implícito o un `transform` CSS. No es obvio hasta que se ve en pantalla.

**Acción a tomar:**
Cualquier popover, dropdown o tooltip que pueda estar dentro de un contenedor con
`overflow: hidden` o `transform` debe renderizarse con `createPortal` al body,
con `z-index: 9999`. Sin excepción.

**Referencia:** `app-web/app/_components/DocumentCreationBar` — implementación con portal

---

## 2026-03-21 — arquitectura — Componentes compartidos landing/app deben vivir fuera de (app)/

**Descubierto por:** architect
**Contexto:** DocumentCreationBar necesaria en landing y en app (F2-M2b B4)

**Lección:**
Next.js App Router aplica reglas de Server/Client Components por carpeta.
Componentes dentro de `(app)/` no son importables directamente desde la landing
(`page.tsx` en raíz de `app/`), genera errores de hidratación o de importación.

**Acción a tomar:**
Componentes que necesiten usarse tanto en landing como en app: colocarlos en
`app/_components/` (guión bajo = fuera del routing de App Router).
Componentes exclusivos de la app autenticada: `app/(app)/_components/`.

---

## 2026-03-21 — arquitectura — Prompt al workspace vía URL param, no localStorage

**Descubierto por:** architect
**Contexto:** Flujo landing → workspace con prompt inicial (F2-M2b B4)

**Lección:**
Pasar el prompt inicial al workspace vía localStorage causa problemas de
sincronización entre tabs y persistencia no deseada si el usuario navega
hacia atrás. Además es difícil de debuggear.

**Acción a tomar:**
Usar `?prompt=` como URL param al navegar al workspace. El componente
`InitialPromptSender` (dentro de Suspense) lo lee y auto-envía el primer mensaje.
El param desaparece de la URL tras el envío. Limpio y predecible.

**Referencia:** `app-web/app/(app)/workspace/[id]/` — InitialPromptSender

---

## 2026-03-22 — frontend — app-api en Railway no se autodespliega con git push

**Descubierto por:** devops (pendiente de resolver)
**Contexto:** Cambios en B5 que requerían redeploy manual

**Lección:**
Railway tiene configurado el autodeploy solo para ciertos paths o ramas.
Cambios en `app-api/` no triggerean redeploy automático en la configuración actual.

**Acción a tomar:**
Verificar y corregir la configuración de watch paths en Railway para `app-api/`.
Mientras tanto: redeploy manual desde el dashboard de Railway tras cada cambio en app-api.
Tarea pendiente en deuda técnica 🟡.
