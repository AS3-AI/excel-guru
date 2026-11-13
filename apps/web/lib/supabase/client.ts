// Browser-side client for Client Components.
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicEnv } from "./env";

/** Browser client (publishable key only). Null when Supabase isn't configured. */
export function createClient() {
  const env = supabasePublicEnv();
  return env ? createBrowserClient(env.url, env.key) : null;
}
