import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { authRedirect, needsProfileCheck } from "@/lib/auth";
import { supabasePublicEnv } from "./env";

/**
 * Runs in proxy.ts on every page request: refreshes the Supabase session cookie,
 * then applies the signed-in / onboarding redirects from lib/auth.ts.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (request.nextUrl.searchParams.has("code") && !pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL(`/auth/callback${search}`, request.url));
  }

  let response = NextResponse.next({ request });
  const env = supabasePublicEnv();
  if (!env) return response; // Supabase not configured: everything is public.

  let cacheHeaders: Record<string, string> = {};
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        cacheHeaders = { ...cacheHeaders, ...headers };
        for (const [k, v] of Object.entries(cacheHeaders)) response.headers.set(k, v);
      },
    },
  });

  // Don't put code between client creation and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  let hasProfile = false;
  if (userId && needsProfileCheck(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    hasProfile = profile !== null;
  }

  const target = authRedirect({ pathname, search, signedIn: userId !== null, hasProfile });
  if (!target) return response;

  // Carry any refreshed session cookies and no-cache headers onto the redirect.
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const [k, v] of Object.entries(cacheHeaders)) redirect.headers.set(k, v);
  return redirect;
}
