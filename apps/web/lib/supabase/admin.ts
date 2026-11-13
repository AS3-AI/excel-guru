import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS. Server only — the "server-only" import makes
 * any client-bundle import a build error. Null when env vars are missing.
 * SUPABASE_SERVICE_ROLE_KEY holds the secret key.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
