import { NextResponse } from "next/server";
import { rateScore } from "@/lib/explain";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await createClient();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || typeof (body as { helpful?: unknown }).helpful !== "boolean") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const row = await admin.from("ai_explanations").select("id,score").eq("id", id).maybeSingle();
  if (row.error || !row.data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Known gap pending the owner's schema decision: there is no per-user rating record, so this read-modify-write can race.
  const update = await admin.from("ai_explanations").update({ score: rateScore(row.data.score, (body as { helpful: boolean }).helpful) }).eq("id", id);
  if (update.error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
