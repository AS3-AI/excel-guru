import { describe, expect, it } from "vitest";
import { gradeEntryInput, gradeEntryStep, type EntryStep } from "../src/index";

const budget = [
  ["Expense", "Amount"],
  ["Rent", 1200],
  ["Groceries", 350],
  ["Total", "=SUM(B2:B3)"],
];

const entry = (
  expect: EntryStep["expect"],
  grid: EntryStep["grid"] = [["Expense", "Amount"]],
): EntryStep => ({
  id: "s",
  type: "entry",
  prompt: "Type.",
  grid,
  expect,
});

describe("gradeEntryStep", () => {
  it("accepts text typed into the expected cell", () => {
    expect(gradeEntryStep(entry({ A2: "Rent" }), { A2: "Rent" })).toEqual({ correct: true });
  });

  it("matches text ignoring case and outer spaces", () => {
    expect(gradeEntryStep(entry({ A2: "Rent" }), { A2: "  rENT " }).correct).toBe(true);
  });

  it("accepts a number typed as digits", () => {
    expect(gradeEntryStep(entry({ B2: 1200 }), { B2: "1200" }).correct).toBe(true);
  });

  it("reports an untouched expected cell as empty", () => {
    expect(gradeEntryStep(entry({ A2: "Rent" }), {})).toEqual({
      correct: false,
      cell: "A2",
      reason: "empty",
    });
  });

  it("reports a number typed with words or commas as text", () => {
    expect(gradeEntryStep(entry({ B2: 1200 }), { B2: "1,200 rs" })).toEqual({
      correct: false,
      cell: "B2",
      reason: "text_not_number",
    });
  });

  it("reports a different value as wrong", () => {
    expect(gradeEntryStep(entry({ B2: 1200 }), { B2: "1300" })).toEqual({
      correct: false,
      cell: "B2",
      reason: "wrong_value",
    });
    expect(gradeEntryStep(entry({ A2: "Rent" }), { A2: "Rnt" }).reason).toBe("wrong_value");
  });

  it("needs every expected cell, and names the first one that is off", () => {
    const step = entry({ A3: "Groceries", B3: 350 });
    expect(gradeEntryStep(step, { A3: "Groceries" })).toEqual({
      correct: false,
      cell: "B3",
      reason: "empty",
    });
    expect(gradeEntryStep(step, { A3: "Groceries", B3: "350" }).correct).toBe(true);
  });

  it("checks formula results after the learner's change", () => {
    const step = entry({ B2: 1500, B4: 1850 }, budget);
    expect(gradeEntryStep(step, { B2: "1500" }).correct).toBe(true);
    // Overwriting the total with a typed number breaks the live formula's purpose but still shows the value;
    // the cell must still show the expected result, so a stale total fails.
    expect(gradeEntryStep(step, { B2: "1500", B4: "1550" })).toMatchObject({
      cell: "B4",
      reason: "wrong_value",
    });
  });

  it("ignores edits to cells it does not check", () => {
    expect(gradeEntryStep(entry({ A2: "Rent" }), { A2: "Rent", D9: "hello" }).correct).toBe(true);
  });

  it("ignores malformed addresses and formulas that do not parse", () => {
    expect(
      gradeEntryStep(entry({ A2: "Rent" }), { A2: "Rent", "not a cell": "x", C1: "=SUM(" }).correct,
    ).toBe(true);
  });

  it("treats a cleared cell as empty", () => {
    expect(gradeEntryStep(entry({ B2: 1500 }, budget), { B2: "" })).toMatchObject({
      reason: "empty",
    });
  });
});

describe("gradeEntryInput", () => {
  it("grades the JSON the player sends", () => {
    expect(gradeEntryInput(entry({ A2: "Rent" }), JSON.stringify({ A2: "Rent" })).correct).toBe(
      true,
    );
  });

  it.each(["", "not json", "[]", "null", '"A2"', JSON.stringify({ A2: 5 })])(
    "treats %j as no edits",
    (input) => {
      expect(gradeEntryInput(entry({ A2: "Rent" }), input)).toMatchObject({
        correct: false,
        reason: "empty",
      });
    },
  );

  it("refuses an oversized edit list", () => {
    const edits = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`A${i + 1}`, "Rent"]));
    expect(gradeEntryInput(entry({ A2: "Rent" }), JSON.stringify(edits)).correct).toBe(false);
  });
});
