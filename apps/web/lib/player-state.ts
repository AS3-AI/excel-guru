export type PlayerAttempt = { stepId: string; input: string; showedAnswer: boolean };
export type PlayerState = {
  stepCount: number;
  requiredCorrect: number;
  index: number;
  visit: number;
  correct: number;
  /** First attempt outcome by step id; a skipped step is false only if it was already answered wrong. */
  firstTry: Record<string, boolean>;
  correctSteps: string[];
  attempts: PlayerAttempt[];
  wrongCount: number;
  showedAnswer: boolean;
  complete: boolean;
  history: number[];
  previousReturn: boolean;
  correctVisit: Record<string, number>;
};
export type PlayerAction =
  | { type: "answer"; stepId: string; input: string; correct: boolean }
  | { type: "show-answer" }
  | { type: "skip" | "continue" | "previous" };

export function createPlayerState(stepCount: number, requiredCorrect: number): PlayerState {
  return { stepCount, requiredCorrect, index: 0, visit: 0, correct: 0, firstTry: {}, correctSteps: [], attempts: [], wrongCount: 0, showedAnswer: false, complete: false, history: [], previousReturn: false, correctVisit: {} };
}
export function playerReducer(raw: PlayerState, action: PlayerAction): PlayerState {
  const state = raw;
  if (state.complete) return state;
  if (action.type === "show-answer") return state.wrongCount > 0 ? { ...state, showedAnswer: true } : state;
  if (action.type === "answer") {
    const attempts = [...state.attempts, { stepId: action.stepId, input: action.input, showedAnswer: state.showedAnswer }];
    const firstTry = Object.hasOwn(state.firstTry, action.stepId) ? state.firstTry : { ...state.firstTry, [action.stepId]: action.correct && !state.showedAnswer };
    const addsCorrect = action.correct && state.correctVisit[action.stepId] !== state.visit && (!state.previousReturn || state.correctVisit[action.stepId] === undefined);
    const correctSteps = action.correct && !state.correctSteps.includes(action.stepId) ? [...state.correctSteps, action.stepId] : state.correctSteps;
    const correctVisit = addsCorrect ? { ...state.correctVisit, [action.stepId]: state.visit } : state.correctVisit;
    const correct = state.correct + Number(addsCorrect);
    return { ...state, attempts, firstTry, correctSteps, correctVisit, correct, wrongCount: action.correct ? state.wrongCount : state.wrongCount + 1, complete: correct >= state.requiredCorrect };
  }
  if (action.type === "previous") {
    if (!state.history.length) return state;
    const history = state.history.slice(0, -1);
    return { ...state, index: state.history[state.history.length - 1]!, history, visit: state.visit + 1, wrongCount: 0, showedAnswer: false, previousReturn: true };
  }
  const next = state.index + 1 < state.stepCount ? state.index + 1 : state.stepCount > 3 ? 3 : 0;
  return { ...state, index: next, history: [...state.history, state.index], visit: state.visit + 1, wrongCount: 0, showedAnswer: false, previousReturn: false };
}
