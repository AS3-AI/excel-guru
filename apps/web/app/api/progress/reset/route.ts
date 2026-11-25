import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { rateLimit } from "../../../../lib/rate-limit";

export async function POST() {
  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Progress unavailable" }, { status: 503 });
  if (!(await rateLimit(admin, `progress/reset:${user.id}`, 5, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const [progressDel, completionsDel, attemptsDel] = await Promise.all([
    admin.from("lesson_progress").delete().eq("user_id", user.id),
    admin.from("lesson_completions").delete().eq("user_id", user.id),
    admin.from("step_attempts").delete().eq("user_id", user.id),
  ]);
  if (progressDel.error || completionsDel.error || attemptsDel.error) {
    return NextResponse.json({ error: "Could not reset progress" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
