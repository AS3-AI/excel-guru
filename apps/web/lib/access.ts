export type AccessReason = "ok" | "signup" | "paywall";
export type AccessDecision = { allowed: boolean; reason: AccessReason };

/** Resolve the server-side inputs shared by lesson rendering and progress writes. */
export async function loadLessonAccess(admin: import("@supabase/supabase-js").SupabaseClient, userId: string, lessonId: string) {
  const [progress, opens, subscriptions, profile] = await Promise.all([
    admin.from("lesson_progress").select("lesson_id").eq("user_id", userId),
    admin.from("lesson_opens").select("lesson_id").eq("user_id", userId),
    admin.from("subscriptions").select("period_end").eq("user_id", userId).eq("status", "active"),
    admin.from("profiles").select("group_id,invited").eq("user_id", userId).maybeSingle(),
  ]);
  if (progress.error || opens.error || subscriptions.error || profile.error) throw new Error("Lesson access is temporarily unavailable");
  const completedLessonIds = (progress.data ?? []).map((row) => row.lesson_id);
  const openedLessonIds = (opens.data ?? []).map((row) => row.lesson_id);
  const premium = (subscriptions.data ?? []).some((row) => !row.period_end || new Date(row.period_end).getTime() > Date.now());
  let groupPremium = false;
  if (profile.data?.group_id) {
    const { data, error } = await admin.from("groups").select("has_paid_access").eq("id", profile.data.group_id).maybeSingle();
    if (error) throw new Error("Lesson access is temporarily unavailable");
    groupPremium = data?.has_paid_access === true;
  }
  const invited = profile.data?.invited === true;
  // Invited learners are treated like a paid group: no paywall.
  groupPremium = groupPremium || invited;
  return { decision: decideLessonAccess({ lessonId, userId, completedLessonIds, openedLessonIds, premium, groupPremium }), completedLessonIds, openedLessonIds, premium, groupPremium, invited };
}

/** Record a page open idempotently. A logging failure never blocks rendering. */
export async function recordLessonOpen(admin: import("@supabase/supabase-js").SupabaseClient, userId: string, lessonId: string): Promise<boolean> {
  try {
    const { error } = await admin.from("lesson_opens").upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
}

/** Apply page access and record a permitted free open before rendering. */
export async function decideAndRecordLessonOpen(input: {
  admin: import("@supabase/supabase-js").SupabaseClient | null;
  lessonId: string;
  userId: string | null;
  completedLessonIds: readonly string[];
  openedLessonIds: readonly string[];
  premium?: boolean;
  groupPremium?: boolean;
}): Promise<AccessDecision> {
  const decision = decideLessonAccess(input);
  if (!decision.allowed || !input.userId || input.premium || input.groupPremium) return decision;
  if (!input.admin) throw new Error("Lesson access is temporarily unavailable");
  const used = new Set([...input.completedLessonIds, ...input.openedLessonIds].filter(Boolean));
  const alreadyUsed = used.has(input.lessonId);
  const recorded = await recordLessonOpen(input.admin, input.userId, input.lessonId);
  if (!alreadyUsed && !recorded && used.size > 0) throw new Error("Lesson access is temporarily unavailable");
  return decision;
}

/** Pure free-tier rule. Premium entitlement is resolved by the server and passed in. */
export function decideLessonAccess(input: {
  lessonId: string;
  userId: string | null;
  completedLessonIds: readonly string[];
  openedLessonIds?: readonly string[];
  premium?: boolean;
  groupPremium?: boolean;
}): AccessDecision {
  if (!input.userId) return input.lessonId === "intro" ? { allowed: true, reason: "ok" } : { allowed: false, reason: "signup" };
  const completed = new Set(input.completedLessonIds.filter(Boolean));
  const used = new Set([...completed, ...(input.openedLessonIds ?? []).filter(Boolean)]);
  if (used.has(input.lessonId)) return { allowed: true, reason: "ok" };
  if (input.premium || input.groupPremium || used.size < 2) return { allowed: true, reason: "ok" };
  return { allowed: false, reason: "paywall" };
}
