import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await createClient();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (!(await rateLimit(admin, `explain/rate:${user.id}`, 30, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || typeof (body as { helpful?: unknown }).helpful !== "boolean") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data, error } = await admin.rpc("rate_explanation", {
    p_explanation_id: id,
    p_user_id: user.id,
    p_helpful: (body as { helpful: boolean }).helpful,
  });
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (data === null) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
