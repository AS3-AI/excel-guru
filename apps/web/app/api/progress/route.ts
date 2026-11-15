import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLesson } from "@/lib/lessons";
import { loadLessonAccess } from "@/lib/access";
import { calculateProgress, getIstDate, getIstDayUtcBounds, getStreak, pointsAllowedForCompletion, progressAttemptRows, readBodyAfterAuthentication, shouldRetryCompletionWithZeroPoints, type ProgressAttempt, type StreakRow } from "@/lib/progress";

export async function POST(request: Request) {
  const session = await createClient();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    const parsed = await readBodyAfterAuthentication(user, () => request.json());
    if (!parsed.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    body = parsed.body;
  } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || typeof (body as { lessonId?: unknown }).lessonId !== "string" || !Array.isArray((body as { attempts?: unknown }).attempts)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { lessonId, attempts } = body as { lessonId: string; attempts: ProgressAttempt[] };
  const lesson = getLesson(lessonId);
  if (!lesson) return NextResponse.json({ error: "Unknown lesson" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Progress unavailable" }, { status: 503 });
  try {
    const { decision } = await loadLessonAccess(admin, user.id, lessonId);
    if (!decision.allowed) return NextResponse.json({ error: "paywall" }, { status: 403 });
  } catch { return NextResponse.json({ error: "Progress unavailable" }, { status: 500 }); }
  let score;
  try { score = calculateProgress(lesson, attempts); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid attempts" }, { status: 400 }); }
  const now = new Date();
  const endedAt = now.toISOString();
  const profileResult = await admin.from("profiles").select("group_id,cohort").eq("user_id", user.id).maybeSingle();
  if (profileResult.error) return NextResponse.json({ error: "Progress unavailable" }, { status: 500 });
  const prevProgress = await admin.from("lesson_progress").select("times_completed").eq("user_id", user.id).eq("lesson_id", lessonId).maybeSingle();
  if (prevProgress.error) return NextResponse.json({ error: "Progress unavailable" }, { status: 500 });
  const priorStreak = await admin.from("streaks").select("current,longest,last_active_date").eq("user_id", user.id).maybeSingle();
  if (priorStreak.error) return NextResponse.json({ error: "Progress unavailable" }, { status: 500 });
  const bounds = getIstDayUtcBounds(now);
  const earlierCompletions = await admin.from("lesson_completions").select("completed_at,points").eq("user_id", user.id).eq("lesson_id", lessonId).gt("points", 0).gte("completed_at", bounds.start).lt("completed_at", bounds.end);
  if (earlierCompletions.error) return NextResponse.json({ error: "Progress unavailable" }, { status: 500 });
  const inserts = progressAttemptRows(user.id, lessonId, attempts, lesson, now);
  let points = pointsAllowedForCompletion(earlierCompletions.data ?? [], now) ? score.points : 0;
  const partialFailure = () => NextResponse.json({ error: "partial_progress_save", partial: true }, { status: 500 });
  const completionData = { user_id: user.id, lesson_id: lessonId, completed_at: endedAt, ist_day: getIstDate(now), first_try_accuracy: score.firstTryAccuracy, points, group_id: profileResult.data?.group_id ?? null, cohort: profileResult.data?.cohort ?? null };
  let completionWrite = await admin.from("lesson_completions").insert(completionData);
  if (completionWrite.error && shouldRetryCompletionWithZeroPoints(completionWrite.error)) {
    points = 0;
    completionWrite = await admin.from("lesson_completions").insert({ ...completionData, points: 0 });
  }
  if (completionWrite.error) return partialFailure();
  const progressWrite = await admin.from("lesson_progress").upsert({ user_id: user.id, lesson_id: lessonId, completed_at: endedAt, first_try_accuracy: score.firstTryAccuracy, times_completed: (prevProgress.data?.times_completed ?? 0) + 1 });
  if (progressWrite.error) return partialFailure();
  if (inserts.length) {
    const attemptsWrite = await admin.from("step_attempts").insert(inserts);
    if (attemptsWrite.error) return partialFailure();
  }
  if (points > 0) {
    const pointsWrite = await admin.from("points_log").insert({ user_id: user.id, points, reason: `lesson:${lessonId}`, created_at: endedAt });
    if (pointsWrite.error) return partialFailure();
  }
  const streakWrite = await admin.from("streaks").upsert({ user_id: user.id, ...getStreak((priorStreak.data as StreakRow | null) ?? null, now) });
  if (streakWrite.error) return partialFailure();
  return NextResponse.json({ points, streak: getStreak((priorStreak.data as StreakRow | null) ?? null, now).current, firstTryAccuracy: score.firstTryAccuracy, nextLessonId: score.nextLessonId });
}
