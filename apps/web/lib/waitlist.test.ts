import { describe, expect, it } from "vitest";
import { parseWaitlistBody } from "./waitlist";
import { currencyForCountry, formatPrice, PLANS } from "./plans";

describe("parseWaitlistBody", () => {
  it("accepts a valid email and normalizes it", () => {
    expect(parseWaitlistBody({ email: "  Ana@Example.COM ", source: "hero" })).toEqual({
      ok: true,
      value: { email: "ana@example.com", source: "hero" },
    });
  });

  it("defaults source to landing", () => {
    const r = parseWaitlistBody({ email: "a@b.co" });
    expect(r.ok && r.value.source).toBe("landing");
  });

  it.each([
    ["missing email", {}],
    ["non-string email", { email: 42 }],
    ["no @", { email: "nope.example.com" }],
    ["no domain dot", { email: "a@b" }],
    ["spaces", { email: "a b@c.com" }],
    ["too long", { email: `${"a".repeat(250)}@b.com` }],
    ["null body", null],
    ["string body", "a@b.com"],
  ])("rejects %s", (_label, body) => {
    expect(parseWaitlistBody(body).ok).toBe(false);
  });

  it("truncates long sources", () => {
    const r = parseWaitlistBody({ email: "a@b.co", source: "x".repeat(200) });
    expect(r.ok && r.value.source.length).toBe(64);
  });
});

describe("plans", () => {
  it("uses INR for India and USD elsewhere", () => {
    expect(currencyForCountry("IN")).toBe("INR");
    expect(currencyForCountry("in")).toBe("INR");
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry(null)).toBe("USD");
  });

  it("formats prices", () => {
    expect(formatPrice("INR", PLANS.INR.annual)).toBe("₹1,499");
    expect(formatPrice("USD", PLANS.USD.monthly)).toBe("$20");
  });
});
