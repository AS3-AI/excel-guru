import { describe, expect, it } from "vitest";
import { HELP_SECTIONS, getHelpCategories, searchHelp } from "./help";

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
    expect(allQuestions).toContain("refund");
    expect(allQuestions).toContain("progress");
  });

  it("states refund policy matching pricing page with no day limit", () => {
    const refundItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("refund"));
    expect(refundItem).toBeDefined();
    expect(refundItem?.a).toContain("a full refund if you're unhappy; cancel any time");
    expect(refundItem?.a).not.toContain("14-day");
    expect(refundItem?.a).not.toContain("14 days");
  });

  it("instructs to use the Help page to cancel instead of non-existent account settings or Profile", () => {
    const cancelItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("cancel"));
    expect(cancelItem).toBeDefined();
    expect(cancelItem?.a).toContain("To cancel, use the Help page");
    expect(cancelItem?.a).not.toContain("Profile");
    expect(cancelItem?.a).not.toContain("Account menu");
  });

  it("does not claim delete-account or reset from Profile", () => {
    const resetItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("reset"));
    expect(resetItem).toBeDefined();
    expect(resetItem?.a).toContain("On the Dashboard");
    expect(resetItem?.a).not.toContain("Profile");

    const deleteItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("delete"));
    expect(deleteItem).toBeDefined();
    expect(deleteItem?.a).toContain("use the Help page to contact us");
    expect(deleteItem?.a).not.toContain("Profile");
  });

  it("does not contain the invented support email", () => {
    for (const item of HELP_SECTIONS.flatMap((s) => s.items)) {
      expect(item.a).not.toContain("support@excelguru.dev");
    }
  });

  it("does not claim unbuilt features in lesson descriptions", () => {
    const freeItem = HELP_SECTIONS.flatMap((s) => s.items).find((i) => i.q.toLowerCase().includes("free"));
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
    expect(categories).toContain("Getting Started & Lessons");
    expect(categories).toContain("Subscriptions & Billing");
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

