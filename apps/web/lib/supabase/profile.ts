import "server-only";
import type { User } from "@supabase/supabase-js";
import { firstNameFromMetadata, normalizeUsername, UNIQUE_VIOLATION, validateProfile, isValidInvite } from "@/lib/auth";
import { createAdminClient } from "./admin";

export type CreateProfileResult =
  | { ok: true }
  | { ok: false; reason: "username_taken" | "unavailable" | "error" };

/** Inserts the profiles row with the service key (RLS allows no client writes). */
export async function createProfile(
  user: Pick<User, "id" | "email">,
  input: { firstName: string; username: string },
): Promise<CreateProfileResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: "unavailable" };
  const { error } = await admin.from("profiles").insert({
    user_id: user.id,
    email: user.email?.toLowerCase() ?? null,
    first_name: input.firstName,
    username: input.username,
  });
  if (!error) return { ok: true };
  if (error.code === UNIQUE_VIOLATION) {
    // Either the username is taken, or this user already has a profile.
    if (await hasProfile(user.id)) return { ok: true };
    return { ok: false, reason: "username_taken" };
  }
  console.error("profile insert failed", error.code, error.message);
  return { ok: false, reason: "error" };
}

export async function hasProfile(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
  return data !== null;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin.from("profiles").select("user_id").eq("username", username).maybeSingle();
  return data !== null;
}

/**
 * After email sign-up the chosen first name and username travel in user_metadata.
 * Turn them into the profiles row once a session exists. Returns whether the
 * user now has a profile; false means "send to /onboarding".
 */
export async function ensureProfile(user: User): Promise<boolean> {
  if (await hasProfile(user.id)) return true;
  const meta = user.user_metadata ?? {};
  // Only auto-create for users who signed up with a valid invite; others go through onboarding.
  if (!isValidInvite(meta.invite)) return false;
  const parsed = validateProfile({
    firstName: firstNameFromMetadata(meta),
    username: typeof meta.username === "string" ? normalizeUsername(meta.username) : "",
  });
  if (!parsed.ok) return false;
  const res = await createProfile(user, parsed.value);
  return res.ok;
}
