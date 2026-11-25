import { describe, expect, it } from "vitest";
import {
  buildRecentActivity,
  computeAccuracySummary,
  computeLeagueTier,
  computeModuleBreakdown,
  computeWeeklyActivity,
  pickFeaturedModules,
  renderCertificateSvg,
  type LessonMeta,
} from "./profile-stats";

describe("computeModuleBreakdown", () => {
  it("matches multi-word hyphenated module slugs accurately", () => {
    const order = ["sum-1", "sum-2", "index-match-1", "text-search-1", "intro"];
    const map = new Map<string, LessonMeta>([
      ["intro", { id: "intro", title: "Welcome", module: "intro" }],
      ["sum-1", { id: "sum-1", title: "SUM 1", module: "sum" }],
      ["sum-2", { id: "sum-2", title: "SUM 2", module: "sum" }],
      ["index-match-1", { id: "index-match-1", title: "MATCH", module: "index-match" }],
      ["text-search-1", { id: "text-search-1", title: "LEFT", module: "text-search" }],
    ]);

    const result = computeModuleBreakdown(order, map, ["index-match-1", "text-search-1", "sum-1"]);
    const indexMatch = result.find((m) => m.slug === "index-match");
    const textSearch = result.find((m) => m.slug === "text-search");
    const sum = result.find((m) => m.slug === "sum");

    expect(indexMatch?.done).toBe(1);
    expect(indexMatch?.total).toBe(1);
    expect(indexMatch?.pct).toBe(100);
    expect(textSearch?.done).toBe(1);
    expect(sum?.done).toBe(1);
    expect(sum?.total).toBe(2);
    expect(sum?.pct).toBe(50);
  });
});

describe("pickFeaturedModules", () => {
  it("prioritizes started modules before untouched ones", () => {
    const breakdown = [
      { slug: "sum", title: "SUM", order: 1, done: 0, total: 9, pct: 0 },
      { slug: "count", title: "COUNT", order: 2, done: 0, total: 7, pct: 0 },
      { slug: "lookup", title: "Lookup", order: 4, done: 3, total: 10, pct: 30 },
      { slug: "dates", title: "Dates", order: 12, done: 2, total: 5, pct: 40 },
      { slug: "logical", title: "Logical", order: 3, done: 0, total: 7, pct: 0 },
    ];
    const picked = pickFeaturedModules(breakdown, 4);
    expect(picked.map((m) => m.slug)).toEqual(["lookup", "dates", "sum", "count"]);
  });
});

describe("computeAccuracySummary", () => {
  it("returns hasData=false and averagePct=0 when no lessons have been completed", () => {
    const res = computeAccuracySummary([]);
    expect(res.hasData).toBe(false);
    expect(res.averagePct).toBe(0);
    expect(res.perfectCount).toBe(0);
    expect(res.tier.label).toBe("Starter");
  });

  it("computes real average first-try accuracy and perfect count", () => {
    const res = computeAccuracySummary([
      { lesson_id: "sum-1", completed_at: "2026-11-24T10:00:00Z", first_try_accuracy: 1 },
      { lesson_id: "sum-2", completed_at: "2026-11-24T10:05:00Z", first_try_accuracy: 0.8 },
    ]);
    expect(res.hasData).toBe(true);
    expect(res.averagePct).toBe(90);
    expect(res.perfectCount).toBe(1);
    expect(res.tier.label).toBe("Mastery");
  });
});

describe("computeLeagueTier", () => {
  it("starts in Bronze at 0 XP and tracks points to next tier", () => {
    expect(computeLeagueTier(0)).toMatchObject({ name: "Bronze", nextName: "Silver", pointsToNext: 150 });
    expect(computeLeagueTier(200)).toMatchObject({ name: "Silver", nextName: "Gold", pointsToNext: 400 });
    expect(computeLeagueTier(650)).toMatchObject({ name: "Gold", nextName: "Emerald", pointsToNext: 850 });
    expect(computeLeagueTier(1600)).toMatchObject({ name: "Emerald", nextName: "Diamond", pointsToNext: 1400 });
    expect(computeLeagueTier(3500)).toMatchObject({ name: "Diamond", nextName: null, pointsToNext: 0 });
  });
});

describe("computeWeeklyActivity", () => {
  it("buckets points by IST calendar day over the last 7 days", () => {
    const now = new Date("2026-11-25T06:00:00Z"); // 2026-11-25 11:30 IST
    const activity = computeWeeklyActivity(
      [
        { points: 100, created_at: "2026-11-25T01:00:00Z" }, // 2026-11-25 06:30 IST -> Today
        { points: 500, created_at: "2026-11-24T19:00:00Z" }, // 2026-11-25 00:30 IST -> Still Today in IST!
        { points: 45, created_at: "2026-11-23T12:00:00Z" },  // 2026-11-23 IST
      ],
      now,
    );
    expect(activity).toHaveLength(7);
    expect(activity[6]?.isToday).toBe(true);
    expect(activity[6]?.date).toBe("2026-11-25");
    expect(activity[6]?.points).toBe(600);
    expect(activity[4]?.date).toBe("2026-11-23");
    expect(activity[4]?.points).toBe(45);
  });
});

describe("buildRecentActivity", () => {
  it("sorts descending by completion timestamp", () => {
    const map = new Map<string, LessonMeta>([
      ["sum-1", { id: "sum-1", title: "SUM 1", module: "sum" }],
      ["sum-2", { id: "sum-2", title: "SUM 2", module: "sum" }],
    ]);
    const recent = buildRecentActivity(
      [
        { lesson_id: "sum-1", completed_at: "2026-11-20T10:00:00Z", first_try_accuracy: 0.75, times_completed: 1 },
        { lesson_id: "sum-2", completed_at: "2026-11-25T10:00:00Z", first_try_accuracy: 1, times_completed: 2 },
      ],
      map,
    );
    expect(recent.map((r) => r.id)).toEqual(["sum-2", "sum-1"]);
    expect(recent[0]?.accuracyPct).toBe(100);
    expect(recent[0]?.timesCompleted).toBe(2);
  });
});

describe("renderCertificateSvg", () => {
  it("escapes XML special characters in recipient name and renders credential ID", () => {
    const svg = renderCertificateSvg({
      recipientName: "Asha & <Dev>",
      credentialId: "EG-2026-ABCD12",
      issuedAtIso: "2026-11-25T00:00:00Z",
      totalLessons: 86,
      verifyUrl: "https://excelguru.dev/verify?id=EG-2026-ABCD12",
    });
    expect(svg).toContain("Asha &amp; &lt;Dev&gt;");
    expect(svg).toContain("EG-2026-ABCD12");
    expect(svg).toContain("86 interactive spreadsheet lessons");
  });
});
