import { describe, expect, it } from "vitest";
import { HELP_SECTIONS, getHelpCategories, searchHelp } from "./help";
import { PLANS, formatPrice } from "./plans";

describe("HELP_SECTIONS", () => {
  it("contains structured categories with non-empty questions and answers", () => {
    expect(HELP_SECTIONS.length).toBeGreaterThan(0);
    for (const section of HELP_SECTIONS) {
      expect(section.category).toBeTruthy();
      expect(section.items.length).toBeGreaterThan(0);
      for (const item of section.items) {
        expect(item.q).toBeTruthy();
        expect(item.a).toBeTruthy();
      }
    }
  });

  it("covers key learner topics", () => {
    const allQuestions = HELP_SECTIONS.flatMap((s) => s.items.map((i) => i.q.toLowerCase())).join(" ");
    expect(allQuestions).toContain("free");
    expect(allQuestions).toContain("shortcut");
    expect(allQuestions).toContain("cancel");
    expect(allQuestions).toContain("refund");
    expect(allQuestions).toContain("progress");
  });

  it("explains how lessons work including Check, Show Answer, and Skip", () => {
    const lessonItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("how do lessons"));
    expect(lessonItem).toBeDefined();
    expect(lessonItem?.a).toContain("Check");
    expect(lessonItem?.a).toContain("Show Answer");
    expect(lessonItem?.a).toContain("Skip");
  });

  it("explains Mac vs Windows shortcuts", () => {
    const shortcutItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("mac vs windows"));
    expect(shortcutItem).toBeDefined();
    expect(shortcutItem?.a.toLowerCase()).toContain("mac");
    expect(shortcutItem?.a.toLowerCase()).toContain("windows");
  });

  it("states refund policy matching pricing page", () => {
    const refundItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("refund"));
    expect(refundItem).toBeDefined();
    expect(refundItem?.a).toContain("full refund if unhappy");
    expect(refundItem?.a).toContain("[CONTACT EMAIL]");
    expect(refundItem?.a).not.toContain("14-day");
    expect(refundItem?.a).not.toContain("14 days");
  });

  it("instructs to cancel via Pricing page → Manage / cancel subscription", () => {
    const cancelItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("cancel"));
    expect(cancelItem).toBeDefined();
    expect(cancelItem?.a).toContain("Pricing page → Manage / cancel subscription");
    expect(cancelItem?.a).not.toContain("Profile");
    expect(cancelItem?.a).not.toContain("Account menu");
  });

  it("uses prices formatted from plans.ts", () => {
    const plansItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("free and premium"));
    expect(plansItem).toBeDefined();
    expect(plansItem?.a).toContain(formatPrice("INR", PLANS.INR.monthly));
    expect(plansItem?.a).toContain(formatPrice("INR", PLANS.INR.annual));
  });

  it("uses the contact email placeholder instead of invented emails", () => {
    const allAnswers = HELP_SECTIONS.flatMap((s) => s.items.map((i) => i.a)).join(" ");
    expect(allAnswers).toContain("[CONTACT EMAIL]");
    expect(allAnswers).not.toContain("support@excelguru.dev");
    expect(allAnswers).not.toContain("support@excelguru.in");
  });

  it("does not claim unbuilt features in lesson descriptions", () => {
    const freeItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("free and premium"));
    expect(freeItem).toBeDefined();
    expect(freeItem?.a).toContain("80+");
    expect(freeItem?.a).not.toContain("86");
    expect(freeItem?.a).not.toContain("real-data projects");
    expect(freeItem?.a).not.toContain("daily challenges");
    expect(freeItem?.a).not.toContain("verifiable certification");
  });
});

describe("getHelpCategories", () => {
  it("returns distinct category names", () => {
    const categories = getHelpCategories();
    expect(categories).toContain("How Lessons Work");
    expect(categories).toContain("Free vs Premium & Billing");
    expect(new Set(categories).size).toBe(categories.length);
  });
});

describe("searchHelp", () => {
  it("finds matching questions by keyword", () => {
    const refundResults = searchHelp("refund");
    expect(refundResults.length).toBeGreaterThan(0);
    expect(refundResults[0]?.q.toLowerCase() || refundResults[0]?.a.toLowerCase()).toContain("refund");
  });

  it("returns all items when query is empty or whitespace", () => {
    const all = searchHelp("");
    const totalCount = HELP_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
    expect(all.length).toBe(totalCount);
  });

  it("returns empty array when no question or answer matches", () => {
    const results = searchHelp("xyznonexistentword999");
    expect(results).toEqual([]);
  });
});
