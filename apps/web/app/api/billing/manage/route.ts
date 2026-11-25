import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paymentsEnabled } from "@/lib/payments-config";
import { rateLimit } from "@/lib/rate-limit";

export async function POST() {
  if (!paymentsEnabled(process.env.PAYMENTS_ENABLED))
    return NextResponse.json({ error: "payments_disabled" }, { status: 503 });
  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  if (!(await rateLimit(admin, `billing/manage:${user.id}`, 5, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("provider_ref,period_end")
    .eq("user_id", user.id)
    .eq("provider", "razorpay")
    .eq("status", "active");
  if (error) return NextResponse.json({ error: "billing_unavailable" }, { status: 500 });
  const subscription = rows?.find(
    (row) => !row.period_end || Date.parse(row.period_end) > Date.now(),
  );
  const subscriptionId = subscription?.provider_ref;
  if (!subscriptionId)
    return NextResponse.json({ error: "active_subscription_required" }, { status: 400 });
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret)
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  try {
    const response = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return NextResponse.json({ error: "billing_unavailable" }, { status: 502 });
    const result = (await response.json().catch(() => ({}))) as {
      current_end?: number;
      end_at?: number;
    };
    const end = result.current_end ?? result.end_at;
    return NextResponse.json({
      ok: true,
      endsAt: end ? new Date(end * 1000).toISOString() : (subscription?.period_end ?? null),
    });
  } catch {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 502 });
  }
}
