import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Progress unavailable" }, { status: 503 });
  const { error } = await admin.from("lesson_progress").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not reset progress" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
