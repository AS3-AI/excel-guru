import { describe, expect, it } from "vitest";
import { MODULES, getModuleProgress, nextRecommendedPath, statusCounts } from "./modules";

const expected = [
  ["sum", "SUM", 9], ["count", "COUNT", 7], ["logical", "Logical", 7], ["lookup", "Lookup", 10], ["text-search", "Text Search", 7],
  ["intro-to-shortcuts", "Intro to Shortcuts", 6], ["cell-selection", "Cell Selection", 7], ["text-manipulation", "Text Manipulation", 4], ["index-match", "Index Match", 6],
  ["statistical", "Statistical", 7], ["tables", "Tables", 4], ["dates", "Dates", 5], ["other-skills", "Other Skills", 2], ["array-formulas", "Array Formulas", 2], ["combined", "Combined", 2],
] as const;
describe("curriculum modules", () => {
  it("contains all 15 spec modules in order with their expected slugs, titles and sizes", () => expect(MODULES.map(({ slug, title, total }) => [slug, title, total])).toEqual(expected));
  it("uses a lesson's module field to assign membership", () => expect(getModuleProgress({ lessons: [{ id: "a", module: "SUM" }, { id: "b", module: "COUNT" }], completedIds: ["a"] })[0]).toMatchObject({ done: 1, total: 9 }));
  it("counts distinct completed lessons in the matching module", () => expect(getModuleProgress({ lessons: [{ id: "a", module: "SUM" }, { id: "b", module: "SUM" }], completedIds: ["a", "a", "b"] })[0]?.done).toBe(2));
  it("returns x/N counts for every module", () => expect(getModuleProgress({ lessons: [], completedIds: [] }).map((m) => `${m.done}/${m.total}`)).toEqual(expected.map(([, , total]) => `0/${total}`)));
  it("recommends the first incomplete lesson by global order", () => expect(nextRecommendedPath(["intro", "sum-a", "sum-b"], ["intro", "sum-a"])).toBe("/lesson/sum-b"));
  it("recommends review after the final ordered lesson is complete", () => expect(nextRecommendedPath(["intro", "sum-a"], ["intro", "sum-a"])).toBe("/review"));
  it("counts status tags for the stacked dashboard bar", () => expect(statusCounts(["low", "low", "practice", "good"])).toEqual({ low: 2, practice: 1, good: 1 }));
  it("uses lesson.module values and excludes lessons with unknown modules", () => expect(getModuleProgress({ lessons: [{ id: "x", module: "Unknown" }], completedIds: ["x"] }).every((m) => m.done === 0)).toBe(true));
});
