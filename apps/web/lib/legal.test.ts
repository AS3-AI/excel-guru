import { describe, expect, it } from "vitest";
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from "./legal";

describe("PRIVACY_SECTIONS", () => {
  it("explicitly documents what we collect across Supabase, Razorpay, Gemini, and analytics", () => {
    const combined = PRIVACY_SECTIONS.map((s) => `${s.title} ${s.body}`).join(" ").toLowerCase();

    // Supabase
    expect(combined).toContain("supabase");
    expect(combined).toContain("authentication");
    expect(combined).toContain("progress");

    // Payment providers
    expect(combined).toContain("razorpay");
    expect(combined).toContain("stripe");
    expect(combined).toContain("card numbers"); // Should note we do NOT store card numbers

    // Gemini AI
    expect(combined).toContain("gemini");
    expect(combined).toContain("explanation");

    // Analytics
    expect(combined).toContain("analytics");
  });

  it("specifies exactly what is transmitted to Gemini and what is omitted", () => {
    const geminiSection = PRIVACY_SECTIONS.find((s) => s.id === "gemini-ai");
    expect(geminiSection).toBeDefined();
    const body = geminiSection?.body ?? "";

    expect(body).toContain("step's prompt");
    expect(body).toContain("grid values");
    expect(body).toContain("correct solution");
    expect(body).toContain("wrong answer");
    expect(body).toContain("do not send your name or email");
    expect(body).toContain("hashed ID is used only for the daily limit and is not sent to Gemini");
  });

  it("does not claim account deletion or reset from Profile", () => {
    const retention = PRIVACY_SECTIONS.find((s) => s.id === "retention-rights");
    expect(retention).toBeDefined();
    expect(retention?.body).not.toContain("Profile settings");
    expect(retention?.body).not.toContain("from your Profile");
    expect(retention?.body).toContain("from your Dashboard");
    expect(retention?.body).toContain("use the Help page to contact us");
  });

  it("does not contain the invented support email", () => {
    for (const section of PRIVACY_SECTIONS) {
      expect(section.body).not.toContain("support@excelguru.dev");
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
  it("covers disclaimer, subscriptions, billing, AI hints, and acceptable use", () => {
    const combined = TERMS_SECTIONS.map((s) => `${s.title} ${s.body}`).join(" ").toLowerCase();

    // Educational / Microsoft trademark disclaimer
    expect(combined).toContain("microsoft");
    expect(combined).toContain("trademark");

    // Subscriptions and refund policy
    expect(combined).toContain("subscription");
    expect(combined).toContain("refund");

    // AI generated explanations
    expect(combined).toContain("ai");

    // Acceptable use
    expect(combined).toContain("acceptable use");
  });

  it("states refund policy with no time limit matching live pricing page", () => {
    const subSection = TERMS_SECTIONS.find((s) => s.id === "subscriptions-billing");
    expect(subSection).toBeDefined();
    const body = subSection?.body ?? "";
    expect(body).toContain("a full refund if you're unhappy; cancel any time");
    expect(body).not.toContain("14-day");
    expect(body).not.toContain("14 days");
    expect(subSection?.title).not.toContain("14-Day");
  });

  it("instructs cancelling via the Help page instead of account settings or Profile", () => {
    const subSection = TERMS_SECTIONS.find((s) => s.id === "subscriptions-billing");
    expect(subSection).toBeDefined();
    const body = subSection?.body ?? "";
    expect(body).toContain("to cancel, use the Help page");
    expect(body).not.toContain("account settings");
    expect(body).not.toContain("Profile");
  });

  it("does not contain the invented support email in terms", () => {
    for (const section of TERMS_SECTIONS) {
      expect(section.body).not.toContain("support@excelguru.dev");
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

