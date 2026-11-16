import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { getLesson } from "@/lib/lessons";
import { decideLessonAccess, loadLessonAccess } from "@/lib/access";
import { calculateProgress, getIstDate, getIstDayUtcBounds, getStreak, pointsAllowedForCompletion, progressAttemptRows, readBodyAfterAuthentication, shouldRetryCompletionWithZeroPoints, type ProgressAttempt, type StreakRow } from "@/lib/progress";

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Progress unavailable" }, { status: 503 });
  if (!(await rateLimit(admin, `progress/merge:${user.id}`, 20, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: unknown;
  try {
    const parsed = await readBodyAfterAuthentication(user, () => request.json());
    if (!parsed.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    body = parsed.body;
  } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || !Array.isArray((body as { lessons?: unknown }).lessons)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  let completedLessonIds: string[];
  let openedLessonIds: string[];
  let premium: boolean;
  let groupPremium: boolean;
  try {
    const access = await loadLessonAccess(admin, user.id, "intro");
    completedLessonIds = access.completedLessonIds;
    openedLessonIds = access.openedLessonIds;
    premium = access.premium;
    groupPremium = access.groupPremium;
  } catch { return NextResponse.json({ error: "Progress unavailable" }, { status: 500 }); }
  let merged = 0;
  let partialFailure = false;
  for (const item of (body as { lessons: unknown[] }).lessons) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { lessonId?: unknown; attempts?: unknown };
    if (typeof candidate.lessonId !== "string" || !Array.isArray(candidate.attempts)) continue;
    const lesson = getLesson(candidate.lessonId);
    if (!lesson) continue;
    const alreadyCompleted = completedLessonIds.includes(lesson.id);
    const accessDecision = decideLessonAccess({ lessonId: lesson.id, userId: user.id, completedLessonIds, openedLessonIds, premium, groupPremium });
    if (!accessDecision.allowed) continue;
    if (candidate.attempts.length > Math.max(200, 25 * lesson.steps.length)) continue;
    let score;
    try { score = calculateProgress(lesson, candidate.attempts as ProgressAttempt[]); } catch { continue; }
    const now = new Date();
    const end = now.toISOString();
    const bounds = getIstDayUtcBounds(now);
    const [profile, prior, progress, earlierCompletions] = await Promise.all([
      admin.from("profiles").select("group_id,cohort").eq("user_id", user.id).maybeSingle(),
      admin.from("streaks").select("current,longest,last_active_date").eq("user_id", user.id).maybeSingle(),
      admin.from("lesson_progress").select("times_completed").eq("user_id", user.id).eq("lesson_id", lesson.id).maybeSingle(),
      admin.from("lesson_completions").select("completed_at,points").eq("user_id", user.id).eq("lesson_id", lesson.id).gt("points", 0).gte("completed_at", bounds.start).lt("completed_at", bounds.end),
    ]);
    if (profile.error || prior.error || progress.error || earlierCompletions.error) continue;
    let points = pointsAllowedForCompletion(earlierCompletions.data ?? [], now) ? score.points : 0;
    const completionData = { user_id: user.id, lesson_id: lesson.id, completed_at: end, ist_day: getIstDate(now), first_try_accuracy: score.firstTryAccuracy, points, group_id: profile.data?.group_id ?? null, cohort: profile.data?.cohort ?? null };
    let completionWrite = await admin.from("lesson_completions").insert(completionData);
    if (completionWrite.error && shouldRetryCompletionWithZeroPoints(completionWrite.error)) {
      points = 0;
      completionWrite = await admin.from("lesson_completions").insert({ ...completionData, points: 0 });
    }
    if (completionWrite.error) { partialFailure = true; continue; }
    if (!completedLessonIds.includes(lesson.id) && !openedLessonIds.includes(lesson.id)) completedLessonIds.push(lesson.id);
    const progressWrite = await admin.from("lesson_progress").upsert({ user_id: user.id, lesson_id: lesson.id, completed_at: end, first_try_accuracy: score.firstTryAccuracy, times_completed: (progress.data?.times_completed ?? 0) + 1 });
    if (progressWrite.error) { partialFailure = true; continue; }
    const attemptRows = progressAttemptRows(user.id, lesson.id, candidate.attempts as ProgressAttempt[], lesson, now);
    if (attemptRows.length && (await admin.from("step_attempts").insert(attemptRows)).error) { partialFailure = true; continue; }
    if (points > 0 && (await admin.from("points_log").insert({ user_id: user.id, points, reason: `lesson:${lesson.id}`, created_at: end })).error) { partialFailure = true; continue; }
    if ((await admin.from("streaks").upsert({ user_id: user.id, ...getStreak((prior.data as StreakRow | null) ?? null, now) })).error) { partialFailure = true; continue; }
    merged++;
  }
  if (partialFailure) return NextResponse.json({ error: "partial_progress_save", partial: true, merged }, { status: 500 });
  return NextResponse.json({ merged });
}
