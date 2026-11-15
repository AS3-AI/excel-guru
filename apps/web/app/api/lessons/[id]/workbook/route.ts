import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLesson } from "@/lib/lessons";
import { decideLessonAccess, loadLessonAccess } from "@/lib/access";
import { buildPracticeWorkbook } from "@/lib/workbook";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  let decision = decideLessonAccess({ lessonId: id, userId: user?.id ?? null, completedLessonIds: [] });
  if (user) {
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Access unavailable" }, { status: 503 });
    try {
      decision = (await loadLessonAccess(admin, user.id, id)).decision;
    } catch {
      return NextResponse.json({ error: "Access unavailable" }, { status: 500 });
    }
  }
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.reason === "signup" ? "Sign in required" : "Premium access required" }, { status: decision.reason === "signup" ? 401 : 403 });
  }
  const buffer = await buildPracticeWorkbook(lesson);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${id}-practice.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
