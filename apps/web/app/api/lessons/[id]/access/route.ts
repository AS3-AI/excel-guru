import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLesson } from "@/lib/lessons";
import { decideLessonAccess } from "@/lib/access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getLesson(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json(decideLessonAccess({ lessonId: id, userId: null, completedLessonIds: [] }));
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Access unavailable" }, { status: 503 });
  const [progress, subscriptions, profile] = await Promise.all([
    admin.from("lesson_progress").select("lesson_id").eq("user_id", user.id),
    admin.from("subscriptions").select("status,period_end").eq("user_id", user.id).eq("status", "active"),
    admin.from("profiles").select("group_id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (progress.error || subscriptions.error || profile.error) return NextResponse.json({ error: "Access unavailable" }, { status: 500 });
  const now = Date.now();
  const premium = (subscriptions.data ?? []).some((row) => !row.period_end || new Date(row.period_end).getTime() > now);
  let groupPremium = false;
  if (profile.data?.group_id) {
    const { data, error } = await admin.from("groups").select("has_paid_access").eq("id", profile.data.group_id).maybeSingle();
    if (error) return NextResponse.json({ error: "Access unavailable" }, { status: 500 });
    groupPremium = data?.has_paid_access === true;
  }
  return NextResponse.json(decideLessonAccess({ lessonId: id, userId: user.id, completedLessonIds: (progress.data ?? []).map((row) => row.lesson_id), premium, groupPremium }));
}
