# Pendientes Operacionales — BetterNotes (2026-04-01)

Estos pasos los debe ejecutar el usuario manualmente en los dashboards externos.
No requieren cambios de código. Una vez completados, las funcionalidades de IA-M1/M2
estarán disponibles en producción.

---

## 1. Migración SQL en Supabase — F3-M5

**Por qué:** La Fase 3 Milestone 5 añade campos de publicación a la tabla `documents`.
Sin esta migración, la función "Publish to My Studies" no funcionará en producción.

**Pasos:**

1. Ir a https://app.supabase.com → Seleccionar proyecto BetterNotes
2. Clic en **SQL Editor** (barra lateral izquierda)
3. Crear nuevo query y pegar el siguiente SQL:

```sql
-- F3-M5: campos de publicación en documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS is_published     BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS university       TEXT,
  ADD COLUMN IF NOT EXISTS degree           TEXT,
  ADD COLUMN IF NOT EXISTS subject          TEXT,
  ADD COLUMN IF NOT EXISTS visibility       TEXT      NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS keywords         TEXT[]    NOT NULL DEFAULT '{}';

-- Índice para búsqueda por publicados
CREATE INDEX IF NOT EXISTS idx_documents_is_published ON documents(is_published)
  WHERE is_published = TRUE;
```

4. Clic en **Run** (o Ctrl+Enter)
5. Verificar que no hay errores en el output

**Alternativa:** Si el SQL exacto está en el repositorio, buscarlo en `app-web/supabase/migrations/` o en `.claude/status/`.

---

## 2. OPENAI_API_KEY en Vercel

**Por qué:** Los endpoints de IA (edit-block, edit-document) en app-api necesitan la clave de OpenAI.
Sin ella, todas las peticiones de edición con IA devolverán error 500.

**Pasos:**

1. Ir a https://vercel.com → Dashboard → Proyecto `better-notes` (o como se llame)
2. Clic en **Settings** → **Environment Variables**
3. Añadir variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** `sk-...` (tu clave de OpenAI)
   - **Environments:** marcar Production, Preview y Development
4. Clic en **Save**
5. Hacer **Redeploy** del último deployment para que la variable se aplique:
   - Ir a **Deployments** → clic en los tres puntos del deployment más reciente → **Redeploy**

> Nota: si app-api corre en Railway (no en Vercel), el paso es equivalente pero en el
> Dashboard de Railway: Settings → Variables → añadir OPENAI_API_KEY.

---

## 3. Rebuild imagen Docker de app-api en Railway

**Por qué:** Los endpoints `/latex/edit-document` y `/latex/edit-block` fueron añadidos en
sesión 2026-03-31. Si la imagen Docker desplegada es anterior a ese commit, Railway
servirá una versión vieja que no tiene esos endpoints.

**Pasos (opción A — redeploy manual desde Railway Dashboard):**

1. Ir a https://railway.app → Proyecto BetterNotes → Servicio `app-api`
2. Clic en **Deploy** → **Redeploy** desde el último commit de la rama `main`
   (después del merge — ver sección 4)
3. Esperar a que el build termine (~5-10 minutos, TexLive es grande)
4. Verificar en los logs que aparece: `Server running on port 4000`

**Pasos (opción B — forzar rebuild con variable de entorno):**

Si el redeploy no detecta cambios, añadir/cambiar una variable de entorno trivial
(ej: `BUILD_TIMESTAMP=2026-04-01`) para forzar un nuevo build.

**Verificación post-deploy:**

Hacer un curl de prueba (o usar Postman/Insomnia):
```
POST https://<tu-railway-url>/latex/edit-block
Content-Type: application/json
{ "blockLatex": "test", "userPrompt": "test" }
```
Debe devolver `400 Bad Request` (no `404 Not Found`). Si devuelve 404, el deploy
todavía tiene la versión vieja.

---

## 4. Merge a main

El merge se coordinará desde el equipo de desarrollo una vez confirmados los pasos anteriores.
La rama `session/2026-03-30` (activa) contiene todos los cambios de IA-M1, IA-M2 y el fix del bug de color en ecuaciones.

**Después del merge:**

- El redeploy de Vercel (app-web) es automático si está configurado con autodeploy desde main
- El redeploy de Railway (app-api) requiere el paso manual descrito arriba (punto 3)

---

## Resumen de estado

| Pendiente | Acción requerida | Urgencia |
|-----------|-----------------|----------|
| SQL F3-M5 en Supabase | Ejecutar ALTER TABLE en SQL Editor | Media — solo afecta "Publish to Studies" |
| OPENAI_API_KEY en Vercel/Railway | Añadir variable de entorno | Alta — sin ella la IA no funciona en producción |
| Rebuild Docker app-api | Redeploy en Railway | Alta — sin rebuild los endpoints de IA-M1/M2 no existen en producción |
| Merge a main | Automático tras confirmación del usuario | — |
