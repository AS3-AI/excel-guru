// Public Supabase config. NEXT_PUBLIC_SUPABASE_ANON_KEY holds the publishable key.
// Returns null when unset so builds and pages degrade instead of crashing.
export function supabasePublicEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
