import { describe, expect, it } from "vitest";
import { activityStats } from "./ActivityGraph";

// 2026-11-24 12:00 IST
const now = new Date("2026-11-24T06:30:00Z");

describe("activityStats", () => {
  it("buckets completions by IST day", () => {
    // 23:00 UTC on the 23rd is already 04:30 on the 24th in IST.
    const { counts } = activityStats(["2026-11-23T23:00:00Z", "2026-11-24T05:00:00Z", "2026-11-23T10:00:00Z"], now);
    expect(counts.get("2026-11-24")).toBe(2);
    expect(counts.get("2026-11-23")).toBe(1);
  });

  it("counts a run ending today, or yesterday when today is still empty", () => {
    expect(activityStats(["2026-11-24T05:00:00Z", "2026-11-23T05:00:00Z", "2026-11-22T05:00:00Z"], now).streak).toBe(3);
    expect(activityStats(["2026-11-23T05:00:00Z", "2026-11-22T05:00:00Z"], now).streak).toBe(2);
    expect(activityStats(["2026-11-21T05:00:00Z"], now).streak).toBe(0);
  });

  it("ignores unparseable dates", () => {
    expect(activityStats(["nope"], now).counts.size).toBe(0);
  });
});
