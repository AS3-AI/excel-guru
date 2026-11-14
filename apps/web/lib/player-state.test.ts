import { describe, expect, it } from "vitest";
import { createPlayerState, playerReducer } from "./player-state";

const start = () => createPlayerState(5, 3);
const act = (state: ReturnType<typeof start>, action: Parameters<typeof playerReducer>[1]) => playerReducer(state, action);

describe("player state", () => {
  it("starts at step zero with empty counters", () => { expect(start()).toMatchObject({ index: 0, visit: 0, correct: 0, wrongCount: 0, attempts: [], firstTry: {} }); });
  it("counts each step once and locks first try on its first answer", () => {
    let state = start();
    state = act(state, { type: "answer", stepId: "s1", input: "bad", correct: false });
    state = act(state, { type: "continue" });
    state = act(state, { type: "answer", stepId: "s2", input: "ok", correct: true });
    state = act(state, { type: "continue" });
    state = act(state, { type: "previous" });
    state = act(state, { type: "answer", stepId: "s2", input: "ok again", correct: true });
    expect(state.correct).toBe(1);
    expect(state.firstTry).toEqual({ s1: false, s2: true });
  });
  it("requires a wrong answer before Show Answer and resets step state on navigation", () => {
    let state = start();
    state = act(state, { type: "show-answer" });
    expect(state.showedAnswer).toBe(false);
    state = act(state, { type: "answer", stepId: "s1", input: "bad", correct: false });
    state = act(state, { type: "show-answer" });
    expect(state.showedAnswer).toBe(true);
    state = act(state, { type: "continue" });
    expect(state).toMatchObject({ wrongCount: 0, showedAnswer: false, visit: 1 });
  });
  it("resets wrong count on skip, previous and continue, and does nothing at first Previous", () => {
    let state = start();
    expect(act(state, { type: "previous" })).toBe(state);
    state = act(state, { type: "answer", stepId: "s1", input: "bad", correct: false });
    state = act(state, { type: "skip" });
    expect(state).toMatchObject({ wrongCount: 0, visit: 1, firstTry: { s1: false } });
    state = act(state, { type: "answer", stepId: "s2", input: "bad", correct: false });
    state = act(state, { type: "previous" });
    expect(state).toMatchObject({ wrongCount: 0, visit: 2 });
    state = act(state, { type: "answer", stepId: "s1", input: "bad", correct: false });
    state = act(state, { type: "continue" });
    expect(state.wrongCount).toBe(0);
  });
  it("cycles lessons of three or fewer steps to step zero", () => {
    for (const count of [1, 2, 3]) {
      let state = createPlayerState(count, 99);
      for (let i = 0; i < count; i++) state = act(state, { type: "skip" });
      expect(state.index).toBe(0);
    }
  });
  it("does not count skips as correct", () => {
    expect(act(start(), { type: "skip" }).correct).toBe(0);
  });
  it("wrong answers increase the current wrong count", () => {
    let s = act(start(), { type: "answer", stepId: "s1", input: "a", correct: false });
    s = act(s, { type: "answer", stepId: "s1", input: "b", correct: false });
    expect(s.wrongCount).toBe(2);
  });
  it("Show Answer remains unavailable after a correct answer", () => {
    let s = act(start(), { type: "answer", stepId: "s1", input: "a", correct: true });
    expect(act(s, { type: "show-answer" })).toBe(s);
  });
  it("a wrong answer followed by Skip remains a first try miss", () => {
    let s = act(start(), { type: "answer", stepId: "s1", input: "a", correct: false });
    s = act(s, { type: "skip" });
    expect(s.firstTry.s1).toBe(false);
  });
  it("repeated wrong answers do not change the first try result", () => {
    let s = act(start(), { type: "answer", stepId: "s1", input: "a", correct: false });
    s = act(s, { type: "answer", stepId: "s1", input: "b", correct: false });
    expect(s.firstTry.s1).toBe(false);
  });
  it("a first correct answer after Show Answer is not first try", () => {
    let s = act(start(), { type: "answer", stepId: "s1", input: "wrong", correct: false });
    s = act(s, { type: "show-answer" });
    s = act(s, { type: "answer", stepId: "s1", input: "solution", correct: true });
    expect(s.firstTry.s1).toBe(false);
    expect(s.correct).toBe(1);
  });
  it("does not add a successful Previous revisit twice", () => {
    let s = act(start(), { type: "answer", stepId: "s1", input: "a", correct: true });
    s = act(s, { type: "continue" }); s = act(s, { type: "previous" });
    s = act(s, { type: "answer", stepId: "s1", input: "a", correct: true });
    expect(s.correct).toBe(1);
  });
  it("counts a correct answer again after cycling through the lesson", () => {
    let s = createPlayerState(5, 3);
    s = act(s, { type: "skip" }); s = act(s, { type: "skip" }); s = act(s, { type: "skip" });
    s = act(s, { type: "answer", stepId: "s4", input: "x", correct: true });
    s = act(s, { type: "continue" });
    s = act(s, { type: "answer", stepId: "s5", input: "x", correct: true });
    s = act(s, { type: "continue" });
    s = act(s, { type: "answer", stepId: "s4", input: "x", correct: true });
    expect(s.complete).toBe(true);
    expect(s.correct).toBe(3);
  });
  it("Previous records a visit and returns through the actual visit history", () => {
    let s = start(); s = act(s, { type: "skip" }); s = act(s, { type: "skip" });
    expect(s.index).toBe(2); s = act(s, { type: "previous" });
    expect(s).toMatchObject({ index: 1, visit: 3 });
  });
  it("Previous after cycling returns to the step before the cycle", () => {
    let s = createPlayerState(5, 99);
    for (let i = 0; i < 5; i++) s = act(s, { type: "skip" });
    expect(s.index).toBe(3); s = act(s, { type: "previous" });
    expect(s.index).toBe(4);
  });
  it("Continue after a wrong attempt resets wrongCount", () => {
    let s = act(start(), { type: "answer", stepId: "s1", input: "x", correct: false });
    s = act(s, { type: "continue" }); expect(s.wrongCount).toBe(0);
  });
  it("Skip resets Show Answer as well as wrongCount", () => {
    let s = act(start(), { type: "answer", stepId: "s1", input: "x", correct: false });
    s = act(s, { type: "show-answer" }); s = act(s, { type: "skip" });
    expect(s).toMatchObject({ showedAnswer: false, wrongCount: 0 });
  });
  it("Previous resets Show Answer", () => {
    let s = act(start(), { type: "skip" }); s = act(s, { type: "answer", stepId: "s2", input: "x", correct: false });
    s = act(s, { type: "show-answer" }); s = act(s, { type: "previous" });
    expect(s.showedAnswer).toBe(false);
  });
  it("Continue increments visit exactly once", () => { expect(act(start(), { type: "continue" }).visit).toBe(1); });
  it("Skip increments visit exactly once", () => { expect(act(start(), { type: "skip" }).visit).toBe(1); });
  it("Previous increments visit exactly once", () => { let s = act(start(), { type: "skip" }); expect(act(s, { type: "previous" }).visit).toBe(2); });
  it("completion is reached at the required number of distinct correct steps", () => {
    let s = createPlayerState(5, 2); s = act(s, { type: "answer", stepId: "s1", input: "x", correct: true });
    s = act(s, { type: "answer", stepId: "s1", input: "x", correct: true }); expect(s.complete).toBe(false);
    s = act(s, { type: "answer", stepId: "s2", input: "x", correct: true }); expect(s.complete).toBe(true);
  });
  it("wrong attempts are kept in chronological order", () => {
    let s = start(); s = act(s, { type: "answer", stepId: "s1", input: "1", correct: false });
    s = act(s, { type: "answer", stepId: "s1", input: "2", correct: true });
    expect(s.attempts.map((a) => a.input)).toEqual(["1", "2"]);
  });
  it("Show Answer records true only on later attempts", () => {
    let s = act(start(), { type: "answer", stepId: "s1", input: "1", correct: false });
    s = act(s, { type: "show-answer" }); s = act(s, { type: "answer", stepId: "s1", input: "2", correct: false });
    expect(s.attempts.map((a) => a.showedAnswer)).toEqual([false, true]);
  });
  it("cycling from a lesson with four or more steps uses index three", () => {
    let s = createPlayerState(4, 99); for (let i = 0; i < 4; i++) s = act(s, { type: "skip" });
    expect(s.index).toBe(3);
  });
  it("ignores all actions after completion", () => {
    let state = createPlayerState(2, 1);
    state = act(state, { type: "answer", stepId: "s1", input: "ok", correct: true });
    for (const action of [{ type: "answer", stepId: "s1", input: "again", correct: true }, { type: "continue" }, { type: "skip" }, { type: "previous" }] as const) {
      expect(act(state, action)).toBe(state);
    }
  });
  it("records attempts in order and marks answers after Show Answer", () => {
    let state = start();
    state = act(state, { type: "answer", stepId: "s1", input: "wrong", correct: false });
    state = act(state, { type: "show-answer" });
    state = act(state, { type: "answer", stepId: "s1", input: "solution", correct: true });
    expect(state.attempts).toEqual([
      { stepId: "s1", input: "wrong", showedAnswer: false },
      { stepId: "s1", input: "solution", showedAnswer: true },
    ]);
    expect(state.correct).toBe(1);
    expect(state.showedAnswer).toBe(true);
  });

  it("skip advances without recording an attempt; Previous returns to the prior visit", () => {
    let state = start();
    state = act(state, { type: "skip" });
    expect(state.index).toBe(1);
    expect(state.attempts).toEqual([]);
    state = act(state, { type: "previous" });
    expect(state.index).toBe(0);
  });

  it("cycles from step four and completes after required correct answers", () => {
    let state = start();
    state = act(state, { type: "answer", stepId: "s1", input: "x", correct: true });
    state = act(state, { type: "continue" });
    state = act(state, { type: "skip" });
    state = act(state, { type: "skip" });
    state = act(state, { type: "skip" });
    state = act(state, { type: "skip" });
    expect(state.index).toBe(3);
    state = act(state, { type: "answer", stepId: "s4", input: "x", correct: true });
    state = act(state, { type: "continue" });
    state = act(state, { type: "answer", stepId: "s5", input: "x", correct: true });
    expect(state.complete).toBe(true);
  });
});
