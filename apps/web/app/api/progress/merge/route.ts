import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { getLesson } from "@/lib/lessons";
import { decideLessonAccess, loadLessonAccess } from "@/lib/access";
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
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
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
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !Array.isArray((body as { lessons?: unknown }).lessons))
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const lessonsInput = (body as { lessons: unknown[] }).lessons;
  if (lessonsInput.length > 100)
    return NextResponse.json({ error: "Too many lessons" }, { status: 400 });
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
  } catch {
    return NextResponse.json({ error: "Progress unavailable" }, { status: 500 });
  }
  const profileRes = await admin
    .from("profiles")
    .select("group_id,cohort")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileRes.error)
    return NextResponse.json({ error: "Progress unavailable" }, { status: 500 });
  const now = new Date();
  const end = now.toISOString();
  const bounds = getIstDayUtcBounds(now);
  const istDay = getIstDate(now);
  let merged = 0;
  let partialFailure = false;
  for (const item of lessonsInput) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { lessonId?: unknown; attempts?: unknown };
    if (typeof candidate.lessonId !== "string" || !Array.isArray(candidate.attempts)) continue;
    const lesson = getLesson(candidate.lessonId);
    if (!lesson) continue;
    const accessDecision = decideLessonAccess({
      lessonId: lesson.id,
      userId: user.id,
      completedLessonIds,
      openedLessonIds,
      premium,
      groupPremium,
    });
    if (!accessDecision.allowed) continue;
    if (candidate.attempts.length > Math.max(200, 25 * lesson.steps.length)) continue;
    let score;
    try {
      score = calculateProgress(lesson, candidate.attempts as ProgressAttempt[]);
    } catch {
      continue;
    }
    const [prior, earlierCompletions] = await Promise.all([
      admin
        .from("streaks")
        .select("current,longest,last_active_date")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("lesson_completions")
        .select("completed_at,points")
        .eq("user_id", user.id)
        .eq("lesson_id", lesson.id)
        .gt("points", 0)
        .gte("completed_at", bounds.start)
        .lt("completed_at", bounds.end),
    ]);
    if (prior.error || earlierCompletions.error) continue;
    const requestedPoints = pointsAllowedForCompletion(earlierCompletions.data ?? [], now)
      ? score.points
      : 0;
    const nextStreak = getStreak((prior.data as StreakRow | null) ?? null, now);
    const attemptRows = progressAttemptRows(
      user.id,
      lesson.id,
      candidate.attempts as ProgressAttempt[],
      lesson,
      now,
    );
    const { error: rpcError } = await admin.rpc("save_lesson_progress", {
      p_user_id: user.id,
      p_lesson_id: lesson.id,
      p_completed_at: end,
      p_ist_day: istDay,
      p_first_try_accuracy: score.firstTryAccuracy,
      p_points: requestedPoints,
      p_group_id: profileRes.data?.group_id ?? null,
      p_cohort: profileRes.data?.cohort ?? null,
      p_streak_current: nextStreak.current,
      p_streak_longest: nextStreak.longest,
      p_attempts: attemptRows,
    });
    if (rpcError) {
      partialFailure = true;
      continue;
    }
    if (!completedLessonIds.includes(lesson.id) && !openedLessonIds.includes(lesson.id))
      completedLessonIds.push(lesson.id);
    merged++;
  }
  if (partialFailure)
    return NextResponse.json(
      { error: "partial_progress_save", partial: true, merged },
      { status: 500 },
    );
  return NextResponse.json({ merged });
}
