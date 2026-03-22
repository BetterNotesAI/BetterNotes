# BetterNotes — Guía de desarrollo local

> **Prerequisitos:** Node.js 18+, Docker Desktop instalado y corriendo.
> Los archivos `.env` ya están configurados — no necesitas tocar nada.

---

## Primera vez (setup inicial)

### 1. Instalar dependencias

```bash
# Frontend
cd app-web && npm install

# Backend
cd ../app-api && npm install
```

### 2. Build de la imagen Docker del backend

Solo necesitas hacer esto **una vez** (o cuando cambies el `Dockerfile` o `package.json`):

```bash
cd app-api
docker build -t betternotes-api .
```

> Tarda ~5-10 minutos la primera vez porque instala TeX Live completo (pdflatex + latexmk).
> Las siguientes veces es instantáneo gracias al cache de capas de Docker.

---

## Opciones de inicio del día a día

### Opción A — Desarrollo completo con PDF (recomendado)

Usa esta opción cuando trabajes en features que involucren generación de documentos.

**Terminal 1 — Backend (Docker):**
```bash
cd app-api
docker run -p 4000:4000 --env-file .env betternotes-api
```

**Terminal 2 — Frontend:**
```bash
cd app-web
npm run dev
```

Abre `http://localhost:3000`

---

### Opción B — Desarrollo rápido sin PDF

Usa esta opción cuando trabajes en frontend puro (auth, sidebar, UI) y no necesites compilar PDFs. Es más rápido de arrancar.

**Terminal 1 — Backend (directo, sin Docker):**
```bash
cd app-api
npm run dev
```
> Si intentas generar un PDF fallará (pdflatex no está disponible en Windows), pero todo lo demás funciona: auth, chat, Supabase, Stripe.

**Terminal 2 — Frontend:**
```bash
cd app-web
npm run dev
```

Abre `http://localhost:3000`

---

### Opción C — Solo frontend (sin backend)

Usa esta opción cuando trabajes en componentes puramente visuales que no llamen a la API.

```bash
cd app-web
npm run dev
```

> Las llamadas al backend devolverán error, pero la UI carga y puedes inspeccionar el layout.

---

## Notas útiles

**Freemium desactivado en local**
`NEXT_PUBLIC_DEV_UNLIMITED=true` ya está configurado en `app-web/.env.local`.
Puedes generar documentos y usar el chat sin límites sin necesitar una suscripción Pro.

**Stripe en local**
Las claves actuales son de producción (live). Si quieres probar el flujo de pago sin cargos reales, usa las claves `sk_test_` / `pk_test_` del dashboard de Stripe y crea un producto de test.

**Reconstruir la imagen Docker**
Solo necesario si cambias `Dockerfile`, `package.json`, o añades dependencias al backend:
```bash
cd app-api
docker build -t betternotes-api .
```

**Ver logs del backend en Docker**
Los logs salen directamente en la terminal donde corre `docker run`. Para correrlo en segundo plano y ver logs después:
```bash
docker run -d -p 4000:4000 --env-file .env --name betternotes-api betternotes-api
docker logs -f betternotes-api

# Para pararlo:
docker stop betternotes-api && docker rm betternotes-api
```

**Puertos**
| Servicio | Puerto |
|----------|--------|
| Frontend (Next.js) | http://localhost:3000 |
| Backend (Express) | http://localhost:4000 |
