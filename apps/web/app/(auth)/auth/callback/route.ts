import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ONBOARDING, originFrom, safeNext } from "@/lib/auth";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { ensureProfile } from "@/lib/supabase/profile";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

// Landing point for Google OAuth (?code=) and email confirmation links
// (?code= with PKCE, or ?token_hash=&type= with a custom email template).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const origin = originFrom((n) => request.headers.get(n), process.env.NEXT_PUBLIC_BASE_URL);

  let cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];
  let cacheHeaders: Record<string, string> = {};

  const sendRedirect = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin));
    for (const { name, value, options } of cookiesToSet) {
      res.cookies.set(name, value, options);
    }
    for (const [k, v] of Object.entries(cacheHeaders)) {
      res.headers.set(k, v);
    }
    return res;
  };

  const fail = (reason: string) => sendRedirect(`/login?error=${reason}`);

  const env = supabasePublicEnv();
  if (!env) return fail("unavailable");

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(newCookies, headers) {
        cookiesToSet = newCookies;
        if (headers) cacheHeaders = { ...cacheHeaders, ...headers };
      },
    },
  });

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let error: unknown = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else {
    return fail(searchParams.get("error") ? "oauth" : "link");
  }
  if (error) return fail(code ? "oauth" : "link");

  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail(code ? "oauth" : "link");

  const profiled = await ensureProfile(data.user);
  const target = profiled ? next : `${ONBOARDING}?next=${encodeURIComponent(next)}`;
  return sendRedirect(target);
}
