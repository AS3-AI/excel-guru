import { createHmac, timingSafeEqual } from "node:crypto";

export type Plan = "monthly" | "annual" | "lifetime";
export type EntitlementEvent = {
  eventId: string; userId: string; provider: "razorpay" | "stripe"; providerRef: string;
  plan: Plan; status: "active" | "cancelled" | "past_due"; periodEnd: Date | null;
};
export interface PaymentProvider {
  createCheckout(i: { userId: string; email: string; plan: Plan }): Promise<{ payload: unknown }>;
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  toEntitlementEvent(rawBody: string): EntitlementEvent | null;
}

export function providerFor(currency: "INR" | "USD"): PaymentProvider {
  return currency === "INR" ? razorpayProvider : stripeProvider;
}

export function validateCheckoutInput(plan: unknown, currency: unknown): "invalid_plan" | "region_unavailable" | "invalid_currency" | null {
  if (plan !== "monthly" && plan !== "annual") return "invalid_plan";
  if (currency === "USD") return "region_unavailable";
  if (currency !== "INR") return "invalid_currency";
  return null;
}

export function verifyRazorpaySignature(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
    const supplied = Buffer.from(signature, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  } catch { return false; }
}

type RazorpaySubscription = { id?: string; status?: string; current_end?: number; created_at?: number; notes?: { userId?: string; plan?: string } };
type RazorpayBody = { id?: string; event?: string; created_at?: number; payload?: { subscription?: { entity?: RazorpaySubscription } } };

export function mapRazorpayEvent(rawBody: string): EntitlementEvent | null {
  let body: RazorpayBody;
  try { body = JSON.parse(rawBody) as RazorpayBody; } catch { return null; }
  const name = body.event;
  const subscription = body.payload?.subscription?.entity;
  if (!subscription?.id || !subscription.notes?.userId || (subscription.notes.plan !== "monthly" && subscription.notes.plan !== "annual")) return null;
  if (typeof body.created_at !== "number" || !Number.isFinite(body.created_at)) return null;
  let status: EntitlementEvent["status"];
  if (name === "subscription.activated" || name === "subscription.charged") status = "active";
  else if (name === "subscription.cancelled" || name === "subscription.completed") status = "cancelled";
  else if (name === "subscription.halted") status = "past_due";
  else return null;
  return {
    eventId: body.id || `${name}:${subscription.id}:${body.created_at}`, userId: subscription.notes.userId, provider: "razorpay", providerRef: subscription.id,
    plan: subscription.notes.plan, status,
    periodEnd: subscription.current_end ? new Date(subscription.current_end * 1000) : null,
  };
}

export function razorpayEventTime(rawBody: string): Date | null {
  try {
    const body = JSON.parse(rawBody) as RazorpayBody;
    if (typeof body.created_at !== "number" || !Number.isFinite(body.created_at)) return null;
    const date = new Date(body.created_at * 1000);
    return Number.isFinite(date.getTime()) ? date : null;
  } catch { return null; }
}

export function shouldApplyEntitlement(current: { period_end?: string | null; updated_at?: string | null; status?: string | null } | null, incoming: EntitlementEvent, eventCreatedAt: Date | null = null): boolean {
  if (!current) return true;
  const currentUpdated = current.updated_at ? Date.parse(current.updated_at) : 0;
  if (eventCreatedAt && currentUpdated && eventCreatedAt.getTime() < currentUpdated) return false;
  if (eventCreatedAt && currentUpdated && eventCreatedAt.getTime() === currentUpdated) {
    const rank = { active: 0, past_due: 1, cancelled: 2 } as const;
    const currentStatus = current.status as keyof typeof rank;
    return currentStatus in rank && rank[incoming.status] >= rank[currentStatus];
  }
  return true;
}

export function isDuplicateWebhook(error: { code?: string } | null): boolean { return error?.code === "23505"; }

export function isEntitled(rows: readonly { status: string; period_end: string | null }[], now = Date.now(), groupPremium = false): boolean {
  return groupPremium || rows.some((row) => row.status === "active" && (!row.period_end || Date.parse(row.period_end) > now));
}

const razorpayProvider: PaymentProvider = {
  async createCheckout(input) {
    if (input.plan === "lifetime") throw new Error("invalid_plan");
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const planId = process.env[input.plan === "monthly" ? "RAZORPAY_PLAN_MONTHLY" : "RAZORPAY_PLAN_ANNUAL"];
    if (!keyId || !keySecret || !planId) throw new Error("payment_unavailable");
    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, customer_notify: 1, quantity: 1, notes: { userId: input.userId, plan: input.plan } }),
    });
    if (!response.ok) throw new Error("checkout_failed");
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("checkout_failed");
    return { payload: { key_id: keyId, subscription_id: result.id, prefill: { email: input.email } } };
  },
  verifyWebhook(raw, headers) { return verifyRazorpaySignature(raw, headers.get("x-razorpay-signature"), process.env.RAZORPAY_WEBHOOK_SECRET); },
  toEntitlementEvent(raw) { return mapRazorpayEvent(raw); },
};

const stripeProvider: PaymentProvider = {
  async createCheckout() { throw new Error("stripe_unavailable"); },
  verifyWebhook() { return false; },
  toEntitlementEvent() { return null; },
};
