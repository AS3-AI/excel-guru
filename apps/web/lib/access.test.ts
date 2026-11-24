import { describe, expect, it, vi } from "vitest";
import { decideLessonAccess, loadLessonAccess, recordLessonOpen, decideAndRecordLessonOpen } from "./access";

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

describe("opened lesson access", () => {
  it("counts opened lessons toward the two lesson free limit", () => {
    expect(decideLessonAccess({ lessonId: "third", userId: "u", completedLessonIds: [], openedLessonIds: ["intro", "sum"] })).toEqual({ allowed: false, reason: "paywall" });
  });

  it("allows a replay of an opened lesson at the limit", () => {
    expect(decideLessonAccess({ lessonId: "sum", userId: "u", completedLessonIds: [], openedLessonIds: ["intro", "sum"] })).toEqual({ allowed: true, reason: "ok" });
  });

  it("unions opened and completed ids without double counting", () => {
    expect(decideLessonAccess({ lessonId: "third", userId: "u", completedLessonIds: ["intro"], openedLessonIds: ["intro", "sum"] })).toEqual({ allowed: false, reason: "paywall" });
  });

  it("allows a new lesson with zero or one used lesson", () => {
    expect(decideLessonAccess({ lessonId: "sum", userId: "u", completedLessonIds: [], openedLessonIds: [] })).toMatchObject({ allowed: true });
    expect(decideLessonAccess({ lessonId: "sum", userId: "u", completedLessonIds: [], openedLessonIds: ["intro"] })).toMatchObject({ allowed: true });
  });

  it("keeps signed out, premium, and group premium rules unchanged", () => {
    expect(decideLessonAccess({ lessonId: "sum", userId: null, completedLessonIds: [], openedLessonIds: ["intro"] })).toMatchObject({ reason: "signup" });
    expect(decideLessonAccess({ lessonId: "third", userId: "u", completedLessonIds: [], openedLessonIds: ["intro", "sum"], premium: true })).toMatchObject({ allowed: true });
    expect(decideLessonAccess({ lessonId: "third", userId: "u", completedLessonIds: [], openedLessonIds: ["intro", "sum"], groupPremium: true })).toMatchObject({ allowed: true });
  });
});

describe("recording lesson opens", () => {
  it("uses an idempotent upsert for the user and lesson", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const admin = { from: vi.fn(() => ({ upsert })) };
    await recordLessonOpen(admin as never, "u", "sum");
    expect(admin.from).toHaveBeenCalledWith("lesson_opens");
    expect(upsert).toHaveBeenCalledWith({ user_id: "u", lesson_id: "sum" }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
  });

  it("does not throw when recording fails", async () => {
    const upsert = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const admin = { from: vi.fn(() => ({ upsert })) };
    await expect(recordLessonOpen(admin as never, "u", "sum")).resolves.toBe(false);
  });

  it("returns false when Supabase returns an error", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: new Error("database unavailable") });
    const admin = { from: vi.fn(() => ({ upsert })) };
    await expect(recordLessonOpen(admin as never, "u", "sum")).resolves.toBe(false);
  });

  it("decides before recording and records only allowed free page opens", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const admin = { from: vi.fn(() => ({ upsert })) };
    for (const input of [
      { userId: null, lessonId: "sum", completedLessonIds: [], openedLessonIds: [] },
      { userId: "u", lessonId: "sum", completedLessonIds: [], openedLessonIds: [], premium: true },
      { userId: "u", lessonId: "sum", completedLessonIds: [], openedLessonIds: [], groupPremium: true },
      { userId: "u", lessonId: "third", completedLessonIds: ["intro", "sum"], openedLessonIds: [] },
    ]) {
      await decideAndRecordLessonOpen({ admin: admin as never, ...input });
    }
    expect(upsert).not.toHaveBeenCalled();
    await decideAndRecordLessonOpen({ admin: admin as never, userId: "u", lessonId: "sum", completedLessonIds: ["intro"], openedLessonIds: [] });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("throws temporarily unavailable after failed logging when another lesson is already used", async () => {
    const admin = { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({ error: new Error("offline") }) })) };
    await expect(decideAndRecordLessonOpen({ admin: admin as never, userId: "u", lessonId: "sum", completedLessonIds: [], openedLessonIds: ["intro"] })).rejects.toThrow("temporarily unavailable");
  });

  it("allows failed logging for the first used lesson and for replays", async () => {
    const admin = { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({ error: new Error("offline") }) })) };
    await expect(decideAndRecordLessonOpen({ admin: admin as never, userId: "u", lessonId: "sum", completedLessonIds: [], openedLessonIds: [] })).resolves.toMatchObject({ allowed: true });
    await expect(decideAndRecordLessonOpen({ admin: admin as never, userId: "u", lessonId: "intro", completedLessonIds: ["intro"], openedLessonIds: [] })).resolves.toMatchObject({ allowed: true });
  });

  it("loads opens with select only and never writes to lesson_opens", async () => {
    const calls: string[] = [];
    const openWrites = vi.fn();
    const admin = { from: vi.fn((table: string) => {
      calls.push(table);
      const result = table === "profiles" ? { data: null, error: null } : { data: [], error: null };
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
        insert: openWrites,
        upsert: openWrites,
      };
      return builder;
    }) };
    await loadLessonAccess(admin as never, "u", "intro");
    expect(calls).toContain("lesson_opens");
    expect(calls.filter((table) => table === "lesson_opens")).toHaveLength(1);
    expect(openWrites).not.toHaveBeenCalled();
  });

  it("lets an invited learner past the two-lesson limit", async () => {
    const rows: Record<string, unknown> = {
      profiles: { group_id: null, invited: true },
      lesson_progress: [{ lesson_id: "intro" }, { lesson_id: "sum" }],
      lesson_opens: [],
      subscriptions: [],
    };
    const admin = { from: vi.fn((table: string) => {
      const result = { data: rows[table], error: null };
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    }) };
    const access = await loadLessonAccess(admin as never, "u", "count");
    expect(access.invited).toBe(true);
    expect(access.decision).toEqual({ allowed: true, reason: "ok" });
    rows.profiles = { group_id: null, invited: false };
    expect((await loadLessonAccess(admin as never, "u", "count")).decision.reason).toBe("paywall");
  });

  it("keeps progress merge under two used lessons for a free learner", () => {
    const used = ["intro"];
    const candidates = ["sum", "count", "lookup"];
    for (const lessonId of candidates) {
      if (decideLessonAccess({ lessonId, userId: "u", completedLessonIds: used, openedLessonIds: [] }).allowed) used.push(lessonId);
    }
    expect(used).toHaveLength(2);
  });
});
