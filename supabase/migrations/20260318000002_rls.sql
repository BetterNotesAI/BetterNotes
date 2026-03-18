-- ============================================================
-- BetterNotes v2 — Migration 2: RLS + RPCs
-- ============================================================

-- ---------------------
-- Habilitar RLS en todas las tablas
-- ---------------------
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_usage      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: owns_document()
-- SECURITY DEFINER para evitar recursión en RLS de document_versions
-- ============================================================
CREATE OR REPLACE FUNCTION public.owns_document(p_doc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = p_doc_id
      AND user_id = auth.uid()
  );
$$;

-- ---------------------
-- RLS: profiles — owner_all
-- ---------------------
CREATE POLICY "profiles: owner select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: owner insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: owner update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: owner delete"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- ---------------------
-- RLS: subscriptions — owner_all
-- ---------------------
CREATE POLICY "subscriptions: owner select"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "subscriptions: owner insert"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions: owner update"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions: owner delete"
  ON public.subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------
-- RLS: templates — SELECT pública, escritura solo service_role
-- ---------------------
CREATE POLICY "templates: public select"
  ON public.templates FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE solo accesibles desde service_role (bypassa RLS por defecto)

-- ---------------------
-- RLS: documents — owner_all
-- ---------------------
CREATE POLICY "documents: owner select"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "documents: owner insert"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents: owner update"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents: owner delete"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------
-- RLS: document_versions — usa owns_document() SECURITY DEFINER
-- ---------------------
CREATE POLICY "document_versions: owner select"
  ON public.document_versions FOR SELECT
  USING (public.owns_document(document_id));

CREATE POLICY "document_versions: owner insert"
  ON public.document_versions FOR INSERT
  WITH CHECK (public.owns_document(document_id));

CREATE POLICY "document_versions: owner update"
  ON public.document_versions FOR UPDATE
  USING (public.owns_document(document_id));

CREATE POLICY "document_versions: owner delete"
  ON public.document_versions FOR DELETE
  USING (public.owns_document(document_id));

-- ---------------------
-- RLS: chat_messages — owner_all
-- ---------------------
CREATE POLICY "chat_messages: owner select"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "chat_messages: owner insert"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_messages: owner update"
  ON public.chat_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "chat_messages: owner delete"
  ON public.chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------
-- RLS: document_attachments — usa owns_document()
-- ---------------------
CREATE POLICY "document_attachments: owner select"
  ON public.document_attachments FOR SELECT
  USING (public.owns_document(document_id));

CREATE POLICY "document_attachments: owner insert"
  ON public.document_attachments FOR INSERT
  WITH CHECK (public.owns_document(document_id));

CREATE POLICY "document_attachments: owner update"
  ON public.document_attachments FOR UPDATE
  USING (public.owns_document(document_id));

CREATE POLICY "document_attachments: owner delete"
  ON public.document_attachments FOR DELETE
  USING (public.owns_document(document_id));

-- ---------------------
-- RLS: message_usage — owner_all
-- ---------------------
CREATE POLICY "message_usage: owner select"
  ON public.message_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "message_usage: owner insert"
  ON public.message_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "message_usage: owner update"
  ON public.message_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "message_usage: owner delete"
  ON public.message_usage FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- RPCs
-- ============================================================

-- Trigger: al crear usuario en auth.users → INSERT en profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Registrar el trigger en auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------
-- RPC: get_usage_status
-- ---------------------
CREATE OR REPLACE FUNCTION public.get_usage_status(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_plan        text;
  v_msg_count   int4;
  v_limit       int4;
  v_period      timestamptz;
BEGIN
  SELECT plan INTO v_plan
  FROM public.profiles
  WHERE id = p_user_id;

  v_plan   := COALESCE(v_plan, 'free');
  v_limit  := CASE v_plan WHEN 'pro' THEN 999999 ELSE 20 END;
  v_period := date_trunc('month', now());

  SELECT message_count INTO v_msg_count
  FROM public.message_usage
  WHERE user_id = p_user_id
    AND period_start = v_period;

  v_msg_count := COALESCE(v_msg_count, 0);

  RETURN json_build_object(
    'plan',          v_plan,
    'message_count', v_msg_count,
    'limit',         v_limit,
    'remaining',     GREATEST(v_limit - v_msg_count, 0),
    'period_start',  v_period
  );
END;
$$;

-- ---------------------
-- RPC: increment_message_count
-- ---------------------
CREATE OR REPLACE FUNCTION public.increment_message_count(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period    timestamptz := date_trunc('month', now());
  v_new_count int4;
BEGIN
  INSERT INTO public.message_usage (user_id, message_count, period_start)
  VALUES (p_user_id, 1, v_period)
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET
    message_count = public.message_usage.message_count + 1,
    updated_at    = now()
  RETURNING message_count INTO v_new_count;

  RETURN json_build_object(
    'message_count', v_new_count,
    'period_start',  v_period
  );
END;
$$;
