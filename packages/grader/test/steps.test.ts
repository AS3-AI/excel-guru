import { describe, expect, it } from "vitest";
import {
  gradeAcceptStep,
  gradeMcqStep,
  gradeSelectStep,
  gradeSequenceStep,
  gradeShortcutStep,
  type McqStep,
  type PictureStep,
  type ProjectStep,
  type SelectStep,
  type ShortcutChordStep,
  type ShortcutSequenceStep,
} from "../src/index";

const grid = [
  ["a", "b", "c"],
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

const select = (target: string): SelectStep => ({ id: "s", type: "select", prompt: "Pick.", grid, target });

const chord = (win: string, mac: string | null): ShortcutChordStep => ({
  id: "s", type: "shortcut", mode: "chord", prompt: "Press.", keys: { win, mac },
});

const sequence = (win: string[], mac: string[] | null): ShortcutSequenceStep => ({
  id: "s", type: "shortcut", mode: "sequence", prompt: "Press.", keys: { win, mac },
});

const mcq: McqStep = { id: "s", type: "mcq", prompt: "Which?", options: ["SUM", "COUNT", "COUNTA"], answer: 1 };
const picture = (accept: string[]): PictureStep => ({ id: "s", type: "picture", prompt: "?", image: "q.png", accept });
const project = (accept: string[]): ProjectStep => ({ id: "s", type: "project", prompt: "?", file: "d.xlsx", accept });

describe("gradeShortcutStep", () => {
  const step = chord("Ctrl+Shift+ArrowDown", "Cmd+Shift+ArrowDown");

  it("accepts the Windows combo on win", () => {
    expect(gradeShortcutStep(step, "Ctrl+Shift+ArrowDown", "win")).toBe(true);
  });

  it("accepts the Mac combo on mac", () => {
    expect(gradeShortcutStep(step, "Cmd+Shift+ArrowDown", "mac")).toBe(true);
  });

  it("rejects the other OS's combo", () => {
    expect(gradeShortcutStep(step, "Cmd+Shift+ArrowDown", "win")).toBe(false);
    expect(gradeShortcutStep(step, "Ctrl+Shift+ArrowDown", "mac")).toBe(false);
  });

  it("rejects a missing or extra modifier", () => {
    expect(gradeShortcutStep(step, "Ctrl+ArrowDown", "win")).toBe(false);
    expect(gradeShortcutStep(step, "Ctrl+Alt+Shift+ArrowDown", "win")).toBe(false);
  });

  it("rejects the wrong key", () => {
    expect(gradeShortcutStep(step, "Ctrl+Shift+ArrowUp", "win")).toBe(false);
  });

  it("ignores modifier order and case in the pressed combo", () => {
    expect(gradeShortcutStep(step, "Shift+Ctrl+ArrowDown", "win")).toBe(true);
    expect(gradeShortcutStep(step, "ctrl+shift+arrowdown", "win")).toBe(true);
  });

  it("matches letters case-insensitively", () => {
    expect(gradeShortcutStep(chord("Ctrl+B", "Cmd+B"), "Ctrl+b", "win")).toBe(true);
  });

  it("returns false on mac when keys.mac is null", () => {
    const winOnly = chord("Ctrl+Shift+ArrowDown", null);
    expect(gradeShortcutStep(winOnly, "Ctrl+Shift+ArrowDown", "mac")).toBe(false);
    expect(gradeShortcutStep(winOnly, "Ctrl+Shift+ArrowDown", "win")).toBe(true);
  });

  it("rejects empty input and a bare modifier chord", () => {
    expect(gradeShortcutStep(step, "", "win")).toBe(false);
    expect(gradeShortcutStep(step, "Ctrl+Shift", "win")).toBe(false);
  });

  it("returns false for a sequence step", () => {
    expect(gradeShortcutStep(sequence(["Alt"], null), "Alt", "win")).toBe(false);
  });
});

describe("gradeSequenceStep", () => {
  const step = sequence(["Alt", "H", "1"], ["Ctrl+Alt", "1"]);

  it("accepts the whole list in order", () => {
    expect(gradeSequenceStep(step, ["Alt", "H", "1"], "win")).toBe(true);
  });

  it("uses the Mac list on mac", () => {
    expect(gradeSequenceStep(step, ["Ctrl+Alt", "1"], "mac")).toBe(true);
    expect(gradeSequenceStep(step, ["Alt", "H", "1"], "mac")).toBe(false);
  });

  it("rejects a partial list", () => {
    expect(gradeSequenceStep(step, ["Alt", "H"], "win")).toBe(false);
  });

  it("rejects extra keys", () => {
    expect(gradeSequenceStep(step, ["Alt", "H", "1", "Enter"], "win")).toBe(false);
  });

  it("rejects the right keys in the wrong order", () => {
    expect(gradeSequenceStep(step, ["H", "Alt", "1"], "win")).toBe(false);
  });

  it("compares each entry in canonical form", () => {
    expect(gradeSequenceStep(step, ["alt", "h", "1"], "win")).toBe(true);
    expect(gradeSequenceStep(step, ["Alt+Ctrl", "1"], "mac")).toBe(true);
  });

  it("returns false on mac when keys.mac is null", () => {
    const winOnly = sequence(["Alt", "H", "1"], null);
    expect(gradeSequenceStep(winOnly, ["Alt", "H", "1"], "mac")).toBe(false);
  });

  it("returns false for an empty list and for a chord step", () => {
    expect(gradeSequenceStep(step, [], "win")).toBe(false);
    expect(gradeSequenceStep(chord("Ctrl+B", "Cmd+B"), ["Ctrl+B"], "win")).toBe(false);
  });
});

describe("gradeSelectStep", () => {
  it("accepts the exact cell", () => {
    expect(gradeSelectStep(select("B2"), "B2")).toBe(true);
  });

  it("accepts lower case", () => {
    expect(gradeSelectStep(select("B2"), "b2")).toBe(true);
    expect(gradeSelectStep(select("A1:C4"), "a1:c4")).toBe(true);
  });

  it("treats a one-cell range as the cell", () => {
    expect(gradeSelectStep(select("B2"), "B2:B2")).toBe(true);
  });

  it("rejects a different cell", () => {
    expect(gradeSelectStep(select("B2"), "B3")).toBe(false);
  });

  it("accepts a range with reversed corners", () => {
    expect(gradeSelectStep(select("A2:C4"), "C4:A2")).toBe(true);
    expect(gradeSelectStep(select("A2:C4"), "A4:C2")).toBe(true);
    expect(gradeSelectStep(select("A2:C4"), "C2:A4")).toBe(true);
  });

  it("rejects a range of a different size", () => {
    expect(gradeSelectStep(select("A2:C4"), "A2:C3")).toBe(false);
  });

  it("matches whole columns", () => {
    expect(gradeSelectStep(select("B:B"), "B:B")).toBe(true);
    expect(gradeSelectStep(select("B:B"), "b:b")).toBe(true);
    expect(gradeSelectStep(select("A:C"), "C:A")).toBe(true);
    expect(gradeSelectStep(select("B:B"), "C:C")).toBe(false);
  });

  it("matches whole rows", () => {
    expect(gradeSelectStep(select("3:3"), "3:3")).toBe(true);
    expect(gradeSelectStep(select("2:4"), "4:2")).toBe(true);
    expect(gradeSelectStep(select("3:3"), "4:4")).toBe(false);
  });

  it("does not confuse a column with a row or a cell", () => {
    expect(gradeSelectStep(select("B:B"), "2:2")).toBe(false);
    expect(gradeSelectStep(select("B2"), "B:B")).toBe(false);
  });

  it("handles multi-letter columns", () => {
    expect(gradeSelectStep(select("AA10:AB12"), "ab12:aa10")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(gradeSelectStep(select("B2"), " B2 ")).toBe(true);
  });

  it("rejects malformed selections", () => {
    for (const bad of ["", "B", "2", "B0", "B2:C", "B2:C4:D5", "B2,C3", "$B$2", "B02"]) {
      expect(gradeSelectStep(select("B2"), bad)).toBe(false);
    }
  });
});

describe("gradeMcqStep", () => {
  it("accepts the answer index", () => {
    expect(gradeMcqStep(mcq, 1)).toBe(true);
  });

  it("rejects other indexes", () => {
    expect(gradeMcqStep(mcq, 0)).toBe(false);
    expect(gradeMcqStep(mcq, 2)).toBe(false);
  });

  it("rejects out-of-range and non-integer choices", () => {
    expect(gradeMcqStep(mcq, -1)).toBe(false);
    expect(gradeMcqStep(mcq, 3)).toBe(false);
    expect(gradeMcqStep(mcq, 1.5)).toBe(false);
    expect(gradeMcqStep(mcq, Number.NaN)).toBe(false);
  });
});

describe("gradeAcceptStep", () => {
  it("accepts an exact answer", () => {
    expect(gradeAcceptStep(picture(["sumif"]), "sumif")).toBe(true);
  });

  it("is case-insensitive on both sides", () => {
    expect(gradeAcceptStep(picture(["sumif"]), "SUMIF")).toBe(true);
    expect(gradeAcceptStep(picture(["SumIf"]), "sumif")).toBe(true);
  });

  it("removes all whitespace, including inside and non-breaking spaces", () => {
    expect(gradeAcceptStep(project(["1840"]), " 18 40\n")).toBe(true);
    expect(gradeAcceptStep(picture(["=SUM(A1:A3)"]), "= sum( a1 : a3 )")).toBe(true);
    expect(gradeAcceptStep(picture(["sumif"]), "sum if\t")).toBe(true);
  });

  it("straightens smart quotes on both sides", () => {
    expect(gradeAcceptStep(picture(['="yes"']), "=“yes”")).toBe(true);
    expect(gradeAcceptStep(picture(["it's"]), "it’s")).toBe(true);
    expect(gradeAcceptStep(picture(["‘a’"]), "'a'")).toBe(true);
  });

  it("matches any accepted answer", () => {
    expect(gradeAcceptStep(project(["1840", "1,840"]), "1,840")).toBe(true);
  });

  it("rejects a wrong answer", () => {
    expect(gradeAcceptStep(project(["1840"]), "1841")).toBe(false);
    expect(gradeAcceptStep(picture(["sumif"]), "sumifs")).toBe(false);
  });

  it("rejects empty or whitespace-only input", () => {
    expect(gradeAcceptStep(picture(["sumif"]), "")).toBe(false);
    expect(gradeAcceptStep(picture(["sumif"]), "   ")).toBe(false);
  });
});
