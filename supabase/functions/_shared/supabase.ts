import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { requireEnv } from "./env.ts";

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

export function createUserClient(authHeader: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
}

export function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}
