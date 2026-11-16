import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLesson } from "@/lib/lessons";
import { decideLessonAccess, loadLessonAccess } from "@/lib/access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getLesson(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json(decideLessonAccess({ lessonId: id, userId: null, completedLessonIds: [] }));
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Access unavailable" }, { status: 503 });
  try {
    const { decision } = await loadLessonAccess(admin, user.id, id);
    return NextResponse.json(decision);
  } catch {
    return NextResponse.json({ error: "Access unavailable" }, { status: 500 });
  }
}
