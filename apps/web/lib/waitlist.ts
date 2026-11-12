export type WaitlistInput = { email: string; source: string };

export type ParseResult =
  | { ok: true; value: WaitlistInput }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_SOURCE = 64;

export function parseWaitlistBody(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const { email, source } = body as Record<string, unknown>;
  if (typeof email !== "string") return { ok: false, error: "Invalid email" };
  const normalized = email.trim().toLowerCase();
  if (normalized.length > MAX_EMAIL || !EMAIL_RE.test(normalized)) {
    return { ok: false, error: "Invalid email" };
  }
  const src =
    typeof source === "string" && source.trim() ? source.trim().slice(0, MAX_SOURCE) : "landing";
  return { ok: true, value: { email: normalized, source: src } };
}

// Postgres unique_violation
export const UNIQUE_VIOLATION = "23505";
