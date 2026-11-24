"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  INVITE_ERROR,
  isValidInvite,
  ONBOARDING,
  originFrom,
  safeNext,
  validateLogin,
  validateProfile,
  validateSignup,
  type FieldErrors,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createProfile, ensureProfile, isUsernameTaken } from "@/lib/supabase/profile";

export type FormState = {
  errors?: FieldErrors<string>;
  message?: string; // form-level error
  notice?: string; // form-level success (e.g. "check your email")
  values?: Record<string, string>; // echoed back so React's form reset doesn't wipe input
};

const UNAVAILABLE = "Sign-in is temporarily unavailable. Please try again later.";

async function origin() {
  const h = await headers();
  return originFrom((n) => h.get(n), process.env.NEXT_PUBLIC_BASE_URL);
}

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function callbackUrl(base: string, next: string) {
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: field(formData, "email") };
  const next = safeNext(field(formData, "next"));
  const parsed = validateLogin({ email: values.email, password: field(formData, "password") });
  if (!parsed.ok) return { errors: parsed.errors, values };

  const supabase = await createClient();
  if (!supabase) return { message: UNAVAILABLE, values };

  const { data, error } = await supabase.auth.signInWithPassword(parsed.value);
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") {
      return { message: "Confirm your email first: check your inbox for the link.", values };
    }
    return { message: "Wrong email or password.", values };
  }

  const profiled = await ensureProfile(data.user);
  redirect(profiled ? next : `${ONBOARDING}?next=${encodeURIComponent(next)}`);
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    firstName: field(formData, "firstName"),
    username: field(formData, "username"),
    email: field(formData, "email"),
    confirmEmail: field(formData, "confirmEmail"),
    password: field(formData, "password"),
    invite: field(formData, "invite"),
  };
  const { password: _pw, ...values } = raw;
  const next = safeNext(field(formData, "next"));
  const parsed = validateSignup(raw);
  const inviteOk = isValidInvite(raw.invite);
  if (!parsed.ok || !inviteOk) {
    return { errors: { ...(parsed.ok ? {} : parsed.errors), ...(inviteOk ? {} : { invite: INVITE_ERROR }) }, values };
  }

  const supabase = await createClient();
  if (!supabase) return { message: UNAVAILABLE, values };

  if (await isUsernameTaken(parsed.value.username)) {
    return { errors: { username: "That username is taken" }, values };
  }

  const { email, password, firstName, username } = parsed.value;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl(await origin(), next),
      data: { first_name: firstName, username, invite: raw.invite.trim() },
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { errors: { email: "An account with this email already exists. Log in instead." }, values };
    }
    if (error.code === "weak_password") return { errors: { password: error.message }, values };
    console.error("signup failed", error.code, error.message);
    return { message: "Could not create your account. Please try again.", values };
  }

  // Email confirmation off: we already have a session.
  if (data.session && data.user) {
    const profiled = await ensureProfile(data.user);
    redirect(profiled ? next : `${ONBOARDING}?next=${encodeURIComponent(next)}`);
  }

  // Email confirmation on (also returned, deliberately vague, for an existing email).
  return {
    notice: `Check ${email} for a confirmation link to finish creating your account.`,
    values,
  };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(field(formData, "next"));
  const invite = field(formData, "invite").trim();
  const supabase = await createClient();
  if (!supabase) redirect(`/login?error=unavailable`);
  const redirectTo = callbackUrl(await origin(), next) + (invite ? `&invite=${encodeURIComponent(invite)}` : "");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error || !data.url) {
    console.error("google sign-in failed", error?.code, error?.message);
    redirect(`/login?error=oauth`);
  }
  redirect(data.url);
}

export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    firstName: field(formData, "firstName"),
    username: field(formData, "username"),
    invite: field(formData, "invite"),
  };
  const next = safeNext(field(formData, "next"));
  const parsed = validateProfile(values);
  const inviteOk = isValidInvite(values.invite);
  if (!parsed.ok || !inviteOk) {
    return { errors: { ...(parsed.ok ? {} : parsed.errors), ...(inviteOk ? {} : { invite: INVITE_ERROR }) }, values };
  }

  const supabase = await createClient();
  if (!supabase) return { message: UNAVAILABLE, values };
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);

  const res = await createProfile(data.user, parsed.value);
  if (!res.ok) {
    if (res.reason === "username_taken") return { errors: { username: "That username is taken" }, values };
    return { message: res.reason === "unavailable" ? UNAVAILABLE : "Could not save your profile. Please try again.", values };
  }
  redirect(next);
}
