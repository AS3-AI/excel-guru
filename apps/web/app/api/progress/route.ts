import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { getLesson } from "@/lib/lessons";
import { loadLessonAccess } from "@/lib/access";
import {
  calculateProgress,
  getIstDate,
  getIstDayUtcBounds,
  getStreak,
  pointsAllowedForCompletion,
  progressAttemptRows,
  readBodyAfterAuthentication,
  type ProgressAttempt,
  type StreakRow,
} from "@/lib/progress";

export async function POST(request: Request) {
  const session = await createClient();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Progress unavailable" }, { status: 503 });
  if (!(await rateLimit(admin, `progress:${user.id}`, 60, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: unknown;
  try {
    const parsed = await readBodyAfterAuthentication(user, () => request.json());
    if (!parsed.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    body = parsed.body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { lessonId?: unknown }).lessonId !== "string" ||
    !Array.isArray((body as { attempts?: unknown }).attempts)
  )
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { lessonId, attempts } = body as { lessonId: string; attempts: ProgressAttempt[] };
  const lesson = getLesson(lessonId);
  if (!lesson) return NextResponse.json({ error: "Unknown lesson" }, { status: 400 });
  try {
    const { decision } = await loadLessonAccess(admin, user.id, lessonId);
    if (!decision.allowed) return NextResponse.json({ error: "paywall" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Progress unavailable" }, { status: 500 });
  }
  let score;
  try {
    score = calculateProgress(lesson, attempts);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid attempts" },
      { status: 400 },
    );
  }
  const now = new Date();
  const endedAt = now.toISOString();
  const istDay = getIstDate(now);
  const bounds = getIstDayUtcBounds(now);
  const [profileResult, priorStreak, earlierCompletions] = await Promise.all([
    admin.from("profiles").select("group_id,cohort").eq("user_id", user.id).maybeSingle(),
    admin
      .from("streaks")
      .select("current,longest,last_active_date")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("lesson_completions")
      .select("completed_at,points")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .gt("points", 0)
      .gte("completed_at", bounds.start)
      .lt("completed_at", bounds.end),
  ]);
  if (profileResult.error || priorStreak.error || earlierCompletions.error) {
    return NextResponse.json({ error: "Progress unavailable" }, { status: 500 });
  }
  const inserts = progressAttemptRows(user.id, lessonId, attempts, lesson, now);
  const requestedPoints = pointsAllowedForCompletion(earlierCompletions.data ?? [], now)
    ? score.points
    : 0;
  const nextStreak = getStreak((priorStreak.data as StreakRow | null) ?? null, now);
  const { data: awardedPoints, error: rpcError } = await admin.rpc("save_lesson_progress", {
    p_user_id: user.id,
    p_lesson_id: lessonId,
    p_completed_at: endedAt,
    p_ist_day: istDay,
    p_first_try_accuracy: score.firstTryAccuracy,
    p_points: requestedPoints,
    p_group_id: profileResult.data?.group_id ?? null,
    p_cohort: profileResult.data?.cohort ?? null,
    p_streak_current: nextStreak.current,
    p_streak_longest: nextStreak.longest,
    p_attempts: inserts,
  });
  if (rpcError) {
    return NextResponse.json({ error: "Progress unavailable" }, { status: 500 });
  }
  const points = typeof awardedPoints === "number" ? awardedPoints : requestedPoints;
  return NextResponse.json({
    points,
    streak: nextStreak.current,
    firstTryAccuracy: score.firstTryAccuracy,
    nextLessonId: score.nextLessonId,
  });
}
