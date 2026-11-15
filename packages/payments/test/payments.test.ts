import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isDuplicateWebhook, isEntitled, mapRazorpayEvent, providerFor, razorpayEventTime, shouldApplyEntitlement, validateCheckoutInput, verifyRazorpaySignature } from "../src/index";

const makeBody = (event: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id: "evt_1", event, created_at: 1_700_000_000, payload: { subscription: { entity: { id: "sub_1", current_end: 1_800_000_000, created_at: 1_700_000_000, notes: { userId: "user_1", plan: "annual" }, ...extra } } } });
const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("hex");

describe("Razorpay signature verification", () => {
  it("accepts a valid signature", () => { const body = "{}"; expect(verifyRazorpaySignature(body, sign(body, "secret"), "secret")).toBe(true); });
  it("rejects a tampered body", () => { const body = "{}"; expect(verifyRazorpaySignature("{ }", sign(body, "secret"), "secret")).toBe(false); });
  it("rejects a wrong secret", () => { const body = "{}"; expect(verifyRazorpaySignature(body, sign(body, "wrong"), "secret")).toBe(false); });
  it("rejects a missing header", () => { expect(verifyRazorpaySignature("{}", null, "secret")).toBe(false); });
  it("rejects a missing secret", () => { expect(verifyRazorpaySignature("{}", "abcd", undefined)).toBe(false); });
  it("rejects malformed hex", () => { expect(verifyRazorpaySignature("{}", "nope", "secret")).toBe(false); });
});

describe("Razorpay event mapping", () => {
  it.each(["subscription.activated", "subscription.charged"])("maps %s to active", (event) => { expect(mapRazorpayEvent(makeBody(event))?.status).toBe("active"); });
  it.each(["subscription.cancelled", "subscription.completed"])("maps %s to cancelled", (event) => { expect(mapRazorpayEvent(makeBody(event))?.status).toBe("cancelled"); });
  it("maps halted to past_due", () => { expect(mapRazorpayEvent(makeBody("subscription.halted"))?.status).toBe("past_due"); });
  it("ignores unsupported events", () => { expect(mapRazorpayEvent(makeBody("invoice.paid"))).toBeNull(); });
  it("ignores malformed JSON", () => { expect(mapRazorpayEvent("{" )).toBeNull(); });
  it("requires a subscription reference", () => { expect(mapRazorpayEvent(makeBody("subscription.activated", { id: undefined }))).toBeNull(); });
  it("requires the notes user id", () => { const raw = makeBody("subscription.activated").replace('"userId":"user_1",', ""); expect(mapRazorpayEvent(raw)).toBeNull(); });
  it("requires a sellable plan", () => { const raw = makeBody("subscription.activated").replace('"annual"', '"lifetime"'); expect(mapRazorpayEvent(raw)).toBeNull(); });
  it("maps the provider ref", () => { expect(mapRazorpayEvent(makeBody("subscription.activated"))?.providerRef).toBe("sub_1"); });
  it("maps user id", () => { expect(mapRazorpayEvent(makeBody("subscription.activated"))?.userId).toBe("user_1"); });
  it("maps plan", () => { expect(mapRazorpayEvent(makeBody("subscription.activated"))?.plan).toBe("annual"); });
  it("maps the event id from the signed body", () => { expect(mapRazorpayEvent(makeBody("subscription.activated"))?.eventId).toBe("evt_1"); });
  it("derives a stable id when the signed body has no event id", () => { const raw = makeBody("subscription.activated").replace('"id":"evt_1",', ""); expect(mapRazorpayEvent(raw)?.eventId).toBe("subscription.activated:sub_1:1700000000"); });
  it("keeps the entitlement event shape free of provider timestamps", () => { expect(mapRazorpayEvent(makeBody("subscription.activated"))).not.toHaveProperty("eventCreatedAt"); });
  it("extracts the provider event timestamp separately", () => { expect(razorpayEventTime(makeBody("subscription.activated"))?.toISOString()).toBe("2023-11-14T22:13:20.000Z"); });
  it("returns null for missing or invalid provider timestamps", () => { expect(razorpayEventTime("{}")).toBeNull(); expect(razorpayEventTime('{"created_at":"bad"}')).toBeNull(); });
  it("maps current end", () => { expect(mapRazorpayEvent(makeBody("subscription.activated"))?.periodEnd?.getTime()).toBe(1_800_000_000_000); });
  it("uses null period end if absent", () => { expect(mapRazorpayEvent(makeBody("subscription.activated", { current_end: undefined }))?.periodEnd).toBeNull(); });
  it("derives event id when the body has no event id", () => { const raw = makeBody("subscription.activated").replace('"id":"evt_1",', ""); expect(mapRazorpayEvent(raw)?.eventId).toBe("subscription.activated:sub_1:1700000000"); });
});

describe("payment decision helpers", () => {
  it("accepts monthly INR checkout", () => { expect(validateCheckoutInput("monthly", "INR")).toBeNull(); });
  it("accepts annual INR checkout", () => { expect(validateCheckoutInput("annual", "INR")).toBeNull(); });
  it("rejects lifetime checkout", () => { expect(validateCheckoutInput("lifetime", "INR")).toBe("invalid_plan"); });
  it("rejects unknown plan", () => { expect(validateCheckoutInput("weekly", "INR")).toBe("invalid_plan"); });
  it("returns region unavailable for USD", () => { expect(validateCheckoutInput("monthly", "USD")).toBe("region_unavailable"); });
  it("rejects unknown currency", () => { expect(validateCheckoutInput("monthly", "EUR")).toBe("invalid_currency"); });
  it("recognizes duplicate database events", () => { expect(isDuplicateWebhook({ code: "23505" })).toBe(true); });
  it("does not classify other database errors as duplicates", () => { expect(isDuplicateWebhook({ code: "500" })).toBe(false); });
  it("allows first entitlement", () => { expect(shouldApplyEntitlement(null, mapRazorpayEvent(makeBody("subscription.activated"))!)).toBe(true); });
  it("rejects older event timestamp", () => { expect(shouldApplyEntitlement({ updated_at: "2025-01-01T00:00:00Z" }, mapRazorpayEvent(makeBody("subscription.activated"))!, new Date("2024-01-01T00:00:00Z"))).toBe(false); });
  it("allows active event after active at the same second", () => { const a = makeBody("subscription.activated"); const b = makeBody("subscription.charged"); expect(shouldApplyEntitlement({ updated_at: razorpayEventTime(a)!.toISOString(), status: "active" }, mapRazorpayEvent(b)!, razorpayEventTime(b))).toBe(true); });
  it("ignores stale activated after cancelled", () => { const oldBody = makeBody("subscription.activated"); const newerBody = makeBody("subscription.cancelled").replace("1700000000", "1700000001"); expect(shouldApplyEntitlement({ updated_at: razorpayEventTime(newerBody)!.toISOString(), status: "cancelled" }, mapRazorpayEvent(oldBody)!, razorpayEventTime(oldBody))).toBe(false); });
  it("applies newer cancelled after late-processed charged", () => { const chargedBody = makeBody("subscription.charged"); const cancelledBody = makeBody("subscription.cancelled").replace("1700000000", "1700000001"); expect(shouldApplyEntitlement({ updated_at: razorpayEventTime(chargedBody)!.toISOString(), status: "active" }, mapRazorpayEvent(cancelledBody)!, razorpayEventTime(cancelledBody))).toBe(true); });
  it("uses cancellation precedence only for equal timestamps", () => { const cancelledBody = makeBody("subscription.cancelled"); const activeBody = makeBody("subscription.activated"); expect(shouldApplyEntitlement({ updated_at: razorpayEventTime(cancelledBody)!.toISOString(), status: "cancelled" }, mapRazorpayEvent(activeBody)!, razorpayEventTime(activeBody))).toBe(false); });
  it("detects active non-expiring subscription", () => { expect(isEntitled([{ status: "active", period_end: null }])).toBe(true); });
  it("detects future active subscription", () => { expect(isEntitled([{ status: "active", period_end: "2030-01-01T00:00:00Z" }], Date.parse("2029-01-01T00:00:00Z"))).toBe(true); });
  it("rejects expired subscription", () => { expect(isEntitled([{ status: "active", period_end: "2020-01-01T00:00:00Z" }], Date.now())).toBe(false); });
  it("rejects inactive subscription", () => { expect(isEntitled([{ status: "cancelled", period_end: null }])).toBe(false); });
  it("routes INR to Razorpay", () => { expect(providerFor("INR")).toBe(providerFor("INR")); });
  it("routes USD to unavailable Stripe provider", async () => { await expect(providerFor("USD").createCheckout({ userId: "u", email: "e", plan: "monthly" })).rejects.toThrow("stripe_unavailable"); });
  it("Stripe does not verify", () => { expect(providerFor("USD").verifyWebhook("{}", new Headers())).toBe(false); });
  it("Stripe does not map events", () => { expect(providerFor("USD").toEntitlementEvent("{}")).toBeNull(); });
});
