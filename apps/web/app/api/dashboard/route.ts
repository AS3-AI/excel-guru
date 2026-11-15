import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLesson, getOrder } from "@/lib/lessons";
import { getIstDate, getStatusTag } from "@/lib/progress";

export async function GET() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Dashboard unavailable" }, { status: 503 });
  const [progressRes, pointsRes, streakRes] = await Promise.all([
    admin.from("lesson_progress").select("lesson_id,completed_at,first_try_accuracy").eq("user_id", user.id),
    admin.from("points_log").select("points").eq("user_id", user.id).gte("created_at", `${getIstDate(new Date())}T00:00:00+05:30`),
    admin.from("streaks").select("current").eq("user_id", user.id).maybeSingle(),
  ]);
  if (progressRes.error || pointsRes.error || streakRes.error) return NextResponse.json({ error: "Dashboard unavailable" }, { status: 500 });
  const rows = new Map((progressRes.data ?? []).map((row) => [row.lesson_id, row]));
  const lessonIds = getOrder();
  const modules = new Map<string, { id: string; done: number; total: number; tag: "low" | "practice" | "good" }>();
  for (const id of lessonIds) {
    const lesson = getLesson(id);
    if (!lesson) continue;
    const module = modules.get(lesson.module) ?? { id: lesson.module, done: 0, total: 0, tag: "good" as const };
    module.total++;
    const row = rows.get(id);
    if (row) {
      module.done++;
      const tag = getStatusTag(row.first_try_accuracy ?? 0, new Date(row.completed_at), new Date());
      if (tag === "low" || (tag === "practice" && module.tag === "good")) module.tag = tag;
    }
    modules.set(lesson.module, module);
  }
  const nextLessonId = lessonIds.find((id) => !rows.has(id)) ?? null;
  return NextResponse.json({ modules: [...modules.values()], nextLessonId, points: (pointsRes.data ?? []).reduce((sum, row) => sum + row.points, 0), streak: streakRes.data?.current ?? 0, dailyTrend: [] });
}
