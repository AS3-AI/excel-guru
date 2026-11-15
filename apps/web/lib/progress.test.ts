import { describe, expect, it } from "vitest";
import { getLesson } from "./lessons";
import { calculateProgress, getIstDate, getIstDayUtcBounds, getStreak, getStatusTag, pointsAllowedForCompletion, progressAttemptRows, readBodyAfterAuthentication, type ProgressAttempt } from "./progress";
import type { Lesson, ShortcutChordStep } from "@excel-guru/grader";

const lesson = getLesson("intro")!;
const formulaStep = lesson.steps.find((step) => step.type === "formula")!;
function right(step: (typeof lesson.steps)[number], extra: Partial<ProgressAttempt> = {}): ProgressAttempt {
  const input = step.type === "formula" ? step.solution : step.type === "select" ? step.target : step.type === "mcq" ? String(step.answer) : step.type === "picture" || step.type === "project" ? step.accept[0]! : "";
  return { stepId: step.id, input, showedAnswer: false, ...extra };
}
function completionAttempts(): ProgressAttempt[] { return lesson.steps.filter((s) => s.type !== "info").slice(0, lesson.requiredCorrect).map((s) => right(s)); }
function small(requiredCorrect = 1) { return { ...lesson, requiredCorrect, steps: [formulaStep] }; }

describe("progress scoring, dates, and persistence rows", () => {
  it("re-grades a forged correct flag from the submitted input", () => { expect(() => calculateProgress(small(), [{ ...right(formulaStep), input: "=1+1", correct: true }])).toThrow(/complete/i); });
  it("rejects a step id absent from the lesson", () => { expect(() => calculateProgress(small(), [{ stepId: "forged-step", input: "x", showedAnswer: false }])).toThrow(/step/i); });
  it("rejects attempts on info steps", () => { const info = lesson.steps.find((s) => s.type === "info")!; expect(() => calculateProgress(lesson, [{ stepId: info.id, input: "", showedAnswer: false }])).toThrow(/info/i); });
  it("rejects malformed attempt fields", () => { expect(() => calculateProgress(small(), [{ stepId: formulaStep.id, input: 4 as unknown as string, showedAnswer: false }])).toThrow(/invalid/i); });
  it("requires enough graded correct answers", () => { expect(() => calculateProgress(lesson, [])).toThrow(/complete/i); });
  it("counts Show Answer attempts for completion with no points", () => { const attempts = completionAttempts().map((a) => ({ ...a, showedAnswer: true })); expect(calculateProgress(lesson, attempts)).toMatchObject({ correctCount: lesson.requiredCorrect, points: 0 }); });

  it("awards first try bonus at difficulty one", () => { expect(calculateProgress({ ...small(), difficulty: 1 }, [right(formulaStep)]).points).toBe(15); });
  it("awards first try bonus at difficulty two", () => { expect(calculateProgress({ ...small(), difficulty: 2 }, [right(formulaStep)]).points).toBe(30); });
  it("awards first try bonus at difficulty three", () => { expect(calculateProgress({ ...small(), difficulty: 3 }, [right(formulaStep)]).points).toBe(45); });
  it("does not award first try bonus after a wrong answer", () => { expect(calculateProgress(small(), [{ ...right(formulaStep), input: "=1+1" }, right(formulaStep)]).points).toBe(10 * lesson.difficulty); });
  it("first try accuracy records a wrong first answer", () => { expect(calculateProgress(small(), [{ ...right(formulaStep), input: "=1+1" }, right(formulaStep)]).firstTryAccuracy).toBe(0); });
  it("accuracy excludes info and unattempted steps", () => { expect(calculateProgress(lesson, completionAttempts()).firstTryAccuracy).toBe(1); });
  it("counts a cycling repeat as another completion occurrence", () => { const cycle = [right(formulaStep), right(lesson.steps.find((s) => s.type !== "info" && s.id !== formulaStep.id)!), right(formulaStep)]; expect(calculateProgress({ ...lesson, requiredCorrect: 3 }, cycle).correctCount).toBe(3); });
  it("awards points for a correct cycling repeat", () => { const other = lesson.steps.find((s) => s.type !== "info" && s.id !== formulaStep.id)!; const result = calculateProgress({ ...lesson, requiredCorrect: 3 }, [right(formulaStep), right(other), right(formulaStep)]); expect(result.points).toBeGreaterThan(10 * lesson.difficulty * 1.5); });
  it("awards points only once for duplicate correct attempts in one visit", () => { expect(calculateProgress(small(), [right(formulaStep), right(formulaStep)]).points).toBe(15 * lesson.difficulty); });
  it("does not award duplicate corrects after the first correct in a visit", () => { expect(calculateProgress(small(), [{ ...right(formulaStep), input: "=1+1" }, right(formulaStep), right(formulaStep)]).points).toBe(10 * lesson.difficulty); });
  it("allows a later cycle to earn again after an earlier award", () => { const other = lesson.steps.find((s) => s.type !== "info" && s.id !== formulaStep.id)!; const result = calculateProgress({ ...lesson, requiredCorrect: 3 }, [right(formulaStep), right(other), right(formulaStep)]); expect(result.points).toBe(15 * lesson.difficulty + 15 * lesson.difficulty + 10 * lesson.difficulty); });
  it("earlier Show Answer suppresses later points within that visit", () => { const attempts = [{ ...right(formulaStep), showedAnswer: true }, right(formulaStep)]; expect(calculateProgress(small(), attempts).points).toBe(0); });
  it("Show Answer does not suppress a prior award in the visit", () => { const attempts = [right(formulaStep), { ...right(formulaStep), showedAnswer: true }]; expect(calculateProgress(small(), attempts).points).toBe(15 * lesson.difficulty); });
  it("Show Answer state is reset for a cycling visit", () => { const other = lesson.steps.find((s) => s.type !== "info" && s.id !== formulaStep.id)!; const attempts = [{ ...right(formulaStep), showedAnswer: true }, right(other), right(formulaStep)]; expect(calculateProgress({ ...lesson, requiredCorrect: 3 }, attempts).points).toBeGreaterThan(0); });
  const shortcut: ShortcutChordStep = { id: "shortcut", type: "shortcut", mode: "chord", prompt: "Select all", keys: { win: "Ctrl+Shift+ArrowDown", mac: "Cmd+Shift+ArrowDown" } };
  const shortcutLesson: Lesson = { ...lesson, requiredCorrect: 1, steps: [shortcut] };
  it("validates the optional OS value", () => { expect(() => calculateProgress(shortcutLesson, [{ stepId: shortcut.id, input: shortcut.keys.win, showedAnswer: false, os: "linux" as "win" }])).toThrow(/os/i); });
  it("uses the default Windows shortcut grading mode", () => { expect(calculateProgress(shortcutLesson, [{ stepId: shortcut.id, input: shortcut.keys.win, showedAnswer: false }]).correctCount).toBe(1); });
  it("accepts Mac shortcut grading mode", () => { expect(calculateProgress(shortcutLesson, [{ stepId: shortcut.id, input: shortcut.keys.mac!, showedAnswer: false, os: "mac" }]).correctCount).toBe(1); });
  it("rejects attempts beyond four times the lesson step count", () => { expect(() => calculateProgress(lesson, Array.from({ length: lesson.steps.length * 4 + 1 }, () => right(formulaStep)))).toThrow(/too many/i); });
  it("accepts attempts at the four times step count boundary when complete", () => { const eligible = lesson.steps.filter((s) => s.type !== "info"); const attempts = Array.from({ length: lesson.steps.length * 4 }, (_, i) => right(eligible[i % eligible.length]!)); expect(() => calculateProgress(lesson, attempts)).not.toThrow(); });
  it("writes a row for every submitted attempt", () => { const attempts = [right(formulaStep), right(formulaStep)]; expect(progressAttemptRows("u", "intro", attempts, small(), new Date()).map((r) => r.step_id)).toEqual([formulaStep.id, formulaStep.id]); });
  it("marks only the first row for a step first_try", () => { expect(progressAttemptRows("u", "intro", [right(formulaStep), right(formulaStep)], small(), new Date()).map((r) => r.first_try)).toEqual([true, false]); });
  it("returns unauthorized without invoking request validation", async () => { let parsed = false; const result = await readBodyAfterAuthentication(null, async () => { parsed = true; throw new Error("invalid body"); }); expect(result).toEqual({ authenticated: false }); expect(parsed).toBe(false); });

  it("converts 18:29Z to the same IST date", () => { expect(getIstDate(new Date("2026-11-14T18:29:00Z"))).toBe("2026-11-14"); });
  it("converts 18:31Z to the next IST date", () => { expect(getIstDate(new Date("2026-11-14T18:31:00Z"))).toBe("2026-11-15"); });
  it("awards points on the first completion today", () => { expect(pointsAllowedForCompletion([], new Date("2026-11-15T12:00:00Z"))).toBe(true); });
  it("does not award points for a second completion on the same IST day", () => { expect(pointsAllowedForCompletion([{ completed_at: "2026-11-15T10:00:00Z", points: 15 }], new Date("2026-11-15T12:00:00Z"))).toBe(false); });
  it("awards points when the prior completion was yesterday in IST", () => { expect(pointsAllowedForCompletion([{ completed_at: "2026-11-14T18:29:00Z", points: 15 }], new Date("2026-11-14T18:31:00Z"))).toBe(true); });
  it("treats 18:29Z and 18:31Z on one UTC date as different IST days", () => {
    const prior = [{ completed_at: "2026-11-14T18:29:00Z", points: 15 }];
    expect(pointsAllowedForCompletion(prior, new Date("2026-11-14T18:29:00Z"))).toBe(false);
    expect(pointsAllowedForCompletion(prior, new Date("2026-11-14T18:31:00Z"))).toBe(true);
  });
  it("computes UTC bounds for an IST day", () => { expect(getIstDayUtcBounds(new Date("2026-11-14T18:31:00Z"))).toEqual({ start: "2026-11-14T18:30:00.000Z", end: "2026-11-15T18:30:00.000Z" }); });
  it("keeps streak unchanged at 18:29Z before IST midnight", () => { expect(getStreak({ current: 5, longest: 7, last_active_date: "2026-11-14" }, new Date("2026-11-14T18:29:00Z"))).toEqual({ current: 5, longest: 7, last_active_date: "2026-11-14" }); });
  it("increments streak at 18:31Z after IST midnight and updates longest", () => { expect(getStreak({ current: 5, longest: 5, last_active_date: "2026-11-14" }, new Date("2026-11-14T18:31:00Z"))).toEqual({ current: 6, longest: 6, last_active_date: "2026-11-15" }); });
  it("starts a one day streak after a gap", () => { expect(getStreak({ current: 9, longest: 9, last_active_date: "2026-11-12" }, new Date("2026-11-14T18:31:00Z")).current).toBe(1); });
  it("starts a one day streak when there is no previous row", () => { expect(getStreak(null, new Date("2026-11-14T18:31:00Z")).current).toBe(1); });
  it("preserves a longer historical streak after a reset", () => { expect(getStreak({ current: 9, longest: 12, last_active_date: "2026-11-12" }, new Date("2026-11-14T18:31:00Z")).longest).toBe(12); });
  it("classifies accuracy below 50 percent as low", () => { expect(getStatusTag(0.49, new Date(), new Date())).toBe("low"); });
  it("classifies exactly 50 percent and recent completion as good", () => { expect(getStatusTag(0.5, new Date("2026-11-15"), new Date("2026-11-14"))).toBe("good"); });
  it("classifies completion at 14 days as practice", () => { expect(getStatusTag(0.5, new Date("2026-11-01"), new Date("2026-11-15"))).toBe("practice"); });
  it("checks low accuracy before age", () => { expect(getStatusTag(0.2, new Date("2026-01-01"), new Date("2026-11-15"))).toBe("low"); });
});
