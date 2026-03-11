# BetterNotes

AI-powered note-taking app that turns raw notes into clean LaTeX documents and PDFs.
Students write a prompt, pick a template, and get a formatted formula sheet, summary, or cheat-sheet in seconds.

**Live app:** https://better-notes-five.vercel.app

---

## Architecture

```
BetterNotes/
├── app-web/      Next.js 16 frontend — deployed on Vercel
├── app-api/      Express + LaTeX backend — deployed on Railway (Docker)
└── supabase/     Database schema (SQL files, run in order 01→11)
```

- **app-web** handles the UI, auth (Supabase), and Stripe billing. API calls go through Next.js proxy routes (`app/api/`) to avoid exposing the backend URL to the browser.
- **app-api** runs the OpenAI calls (LaTeX generation) and LaTeX compilation via `pdflatex`. It requires Docker because it installs a full TeX Live distribution.
- **Supabase** provides Postgres (RLS), Auth (Google OAuth + email), and Storage (file uploads).

---

## Local development

### Prerequisites
- Node.js 20+
- Docker Desktop (for app-api)

### 1. Frontend (app-web)

```bash
cd app-web
npm install
npm run dev        # http://localhost:3000
```

Create `app-web/.env.local` with:
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SITE_URL=http://localhost:3000
API_BASE_URL=http://localhost:4000

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_PRO_MONTHLY=...
```

### 2. Backend (app-api)

With Docker Compose (recommended — loads env vars automatically):
```bash
cd app-api
docker compose up --build    # http://localhost:4000
```

Or without Docker (requires a local TeX Live installation):
```bash
cd app-api
npm install
npm run dev
```

Create `app-api/.env` with:
```
PORT=4000
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
ALLOWED_ORIGINS=http://localhost:3000
```

> The backend automatically reads `app-web/.env.local` for Supabase and Stripe keys when running locally, so you don't need to duplicate them.

### 3. Health check

Once both are running:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000/health

---

## Production deployment

### Vercel (app-web)

Set these environment variables in the Vercel dashboard:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://www.better-notes.ai` |
| `SITE_URL` | `https://www.better-notes.ai` |
| `API_BASE_URL` | `https://betternotes-production.up.railway.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase dashboard |
| `STRIPE_SECRET_KEY` | from Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | from Stripe dashboard |
| `STRIPE_PRICE_PRO_MONTHLY` | from Stripe dashboard |

### Railway (app-api)

Set these environment variables in the Railway dashboard:

| Variable | Value |
|---|---|
| `PORT` | `4000` |
| `OPENAI_API_KEY` | from OpenAI dashboard |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `ALLOWED_ORIGINS` | `https://www.better-notes.ai` |
| `SITE_URL` | `https://www.better-notes.ai` |
| `SUPABASE_URL` | from Supabase dashboard |
| `SUPABASE_ANON_KEY` | from Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase dashboard |
| `STRIPE_SECRET_KEY` | from Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | from Stripe dashboard |
| `STRIPE_PRICE_PRO_MONTHLY` | from Stripe dashboard |

Railway deploys automatically from the `app-api/Dockerfile` on every push to `main`.

---

## Database (Supabase)

SQL files in `supabase/` define the full schema. Run them in order in the Supabase SQL Editor to set up a fresh project:

| File | Contents |
|---|---|
| `01_extensions.sql` | pg_trgm, unaccent |
| `02_functions.sql` | set_updated_at trigger, handle_new_user trigger |
| `03_users.sql` | profiles, message_usage, usage RPCs |
| `04_chats.sql` | chats table |
| `05_projects.sql` | projects, output files, uploaded files, shares |
| `06_universities.sql` | universities, degree programs, subjects |
| `07_publishing.sql` | published documents, ratings, search RPC |
| `08_support.sql` | support tickets |
| `09_rls.sql` | Row Level Security policies for all project tables |
| `10_storage.sql` | Storage buckets + RLS (user-files, project-files, user-avatars) |
| `11_seed.sql` | Initial Spanish universities data |

All files are idempotent — safe to run on an existing database.

### Google OAuth

1. Supabase dashboard → Authentication → URL Configuration:
   - Site URL: `https://www.better-notes.ai`
   - Redirect URLs: `https://www.better-notes.ai/**` and `http://localhost:3000/**`
2. Supabase dashboard → Authentication → Providers → Google → Enable Supabase OAuth Server

---

## Key conventions

- All API routes in `app-web/app/api/` are thin proxies to `app-api` — they forward requests and stream responses. Never put business logic there.
- `app-web/lib/api/` contains all Supabase client calls, split by domain (chats, projects, files, etc.). Import from `@/lib/api` (barrel file).
- LaTeX templates live in two places: `app-api/templates/` (used for generation) and `app-web/public/templates/` (served for download). Keep them in sync.
- Never commit `.env` or `.env.local` files — they are gitignored.
