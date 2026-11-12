import { createClient } from "@supabase/supabase-js";
import { parseWaitlistBody, UNIQUE_VIOLATION } from "@/lib/waitlist";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseWaitlistBody(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("waitlist: Supabase env vars missing");
    return Response.json({ error: "Waitlist unavailable" }, { status: 503 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const country = req.headers.get("x-vercel-ip-country");
  const { error } = await supabase
    .from("waitlist")
    .insert({ email: parsed.value.email, source: parsed.value.source, country });

  if (error?.code === UNIQUE_VIOLATION) {
    return Response.json({ ok: true, message: "You're already on the list" });
  }
  if (error) {
    console.error("waitlist insert failed", error.code, error.message);
    return Response.json({ error: "Could not join the waitlist" }, { status: 500 });
  }
  return Response.json({ ok: true, message: "You're on the list!" });
}
