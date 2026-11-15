export type AccessReason = "ok" | "signup" | "paywall";
export type AccessDecision = { allowed: boolean; reason: AccessReason };

/** Resolve the server-side inputs shared by lesson rendering and progress writes. */
export async function loadLessonAccess(admin: import("@supabase/supabase-js").SupabaseClient, userId: string, lessonId: string) {
  const [progress, subscriptions, profile] = await Promise.all([
    admin.from("lesson_progress").select("lesson_id").eq("user_id", userId),
    admin.from("subscriptions").select("period_end").eq("user_id", userId).eq("status", "active"),
    admin.from("profiles").select("group_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (progress.error || subscriptions.error || profile.error) throw new Error("Lesson access is temporarily unavailable");
  const completedLessonIds = (progress.data ?? []).map((row) => row.lesson_id);
  const premium = (subscriptions.data ?? []).some((row) => !row.period_end || new Date(row.period_end).getTime() > Date.now());
  let groupPremium = false;
  if (profile.data?.group_id) {
    const { data, error } = await admin.from("groups").select("has_paid_access").eq("id", profile.data.group_id).maybeSingle();
    if (error) throw new Error("Lesson access is temporarily unavailable");
    groupPremium = data?.has_paid_access === true;
  }
  return { decision: decideLessonAccess({ lessonId, userId, completedLessonIds, premium, groupPremium }), completedLessonIds, premium, groupPremium };
}

/** Pure free-tier rule. Premium entitlement is resolved by the server and passed in. */
export function decideLessonAccess(input: {
  lessonId: string;
  userId: string | null;
  completedLessonIds: readonly string[];
  premium?: boolean;
  groupPremium?: boolean;
}): AccessDecision {
  if (!input.userId) return input.lessonId === "intro" ? { allowed: true, reason: "ok" } : { allowed: false, reason: "signup" };
  const completed = new Set(input.completedLessonIds.filter(Boolean));
  if (completed.has(input.lessonId)) return { allowed: true, reason: "ok" };
  if (input.premium || input.groupPremium || completed.size < 2) return { allowed: true, reason: "ok" };
  return { allowed: false, reason: "paywall" };
}
