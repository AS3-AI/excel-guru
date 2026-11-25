import { describe, expect, it } from "vitest";
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from "./legal";

describe("PRIVACY_SECTIONS", () => {
  it("explicitly documents what we collect across Supabase, Razorpay, Gemini, Vercel, and cookies", () => {
    const combined = PRIVACY_SECTIONS.map((s) => `${s.title} ${s.body}`)
      .join(" ")
      .toLowerCase();

    // Supabase: email, name, progress, points
    expect(combined).toContain("supabase");
    expect(combined).toContain("email");
    expect(combined).toContain("name");
    expect(combined).toContain("progress");
    expect(combined).toContain("points");

    // Google sign-in
    expect(combined).toContain("google");

    // Payment provider: Razorpay only (we never see card numbers)
    expect(combined).toContain("razorpay");
    expect(combined).toContain("card numbers");
    expect(combined).toContain("stripe is not live");

    // Gemini AI: formula typed sent, hashed IP for limits
    expect(combined).toContain("gemini");
    expect(combined).toContain("formula");
    expect(combined).toContain("hashed");

    // Vercel hosting logs
    expect(combined).toContain("vercel");
    expect(combined).toContain("logs");

    // Cookies: only the auth session cookie today
    expect(combined).toContain("session cookie");
  });

  it("specifies exactly what is transmitted to Gemini and how hashed IP is handled", () => {
    const geminiSection = PRIVACY_SECTIONS.find((s) => s.id === "gemini-ai");
    expect(geminiSection).toBeDefined();
    const body = geminiSection?.body ?? "";

    expect(body).toContain("formula you typed");
    expect(body).toContain("step prompt");
    expect(body).toContain("expected solution");
    expect(body).toContain("grid values");
    expect(body).toContain("do not transmit your name, email");
    expect(body).toContain("salted SHA-256 hash");
    expect(body).toContain("Raw IP addresses are never stored");
    expect(body).toContain("hashed identifier is not sent to Google");
  });

  it("provides account deletion on request by email", () => {
    const retention = PRIVACY_SECTIONS.find((s) => s.id === "retention-rights");
    expect(retention).toBeDefined();
    expect(retention?.body).toContain("email to [CONTACT EMAIL]");
    expect(retention?.body).toContain("Profile");
  });

  it("uses placeholders [LEGAL NAME], [ADDRESS], [CONTACT EMAIL] for owner details", () => {
    const combined = PRIVACY_SECTIONS.map((s) => s.body).join(" ");
    expect(combined).toContain("[LEGAL NAME]");
    expect(combined).toContain("[ADDRESS]");
    expect(combined).toContain("[CONTACT EMAIL]");
  });

  it("does not contain invented support emails", () => {
    for (const section of PRIVACY_SECTIONS) {
      expect(section.body).not.toContain("support@excelguru.dev");
      expect(section.body).not.toContain("support@excelguru.in");
    }
  });

  it("has valid IDs and titles for all sections", () => {
    for (const section of PRIVACY_SECTIONS) {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.body).toBeTruthy();
    }
  });
});

describe("TERMS_SECTIONS", () => {
  it("covers disclaimer, subscriptions, renewals, refunds, AI hints, and acceptable use", () => {
    const combined = TERMS_SECTIONS.map((s) => `${s.title} ${s.body}`)
      .join(" ")
      .toLowerCase();

    // Educational / Microsoft trademark disclaimer
    expect(combined).toContain("microsoft");
    expect(combined).toContain("trademark");

    // Subscriptions, renewal, cancellation, refunds
    expect(combined).toContain("subscription");
    expect(combined).toContain("renew");
    expect(combined).toContain("cancel any time");
    expect(combined).toContain("full refund if unhappy");

    // Acceptable use
    expect(combined).toContain("acceptable use");

    // Governing law India
    expect(combined).toContain("india");
  });

  it("states refund wording matching the pricing page", () => {
    const subSection = TERMS_SECTIONS.find((s) => s.id === "subscriptions-billing");
    expect(subSection).toBeDefined();
    const body = subSection?.body ?? "";
    expect(body).toContain("full refund if unhappy");
    expect(body).not.toContain("14-day");
    expect(body).not.toContain("14 days");
  });

  it("states subscription renews until cancelled and access lasts to period end", () => {
    const subSection = TERMS_SECTIONS.find((s) => s.id === "subscriptions-billing");
    expect(subSection).toBeDefined();
    const body = subSection?.body ?? "";
    expect(body).toContain("renew at the end of each billing cycle until cancelled");
    expect(body).toContain("access lasts until the end of your current paid billing period");
    expect(body).toContain("Pricing page → Manage / cancel subscription");
  });

  it("contains acceptable use prohibiting scraping, reverse engineering, and score manipulation", () => {
    const useSection = TERMS_SECTIONS.find((s) => s.id === "acceptable-use");
    expect(useSection).toBeDefined();
    const body = useSection?.body.toLowerCase() ?? "";
    expect(body).toContain("bypass");
    expect(body).toContain("scraping");
    expect(body).toContain("reverse-engineering");
  });

  it("contains governing law India placeholder", () => {
    const lawSection = TERMS_SECTIONS.find((s) => s.id === "governing-law");
    expect(lawSection).toBeDefined();
    const body = lawSection?.body ?? "";
    expect(body).toContain("laws of India");
    expect(body).toContain("[CITY/STATE], India");
  });

  it("uses placeholders [LEGAL NAME], [ADDRESS], [CONTACT EMAIL] in terms", () => {
    const combined = TERMS_SECTIONS.map((s) => s.body).join(" ");
    expect(combined).toContain("[LEGAL NAME]");
    expect(combined).toContain("[ADDRESS]");
    expect(combined).toContain("[CONTACT EMAIL]");
  });

  it("does not contain invented support emails", () => {
    for (const section of TERMS_SECTIONS) {
      expect(section.body).not.toContain("support@excelguru.dev");
      expect(section.body).not.toContain("support@excelguru.in");
    }
  });

  it("has valid IDs and titles for all sections", () => {
    for (const section of TERMS_SECTIONS) {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.body).toBeTruthy();
    }
  });
});
