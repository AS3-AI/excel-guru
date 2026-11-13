// Pure auth helpers: form validation, username rules, redirect decisions.
// No Next or Supabase imports, so everything here is unit-tested in auth.test.ts.

export const DEFAULT_AFTER_AUTH = "/dashboard";

/** Routes that need a signed-in learner with a profile row. /dashboard is public (signed out shows 0 / 85). */
export const PROTECTED_PREFIXES = ["/profile", "/review", "/admin"] as const;
/** Pages that make no sense once signed in. */
export const AUTH_PAGES = ["/login", "/signup"] as const;
export const ONBOARDING = "/onboarding";

// Must match the check constraint on profiles.username in 0001_init.sql.
export const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "support", "help", "api", "auth", "login", "logout",
  "signup", "onboarding", "dashboard", "profile", "review", "settings", "pricing", "verify",
  "excelguru", "excel_guru", "staff", "moderator", "system", "null", "undefined",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_FIRST_NAME = 50;
export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt limit used by Supabase Auth

export type FieldErrors<K extends string> = Partial<Record<K, string>>;
export type Validation<T, K extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<K> };

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns an error message, or null when the (normalized) username is fine. */
export function usernameError(username: string): string | null {
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 20) return "Username must be at most 20 characters";
  if (!USERNAME_RE.test(username)) {
    return "Use lowercase letters, numbers and _, starting with a letter";
  }
  if (RESERVED_USERNAMES.has(username)) return "That username is reserved";
  return null;
}

export function firstNameError(firstName: string): string | null {
  if (!firstName) return "Enter your first name";
  if (firstName.length > MAX_FIRST_NAME) return `First name must be at most ${MAX_FIRST_NAME} characters`;
  return null;
}

export function emailError(email: string): string | null {
  if (!email) return "Enter your email";
  if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return "Enter a valid email";
  return null;
}

export type ProfileInput = { firstName: string; username: string };
type ProfileField = "firstName" | "username";

export function validateProfile(input: Record<string, unknown>): Validation<ProfileInput, ProfileField> {
  const firstName = str(input.firstName).trim();
  const username = normalizeUsername(str(input.username));
  const errors: FieldErrors<ProfileField> = {};
  const f = firstNameError(firstName);
  if (f) errors.firstName = f;
  const u = usernameError(username);
  if (u) errors.username = u;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { firstName, username } };
}

export type SignupInput = ProfileInput & { email: string; password: string };
export type SignupField = ProfileField | "email" | "confirmEmail" | "password";

export function validateSignup(input: Record<string, unknown>): Validation<SignupInput, SignupField> {
  const profile = validateProfile(input);
  const errors: FieldErrors<SignupField> = profile.ok ? {} : { ...profile.errors };

  const email = str(input.email).trim().toLowerCase();
  const confirmEmail = str(input.confirmEmail).trim().toLowerCase();
  const password = str(input.password);

  const e = emailError(email);
  if (e) errors.email = e;
  else if (confirmEmail !== email) errors.confirmEmail = "Emails don't match";

  if (password.length < MIN_PASSWORD) errors.password = `Password must be at least ${MIN_PASSWORD} characters`;
  else if (password.length > MAX_PASSWORD) errors.password = `Password must be at most ${MAX_PASSWORD} characters`;

  if (!profile.ok || Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { ...profile.value, email, password } };
}

export type LoginInput = { email: string; password: string };

export function validateLogin(input: Record<string, unknown>): Validation<LoginInput, "email" | "password"> {
  const email = str(input.email).trim().toLowerCase();
  const password = str(input.password);
  const errors: FieldErrors<"email" | "password"> = {};
  const e = emailError(email);
  if (e) errors.email = e;
  if (!password) errors.password = "Enter your password";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { email, password } };
}

/**
 * Only same-site relative paths are allowed as post-auth destinations,
 * so ?next= can't be used as an open redirect.
 */
export function safeNext(next: unknown, fallback = DEFAULT_AFTER_AUTH): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  // Never bounce back into the auth pages themselves.
  const path = next.split(/[?#]/)[0] ?? "";
  if (matches(path, [...AUTH_PAGES, ONBOARDING, "/auth"])) return fallback;
  return next;
}

function matches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isProtected(pathname: string): boolean {
  return matches(pathname, PROTECTED_PREFIXES);
}

/** Whether the proxy must look up the profile row to decide this request. */
export function needsProfileCheck(pathname: string): boolean {
  return isProtected(pathname) || matches(pathname, [...AUTH_PAGES, ONBOARDING]);
}

export type RouteState = { pathname: string; search: string; signedIn: boolean; hasProfile: boolean };

/** Where the proxy should send this request, or null to let it through. */
export function authRedirect({ pathname, search, signedIn, hasProfile }: RouteState): string | null {
  const here = `${pathname}${search}`;
  const nextParam = new URLSearchParams(search).get("next");

  if (isProtected(pathname)) {
    if (!signedIn) return withNext("/login", here);
    if (!hasProfile) return withNext(ONBOARDING, here);
    return null;
  }
  if (matches(pathname, [ONBOARDING])) {
    if (!signedIn) return withNext("/login", safeNext(nextParam));
    if (hasProfile) return safeNext(nextParam);
    return null;
  }
  if (matches(pathname, AUTH_PAGES) && signedIn) {
    return hasProfile ? safeNext(nextParam) : withNext(ONBOARDING, safeNext(nextParam));
  }
  return null;
}

function withNext(path: string, next: string): string {
  return `${path}?next=${encodeURIComponent(next)}`;
}

/**
 * Origin for auth redirect URLs: the request's own origin (so Vercel preview
 * URLs work), falling back to NEXT_PUBLIC_BASE_URL, then localhost.
 */
export function originFrom(
  get: (name: string) => string | null,
  baseUrl: string | undefined,
): string {
  const host = get("x-forwarded-host") ?? get("host");
  if (host && /^[a-z0-9.:-]+$/i.test(host)) {
    const proto = get("x-forwarded-proto")?.split(",")[0]?.trim()
      ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    if (proto === "http" || proto === "https") return `${proto}://${host}`;
  }
  if (baseUrl) return baseUrl.replace(/\/+$/, "");
  return "http://localhost:3000";
}

/** First name from OAuth metadata (Google sends full_name / name / given_name). */
export function firstNameFromMetadata(meta: Record<string, unknown> | undefined): string {
  if (!meta) return "";
  for (const key of ["first_name", "given_name", "full_name", "name"]) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) {
      // full_name / name: keep the first word only.
      const isFull = key === "full_name" || key === "name";
      const name = isFull ? (v.trim().split(/\s+/)[0] ?? "") : v.trim();
      return name.slice(0, MAX_FIRST_NAME);
    }
  }
  return "";
}

// Postgres unique_violation
export const UNIQUE_VIOLATION = "23505";
