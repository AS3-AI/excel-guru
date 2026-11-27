import { NextResponse } from "next/server";
import { isEntitled, providerFor, validateCheckoutInput } from "@excel-guru/payments";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { paymentsEnabled } from "../../../lib/payments-config";
import { rateLimit } from "../../../lib/rate-limit";

export async function GET() {
  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ premium: false }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "status_unavailable" }, { status: 503 });
  const [{ data: profile }, { data: subscriptions }] = await Promise.all([
    admin
      .from("profiles")
      .select("is_premium,group_id,invited")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("subscriptions").select("status,period_end").eq("user_id", user.id),
  ]);
  const active = (subscriptions ?? []).find(
    (row) =>
      row.status === "active" && (!row.period_end || Date.parse(row.period_end) > Date.now()),
  );
  let groupPremium = false;
  if (profile?.group_id) {
    const { data: group } = await admin
      .from("groups")
      .select("has_paid_access")
      .eq("id", profile.group_id)
      .maybeSingle();
    groupPremium = group?.has_paid_access === true;
  }
  return NextResponse.json({
    premium: profile?.is_premium === true,
    canCancel: !!active,
    endsAt: active?.period_end ?? null,
    groupPremium,
    invited: profile?.invited === true,
  });
}

export async function POST(request: Request) {
  if (!paymentsEnabled(process.env.PAYMENTS_ENABLED))
    return NextResponse.json({ error: "payments_disabled" }, { status: 503 });
  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "checkout_unavailable" }, { status: 503 });
  if (!(await rateLimit(admin, `checkout:${user.id}`, 10, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { plan, currency } = body as { plan?: unknown; currency?: unknown };
  const validationError = validateCheckoutInput(plan, currency);
  if (validationError)
    return NextResponse.json(
      { error: validationError },
      { status: validationError === "region_unavailable" ? 409 : 400 },
    );
  const validPlan = plan as "monthly" | "annual";
  const [
    { data: profile, error: profileError },
    { data: subscriptions, error: subscriptionError },
  ] = await Promise.all([
    admin.from("profiles").select("email,group_id,invited").eq("user_id", user.id).maybeSingle(),
    admin.from("subscriptions").select("status,period_end").eq("user_id", user.id),
  ]);
  if (profileError || subscriptionError)
    return NextResponse.json({ error: "checkout_unavailable" }, { status: 503 });
  let groupPremium = false;
  if (profile?.group_id) {
    const { data: group, error } = await admin
      .from("groups")
      .select("has_paid_access")
      .eq("id", profile.group_id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "checkout_unavailable" }, { status: 503 });
    groupPremium = group?.has_paid_access === true;
  }
  if (profile?.invited === true) return NextResponse.json({ error: "invited" }, { status: 409 }); // invited learners never pay
  if (isEntitled(subscriptions ?? [], Date.now(), groupPremium))
    return NextResponse.json({ error: "already_premium" }, { status: 409 });
  try {
    const result = await providerFor("INR").createCheckout({
      userId: user.id,
      email: profile?.email ?? user.email ?? "",
      plan: validPlan,
    });
    return NextResponse.json({ provider: "razorpay", payload: result.payload });
  } catch (error) {
    console.error("checkout:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "checkout_unavailable" }, { status: 503 });
  }
}
