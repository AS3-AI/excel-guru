import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ONBOARDING, safeNext } from "@/lib/auth";
import { ensureProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

// Landing point for Google OAuth (?code=) and email confirmation links
// (?code= with PKCE, or ?token_hash=&type= with a custom email template).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

  const supabase = await createClient();
  if (!supabase) return fail("unavailable");

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
  if (error) return fail("link");

  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("link");

  const profiled = await ensureProfile(data.user);
  const target = profiled ? next : `${ONBOARDING}?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(target, request.url));
}
