import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { claimShareBonus } from "@/lib/leaderboard";

export async function POST() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Share bonus unavailable" }, { status: 503 });
  if (!(await rateLimit(admin, `share-bonus:${user.id}`, 5, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let result: { status: 401 | 409 | 200 };
  try {
    result = await claimShareBonus(true, {
      getClaimed: async () => {
        const { data, error } = await admin.from("profiles").select("shared_on_linkedin").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        return data?.shared_on_linkedin === true;
      },
      claim: async () => {
        const { data, error } = await admin.from("profiles").update({ shared_on_linkedin: true }).eq("user_id", user.id).eq("shared_on_linkedin", false).select("user_id").maybeSingle();
        if (error) throw error;
        return !!data;
      },
    });
  } catch {
    return NextResponse.json({ error: "Share bonus unavailable" }, { status: 500 });
  }
  if (result.status === 409) return NextResponse.json({ error: "Share bonus already claimed" }, { status: 409 });
  const { error: pointsError } = await admin.from("points_log").insert({ user_id: user.id, points: 500, reason: "share-bonus" });
  if (pointsError) {
    await admin.from("profiles").update({ shared_on_linkedin: false }).eq("user_id", user.id).eq("shared_on_linkedin", true);
    return NextResponse.json({ error: "Share bonus unavailable" }, { status: 500 });
  }
  return NextResponse.json({ points: 500 });
}
