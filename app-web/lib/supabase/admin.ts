import { createClient } from '@supabase/supabase-js';

/**
 * Admin (service-role) Supabase client.
 * Bypasses RLS — only use in server-side API routes that need it.
 * Never expose to the client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
