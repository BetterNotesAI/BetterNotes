-- ============================================================
-- BetterNotes v2 — Migration 1: Base Schema
-- Proyecto: BetterNotesAI-3 (unnaedblaufyganyconl)
-- ============================================================

-- ---------------------
-- 1. profiles
-- ---------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text,
  plan            text        NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  stripe_customer_id text,
  display_name    text,
  avatar_url      text,
  theme           text        NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------
-- 2. subscriptions
-- ---------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  stripe_subscription_id  text        UNIQUE,
  stripe_customer_id      text,
  status                  text        NOT NULL,
  price_id                text,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean     NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ---------------------
-- 3. templates (catálogo público)
-- ---------------------
CREATE TABLE IF NOT EXISTS public.templates (
  id                  text        PRIMARY KEY,
  display_name        text        NOT NULL,
  description         text,
  is_pro              boolean     NOT NULL DEFAULT false,
  preview_url         text,
  preamble            text        NOT NULL,
  style_guide         text        NOT NULL,
  structure_template  text        NOT NULL,
  structure_example   text        NOT NULL,
  sort_order          int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------
-- 4. documents
-- ---------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id         text        NOT NULL,
  title               text        NOT NULL DEFAULT 'Untitled Document',
  status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'error')),
  current_version_id  uuid,       -- FK diferida, se añade después
  is_starred          boolean     NOT NULL DEFAULT false,
  tags                text[]      NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------
-- 5. document_versions
-- ---------------------
CREATE TABLE IF NOT EXISTS public.document_versions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number  int         NOT NULL,
  latex_content   text        NOT NULL,
  pdf_storage_path text,
  compile_status  text        NOT NULL DEFAULT 'pending' CHECK (compile_status IN ('pending', 'success', 'failed')),
  compile_log     text,
  prompt_used     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);

-- FK circular diferida: documents.current_version_id -> document_versions.id
ALTER TABLE public.documents
  ADD CONSTRAINT fk_current_version
  FOREIGN KEY (current_version_id)
  REFERENCES public.document_versions(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ---------------------
-- 6. chat_messages
-- ---------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     text        NOT NULL,
  version_id  uuid        REFERENCES public.document_versions(id) ON DELETE SET NULL,
  attachments jsonb       NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------
-- 7. document_attachments
-- ---------------------
CREATE TABLE IF NOT EXISTS public.document_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  storage_path text        NOT NULL,
  mime_type    text,
  size_bytes   int8,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------
-- 8. message_usage
-- ---------------------
CREATE TABLE IF NOT EXISTS public.message_usage (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_count int4        NOT NULL DEFAULT 0,
  period_start  timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);
