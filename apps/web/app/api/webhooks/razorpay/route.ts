import { NextResponse } from "next/server";
import { isDuplicateWebhook, isEntitled, mapRazorpayEvent, razorpayEventTime, shouldApplyEntitlement, verifyRazorpaySignature } from "@excel-guru/payments";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook_unavailable" }, { status: 500 });
  if (!verifyRazorpaySignature(rawBody, request.headers.get("x-razorpay-signature"), secret)) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  const event = mapRazorpayEvent(rawBody);
  if (!event) return NextResponse.json({ received: true });
  const eventTime = razorpayEventTime(rawBody);
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "webhook_unavailable" }, { status: 500 });
  const inserted = await admin.from("webhook_events").insert({ event_id: event.eventId });
  if (isDuplicateWebhook(inserted.error)) return NextResponse.json({ received: true });
  if (inserted.error) return NextResponse.json({ error: "webhook_unavailable" }, { status: 500 });

  const fail = async () => {
    try {
      const { error } = await admin.from("webhook_events").delete().eq("event_id", event.eventId);
      if (error) console.error("Failed to delete Razorpay webhook dedupe row");
    } catch {
      console.error("Failed to delete Razorpay webhook dedupe row");
    }
    return NextResponse.json({ error: "webhook_unavailable" }, { status: 500 });
  };
  try {
    const { data: user, error: userError } = await admin.auth.admin.getUserById(event.userId);
    if (userError) {
      const status = (userError as { status?: number }).status;
      if ([400, 404, 422].includes(status ?? 0)) return NextResponse.json({ received: true });
      return await fail();
    }
    if (!user.user) return NextResponse.json({ received: true });
    const { data: existing, error: existingError } = await admin.from("subscriptions").select("period_end,updated_at,status").eq("provider", "razorpay").eq("provider_ref", event.providerRef).maybeSingle();
    if (existingError) return await fail();
    if (shouldApplyEntitlement(existing, event, eventTime)) {
      const write = await admin.from("subscriptions").upsert({ user_id: event.userId, provider: event.provider, provider_ref: event.providerRef, plan: event.plan, status: event.status, period_end: event.periodEnd?.toISOString() ?? null, updated_at: eventTime?.toISOString() ?? new Date().toISOString() }, { onConflict: "provider,provider_ref" });
      if (write.error) return await fail();
    }
    const { data: subs, error: subsError } = await admin.from("subscriptions").select("status,period_end,plan").eq("user_id", event.userId);
    const { data: profile, error: profileError } = await admin.from("profiles").select("group_id").eq("user_id", event.userId).maybeSingle();
    if (subsError || profileError) return await fail();
    let groupPremium = false;
    if (profile?.group_id) {
      const { data: group, error } = await admin.from("groups").select("has_paid_access").eq("id", profile.group_id).maybeSingle();
      if (error) return await fail();
      groupPremium = group?.has_paid_access === true;
    }
    const activeSub = (subs ?? []).find((s) => s.status === "active" && (!s.period_end || Date.parse(s.period_end) > Date.now()));
    const profileWrite = await admin.from("profiles").update({ is_premium: isEntitled(subs ?? [], Date.now(), groupPremium), plan: activeSub?.plan ?? null }).eq("user_id", event.userId);
    if (profileWrite.error) return await fail();
    return NextResponse.json({ received: true });
  } catch {
    return await fail();
  }
}
