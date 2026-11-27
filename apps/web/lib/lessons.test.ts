import { describe, expect, it } from "vitest";
import {
  CYCLE_FROM,
  getLesson,
  getOrder,
  getSyllabus,
  nextInOrder,
  nextLessonId,
  nextStepIndex,
  stepSequence,
} from "./lessons";

describe("getLesson", () => {
  it("loads the intro lesson from content/", () => {
    const lesson = getLesson("intro");
    expect(lesson?.id).toBe("intro");
    expect(lesson?.title).toBeTruthy();
    expect(lesson?.steps.length).toBeGreaterThan(0);
    expect(lesson?.requiredCorrect).toBeGreaterThan(0);
  });

  it.each(["no-such-lesson", "", "../order", "intro/../intro", "INTRO", "intro.json"])(
    "returns null for %j",
    (id) => {
      expect(getLesson(id)).toBeNull();
    },
  );
});

describe("getOrder", () => {
  it("reads content/order.json", () => {
    const order = getOrder();
    expect(order[0]).toBe("intro");
    expect(order.every((id) => typeof id === "string")).toBe(true);
  });
});

describe("nextInOrder / nextLessonId", () => {
  const order = ["intro", "sum-1", "count-1"];

  it("returns the following lesson", () => {
    expect(nextInOrder(order, "intro")).toBe("sum-1");
    expect(nextInOrder(order, "sum-1")).toBe("count-1");
  });

  it("returns null after the last lesson or for an unknown id", () => {
    expect(nextInOrder(order, "count-1")).toBeNull();
    expect(nextInOrder(order, "nope")).toBeNull();
  });

  it("follows content/order.json", () => {
    const real = getOrder();
    real.forEach((id, i) => expect(nextLessonId(id)).toBe(real[i + 1] ?? null));
    expect(nextLessonId("no-such-lesson")).toBeNull();
  });
});

describe("nextStepIndex (decision 19: cycle from step 4)", () => {
  it("is step 4 (index 3)", () => {
    expect(CYCLE_FROM).toBe(3);
  });

  it("moves to the next step while there is one", () => {
    expect(nextStepIndex(0, 5)).toBe(1);
    expect(nextStepIndex(3, 5)).toBe(4);
  });

  it("picks step 4 after the last step", () => {
    expect(nextStepIndex(4, 5)).toBe(3);
    expect(nextStepIndex(9, 10)).toBe(3);
  });

  it("with exactly 4 steps, repeats step 4", () => {
    expect(nextStepIndex(3, 4)).toBe(3);
  });

  it("with fewer than 4 steps, cycles from the first step", () => {
    expect(nextStepIndex(2, 3)).toBe(0);
    expect(nextStepIndex(0, 1)).toBe(0);
  });

  it("stepSequence is the lookup table the player follows", () => {
    expect(stepSequence(5)).toEqual([1, 2, 3, 4, 3]);
    expect(stepSequence(2)).toEqual([1, 0]);
    expect(stepSequence(0)).toEqual([]);
  });
});

describe("intro is completable", () => {
  it("reaches requiredCorrect formula answers by cycling", () => {
    const lesson = getLesson("intro")!;
    const next = stepSequence(lesson.steps.length);
    let i = 0;
    let correct = 0;
    for (let visits = 0; visits < 100 && correct < lesson.requiredCorrect; visits++) {
      if (lesson.steps[i]!.type === "formula") correct++;
      i = next[i]!;
    }
    expect(correct).toBe(lesson.requiredCorrect);
  });
});

describe("getSyllabus", () => {
  it("lists every lesson in order.json exactly once, in the same order, and only lessons that exist", () => {
    const ids = getSyllabus()
      .flatMap((level) => level.topics)
      .flatMap((topic) => (topic.lesson ? [topic.lesson] : []));
    expect(ids).toEqual(getOrder());
    for (const id of ids) expect(getLesson(id)).not.toBeNull();
  });
});
