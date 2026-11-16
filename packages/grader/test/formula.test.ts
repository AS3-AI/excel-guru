import { describe, expect, it } from "vitest";
import { gradeFormulaStep, type FormulaStep, type GradeResult, type Lesson, type Step } from "../src/index";

const grid = [
  ["Item", "Qty"],
  ["Pens", 12],
  ["Tape", 5],
  ["Clips", 40],
];

const step = (over: Partial<FormulaStep> = {}): FormulaStep => ({
  id: "s1",
  type: "formula",
  prompt: "Total B2:B4 in C2.",
  grid,
  targetCell: "C2",
  expectedValue: 57,
  solution: "=SUM(B2:B4)",
  ...over,
});

const pass: GradeResult = { correct: true };
const fail = (reason: GradeResult["reason"]): GradeResult => ({ correct: false, reason });

// The Product spec §5 example, verbatim in shape: it must typecheck as a Lesson.
const countLesson = {
  id: "count-1", module: "count", title: "COUNT Function",
  difficulty: 1, requiredCorrect: 6, isIntro: false, video: null,
  steps: [
    { id: "s1", type: "select", prompt: "Click cell B2.",
      grid: [["Item", "Qty"], ["Pens", 12], ["Tape", "n/a"], ["Clips", 40], ["Glue", 7], ["Ink", 3]], target: "B2" },
    { id: "s2", type: "formula", prompt: "In C2, count the numbers in B2:B6.",
      grid: [["Item", "Qty"], ["Pens", 12], ["Tape", "n/a"], ["Clips", 40], ["Glue", 7], ["Ink", 3]],
      targetCell: "C2", expectedValue: 4, mustUse: ["COUNT"], solution: "=COUNT(B2:B6)",
      explain: "COUNT counts cells that hold numbers, so the text in B3 is skipped.",
      highlightCells: ["B2:B6"], mobileButtons: ["(", ")", ":"] },
    { id: "s3", type: "shortcut", mode: "chord", prompt: "Extend the selection one cell right.",
      keys: { win: "Shift+ArrowRight", mac: "Shift+ArrowRight" }, activeCell: "B2",
      postcondition: { selection: "B2:C2" } },
    { id: "s4", type: "shortcut", mode: "sequence", prompt: "Make the text bold with key tips.",
      keys: { win: ["Alt", "H", "1"], mac: null }, pics: ["r0.png", "r1.png", "r2.png", "r3.png"] },
    { id: "s5", type: "mcq", prompt: "Which function counts only cells that contain numbers?",
      options: ["COUNTA", "COUNT", "COUNTBLANK"], answer: 1 },
    { id: "s6", type: "picture", prompt: "Which function is shown?", image: "q.png", accept: ["sumif"] },
    { id: "s7", type: "project", prompt: "What is the total in cell F20?", file: "dataset.xlsx", accept: ["1840"] },
    { id: "s8", type: "info", text: "COUNT ignores text and blanks." },
  ],
} satisfies Lesson;

const countStep = countLesson.steps[1] as FormulaStep;

describe("gradeFormulaStep: Done-when cases", () => {
  it("grades TODAY against the lesson's fixed date", () => {
    expect(gradeFormulaStep(step({ grid: [], expectedValue: 46037 }), "=TODAY()")).toEqual(pass);
  });
  it("=SUM(B2:B4) passes a step with no mustUse", () => {
    expect(gradeFormulaStep(step(), "=SUM(B2:B4)")).toEqual(pass);
  });

  it("=B2+B3+B4 passes a step with no mustUse", () => {
    expect(gradeFormulaStep(step(), "=B2+B3+B4")).toEqual(pass);
  });

  it("=B2+B3+B4 passes a step with an empty mustUse", () => {
    expect(gradeFormulaStep(step({ mustUse: [] }), "=B2+B3+B4")).toEqual(pass);
  });

  it("=B2+B3+B4 fails with missing_function when mustUse is [SUM]", () => {
    expect(gradeFormulaStep(step({ mustUse: ["SUM"] }), "=B2+B3+B4")).toEqual(fail("missing_function"));
  });

  it("the Product spec §5 COUNT step passes with =COUNT(B2:B6)", () => {
    expect(gradeFormulaStep(countStep, "=COUNT(B2:B6)")).toEqual(pass);
  });

  it("the COUNT step's own solution passes", () => {
    expect(gradeFormulaStep(countStep, countStep.solution)).toEqual(pass);
  });

  it('"SUM(B2:B6)" is not_formula', () => {
    expect(gradeFormulaStep(countStep, "SUM(B2:B6)")).toEqual(fail("not_formula"));
  });

  it('"=SUM(" is parse_error', () => {
    expect(gradeFormulaStep(countStep, "=SUM(")).toEqual(fail("parse_error"));
  });

  it("=0.1+0.2 matches expectedValue 0.3", () => {
    expect(gradeFormulaStep(step({ expectedValue: 0.3 }), "=0.1+0.2")).toEqual(pass);
  });

  it('"=1/0" matches expectedValue {error: "#DIV/0!"}', () => {
    expect(gradeFormulaStep(step({ expectedValue: { error: "#DIV/0!" } }), "=1/0")).toEqual(pass);
  });
});

describe("gradeFormulaStep: grading order", () => {
  it("not_formula for a plain number, even if it equals expectedValue", () => {
    expect(gradeFormulaStep(step(), "57")).toEqual(fail("not_formula"));
  });

  it("not_formula for empty input", () => {
    expect(gradeFormulaStep(step(), "")).toEqual(fail("not_formula"));
  });

  it("not_formula for leading whitespace before =", () => {
    expect(gradeFormulaStep(step(), " =SUM(B2:B4)")).toEqual(fail("not_formula"));
  });

  it("parse_error for a tokenize error (unterminated string)", () => {
    expect(gradeFormulaStep(step(), '="abc')).toEqual(fail("parse_error"));
  });

  it("parse_error for a bare =", () => {
    expect(gradeFormulaStep(step(), "=")).toEqual(fail("parse_error"));
  });

  it("parse_error comes before missing_function", () => {
    expect(gradeFormulaStep(step({ mustUse: ["SUM"] }), "=B2+")).toEqual(fail("parse_error"));
  });

  it("wrong_value when the result differs", () => {
    expect(gradeFormulaStep(step(), "=SUM(B2:B3)")).toEqual(fail("wrong_value"));
  });

  it("wrong_value comes before missing_function", () => {
    expect(gradeFormulaStep(step({ mustUse: ["SUM"] }), "=B2+B3")).toEqual(fail("wrong_value"));
  });

  it("missing_function when only one of several mustUse names is used", () => {
    const s = step({ expectedValue: 57, mustUse: ["SUM", "ROUND"] });
    expect(gradeFormulaStep(s, "=SUM(B2:B4)")).toEqual(fail("missing_function"));
    expect(gradeFormulaStep(s, "=ROUND(SUM(B2:B4),0)")).toEqual(pass);
  });

  it("a nested function counts towards mustUse", () => {
    expect(gradeFormulaStep(step({ mustUse: ["SUM"] }), "=ABS(SUM(B2:B4))")).toEqual(pass);
  });
});

describe("gradeFormulaStep: mustUse is case-insensitive", () => {
  it("lower-case input matches upper-case mustUse", () => {
    expect(gradeFormulaStep(step({ mustUse: ["SUM"] }), "=sum(B2:B4)")).toEqual(pass);
  });

  it("lower-case mustUse matches upper-case input", () => {
    expect(gradeFormulaStep(step({ mustUse: ["sum"] }), "=SUM(B2:B4)")).toEqual(pass);
  });

  it("mixed case on both sides", () => {
    expect(gradeFormulaStep(step({ mustUse: ["Sum"] }), "=sUm(B2:B4)")).toEqual(pass);
  });
});

describe("gradeFormulaStep: value compare", () => {
  it("numbers within 1e-9 match", () => {
    expect(gradeFormulaStep(step({ expectedValue: 1 }), "=1+0.0000000001")).toEqual(pass);
  });

  it("numbers further apart than 1e-9 do not match", () => {
    expect(gradeFormulaStep(step({ expectedValue: 1 }), "=1+0.00000001")).toEqual(fail("wrong_value"));
  });

  it("strings match exactly", () => {
    expect(gradeFormulaStep(step({ expectedValue: "PensTape" }), "=A2&A3")).toEqual(pass);
  });

  it("strings are case-sensitive", () => {
    expect(gradeFormulaStep(step({ expectedValue: "penstape" }), "=A2&A3")).toEqual(fail("wrong_value"));
  });

  it("booleans match exactly", () => {
    expect(gradeFormulaStep(step({ expectedValue: true }), "=B4>B2")).toEqual(pass);
    expect(gradeFormulaStep(step({ expectedValue: false }), "=B4>B2")).toEqual(fail("wrong_value"));
  });

  it("errors compare by code", () => {
    expect(gradeFormulaStep(step({ expectedValue: { error: "#N/A" } }), "=1/0")).toEqual(fail("wrong_value"));
  });

  it("an error result never matches a number", () => {
    expect(gradeFormulaStep(step({ expectedValue: 0 }), "=1/0")).toEqual(fail("wrong_value"));
  });

  it("number vs numeric string is a type mismatch", () => {
    expect(gradeFormulaStep(step({ expectedValue: "57" }), "=SUM(B2:B4)")).toEqual(fail("wrong_value"));
    expect(gradeFormulaStep(step({ expectedValue: 57 }), '="57"')).toEqual(fail("wrong_value"));
  });

  it("boolean vs number is a type mismatch", () => {
    expect(gradeFormulaStep(step({ expectedValue: 1 }), "=TRUE")).toEqual(fail("wrong_value"));
    expect(gradeFormulaStep(step({ expectedValue: true }), "=1")).toEqual(fail("wrong_value"));
  });

  it("a reference to an empty cell is 0, as in Excel, and not an empty string", () => {
    expect(gradeFormulaStep(step({ expectedValue: 0 }), "=D9")).toEqual(pass);
    expect(gradeFormulaStep(step({ expectedValue: "" }), "=D9")).toEqual(fail("wrong_value"));
  });

  it("an empty string does not match null", () => {
    expect(gradeFormulaStep(step({ expectedValue: null }), '=""')).toEqual(fail("wrong_value"));
  });
});

describe("gradeFormulaStep: isolation", () => {
  it("does not mutate the step's grid", () => {
    const s = step();
    const before = JSON.stringify(s.grid);
    gradeFormulaStep(s, "=SUM(B2:B4)");
    expect(JSON.stringify(s.grid)).toBe(before);
  });

  it("grades each call on a fresh sheet", () => {
    const s = step();
    expect(gradeFormulaStep(s, "=SUM(B2:B3)")).toEqual(fail("wrong_value"));
    expect(gradeFormulaStep(s, "=SUM(B2:B4)")).toEqual(pass);
  });
});

describe("lesson types", () => {
  it("the Product spec §5 example is a Lesson with every step type", () => {
    const steps: Step[] = countLesson.steps;
    expect(steps.map((s) => s.type)).toEqual([
      "select", "formula", "shortcut", "shortcut", "mcq", "picture", "project", "info",
    ]);
  });
});
