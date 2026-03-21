-- ============================================================
-- BetterNotes v2 — Migration: Guest Mode (Anonymous Auth)
-- Proyecto: unnaedblaufyganyconl
-- ============================================================
-- Soporte para usuarios anónimos con límites específicos:
-- - 1 documento máximo (total, no mensual)
-- - 3 mensajes de chat máximo (total, no mensual)
-- ============================================================

-- ============================================================
-- 1. Agregar columna is_anonymous a profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

-- Crear índice para búsquedas rápidas de usuarios anónimos
CREATE INDEX IF NOT EXISTS idx_profiles_is_anonymous
  ON public.profiles(is_anonymous);

-- ============================================================
-- 2. Actualizar trigger handle_new_user para capturar is_anonymous
-- ============================================================
-- Supabase expone is_anonymous en auth.users como un campo booleano
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, is_anonymous)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.is_anonymous, false)
  )
  ON CONFLICT (id) DO UPDATE SET
    is_anonymous = COALESCE(NEW.is_anonymous, false);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. RPC: check_guest_limits
-- Verifica si un usuario anónimo ha alcanzado sus límites
-- Retorna: { allowed: bool, reason?: string, docs_used: int, messages_used: int }
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_guest_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_anon    boolean;
  v_doc_count  integer;
  v_msg_count  integer;
BEGIN
  -- Verificar que el usuario existe y es anónimo
  SELECT is_anonymous INTO v_is_anon
  FROM public.profiles
  WHERE id = p_user_id;

  -- Si no es anónimo o no existe, permitir (sin límites para usuarios normales)
  IF v_is_anon IS FALSE OR v_is_anon IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  -- Contar documentos del usuario
  SELECT COUNT(*) INTO v_doc_count
  FROM public.documents
  WHERE user_id = p_user_id;

  -- Contar mensajes del usuario (solo los que escribió, role='user')
  SELECT COUNT(*) INTO v_msg_count
  FROM public.chat_messages
  WHERE user_id = p_user_id AND role = 'user';

  -- Verificar límite de documentos
  IF v_doc_count >= 1 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'guest_doc_limit',
      'docs_used', v_doc_count,
      'docs_limit', 1,
      'messages_used', v_msg_count,
      'messages_limit', 3
    );
  END IF;

  -- Verificar límite de mensajes
  IF v_msg_count >= 3 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'guest_message_limit',
      'docs_used', v_doc_count,
      'docs_limit', 1,
      'messages_used', v_msg_count,
      'messages_limit', 3
    );
  END IF;

  -- Ambos límites OK
  RETURN jsonb_build_object(
    'allowed', true,
    'docs_used', v_doc_count,
    'docs_limit', 1,
    'messages_used', v_msg_count,
    'messages_limit', 3
  );
END;
$$;

-- Permisos: roles autenticados (incluye anónimos) pueden llamar
REVOKE ALL ON FUNCTION public.check_guest_limits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_guest_limits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_guest_limits(uuid) TO service_role;

-- ============================================================
-- 4. RPC: get_guest_status
-- Helper para obtener estado actual del usuario guest desde frontend
-- Retorna: { is_guest: bool, docs_used: int, docs_limit: int, messages_used: int, messages_limit: int }
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_guest_status()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_is_anon   boolean;
  v_doc_count integer;
  v_msg_count integer;
BEGIN
  -- Si no hay usuario autenticado
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('is_guest', false);
  END IF;

  -- Obtener estado is_anonymous
  SELECT is_anonymous INTO v_is_anon
  FROM public.profiles
  WHERE id = v_uid;

  -- Si no es anónimo o no existe perfil
  IF v_is_anon IS FALSE OR v_is_anon IS NULL THEN
    RETURN jsonb_build_object('is_guest', false);
  END IF;

  -- Contar recursos
  SELECT COUNT(*) INTO v_doc_count
  FROM public.documents
  WHERE user_id = v_uid;

  SELECT COUNT(*) INTO v_msg_count
  FROM public.chat_messages
  WHERE user_id = v_uid AND role = 'user';

  RETURN jsonb_build_object(
    'is_guest', true,
    'docs_used', v_doc_count,
    'docs_limit', 1,
    'messages_used', v_msg_count,
    'messages_limit', 3
  );
END;
$$;

-- Permisos: roles autenticados pueden llamar
REVOKE ALL ON FUNCTION public.get_guest_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_status() TO service_role;

-- ============================================================
-- 5. Nota sobre RLS policies existentes
-- ============================================================
-- Las RLS policies existentes en todas las tablas (profiles, documents,
-- chat_messages, document_attachments, etc.) usan el patrón:
--   auth.uid() = user_id
-- Este patrón funciona perfectamente con usuarios anónimos porque:
-- 1. Los usuarios anónimos tienen un UUID válido en auth.uid()
-- 2. Supabase asigna el mismo UUID tanto en auth.users como en el JWT
-- 3. Por lo tanto, no se requieren cambios en las RLS policies
--
-- NOTA: La lógica de aplicación debe llamar a check_guest_limits()
-- ANTES de permitir la creación de documentos o mensajes para usuarios
-- anónimos (cuando is_anonymous = true).
-- ============================================================

-- ============================================================
-- Rollback / Revert
-- ============================================================
-- Para revertir esta migración (en caso de necesitarlo):
-- 1. DROP FUNCTION public.get_guest_status();
-- 2. DROP FUNCTION public.check_guest_limits(uuid);
-- 3. DROP INDEX idx_profiles_is_anonymous;
-- 4. ALTER TABLE public.profiles DROP COLUMN is_anonymous;
-- ============================================================
