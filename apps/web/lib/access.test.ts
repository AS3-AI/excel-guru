import { describe, expect, it } from "vitest";
import { decideLessonAccess } from "./access";

describe("lesson access", () => {
  it("allows Intro to a signed-out learner", () => expect(decideLessonAccess({ lessonId: "intro", userId: null, completedLessonIds: [] })).toEqual({ allowed: true, reason: "ok" }));
  it("sends signed-out learners from any other lesson to signup", () => expect(decideLessonAccess({ lessonId: "sum", userId: null, completedLessonIds: [] })).toEqual({ allowed: false, reason: "signup" }));
  it("allows signed-in free learners with no completed lessons", () => expect(decideLessonAccess({ lessonId: "sum", userId: "u", completedLessonIds: [] })).toMatchObject({ allowed: true }));
  it("allows the first new lesson when Intro is complete", () => expect(decideLessonAccess({ lessonId: "sum", userId: "u", completedLessonIds: ["intro"] })).toMatchObject({ allowed: true }));
  it("allows the second distinct lesson for a learner with one completion", () => expect(decideLessonAccess({ lessonId: "count", userId: "u", completedLessonIds: ["intro"] })).toMatchObject({ allowed: true }));
  it("paywalls a new third lesson when two distinct lessons are complete", () => expect(decideLessonAccess({ lessonId: "lookup", userId: "u", completedLessonIds: ["intro", "sum"] })).toEqual({ allowed: false, reason: "paywall" }));
  it("allows replay of an already completed lesson at the free limit", () => expect(decideLessonAccess({ lessonId: "sum", userId: "u", completedLessonIds: ["intro", "sum"] })).toEqual({ allowed: true, reason: "ok" }));
  it("premium subscription allows new lessons regardless of completed count", () => expect(decideLessonAccess({ lessonId: "lookup", userId: "u", completedLessonIds: ["intro", "sum"], premium: true })).toMatchObject({ allowed: true }));
  it("group paid access allows new lessons regardless of completed count", () => expect(decideLessonAccess({ lessonId: "lookup", userId: "u", completedLessonIds: ["intro", "sum"], groupPremium: true })).toMatchObject({ allowed: true }));
  it("treats repeated completions as one distinct lesson", () => expect(decideLessonAccess({ lessonId: "count", userId: "u", completedLessonIds: ["intro", "intro", "sum"] })).toEqual({ allowed: false, reason: "paywall" }));
  it("still requires signup for a non-Intro replay while signed out", () => expect(decideLessonAccess({ lessonId: "sum", userId: null, completedLessonIds: ["sum"] })).toMatchObject({ reason: "signup" }));
  it("allows Intro even when no user is signed in", () => expect(decideLessonAccess({ lessonId: "intro", userId: null, completedLessonIds: ["intro"] })).toMatchObject({ allowed: true }));
  it("allows any new lesson to a premium learner with zero prior completions", () => expect(decideLessonAccess({ lessonId: "sum", userId: "u", completedLessonIds: [], premium: true })).toMatchObject({ allowed: true }));
  it("allows a completed Intro replay for a signed-in learner", () => expect(decideLessonAccess({ lessonId: "intro", userId: "u", completedLessonIds: ["intro"] })).toMatchObject({ allowed: true }));
  it("ignores empty completion ids", () => expect(decideLessonAccess({ lessonId: "count", userId: "u", completedLessonIds: ["", "intro", "sum"] })).toMatchObject({ reason: "paywall" }));
  it("does not treat an empty user id as signed in", () => expect(decideLessonAccess({ lessonId: "sum", userId: "", completedLessonIds: [] })).toMatchObject({ reason: "signup" }));
  it("allows third lesson when group membership is paid", () => expect(decideLessonAccess({ lessonId: "count", userId: "u", completedLessonIds: ["intro", "sum"], groupPremium: true })).toMatchObject({ allowed: true }));
  it("paywalls a new Intro completion when the free account has used both lessons", () => expect(decideLessonAccess({ lessonId: "intro", userId: "u", completedLessonIds: ["sum", "count"] })).toEqual({ allowed: false, reason: "paywall" }));
  it("allows Intro as a replay when it is already complete at the limit", () => expect(decideLessonAccess({ lessonId: "intro", userId: "u", completedLessonIds: ["intro", "sum"] })).toEqual({ allowed: true, reason: "ok" }));
  it("returns a stable response shape for paywall decisions", () => expect(Object.keys(decideLessonAccess({ lessonId: "count", userId: "u", completedLessonIds: ["intro", "sum"] })).sort()).toEqual(["allowed", "reason"]));
  it("uses distinct ids even when the current lesson is missing from prior completions", () => expect(decideLessonAccess({ lessonId: "lookup", userId: "u", completedLessonIds: ["intro", "sum"] })).toMatchObject({ reason: "paywall" }));
});
