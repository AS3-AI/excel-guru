import { describe, expect, it } from "vitest";
import { ParseError, Sheet, TokenizeError } from "@excel-guru/engine";
import {
  addressOf,
  colLetter,
  colMinChars,
  editOutcome,
  EMPTY_HISTORY,
  formatValue,
  gridColumns,
  gridSize,
  inRects,
  isTypingKey,
  move,
  parseRef,
  pushEdit,
  rawInput,
  rangeRef,
  rebuildLoaded,
  redoEdit,
  refArea,
  sameGrid,
  selectionRef,
  tabStep,
  undoEdit,
} from "./Grid";

describe("colLetter / addressOf", () => {
  it("names columns like Excel", () => {
    expect(colLetter(0)).toBe("A");
    expect(colLetter(7)).toBe("H");
    expect(colLetter(25)).toBe("Z");
    expect(colLetter(26)).toBe("AA");
    expect(colLetter(27)).toBe("AB");
  });
  it("builds A1 addresses from 0-based row/col", () => {
    expect(addressOf({ row: 0, col: 0 })).toBe("A1");
    expect(addressOf({ row: 5, col: 2 })).toBe("C6");
  });
});

describe("gridSize", () => {
  it("shows at least 7 columns and 8 rows", () => {
    expect(gridSize([])).toEqual({ rows: 8, cols: 7 });
    expect(gridSize([[1, 2, 3]])).toEqual({ rows: 8, cols: 7 });
  });
  it("grows to fit the lesson data", () => {
    expect(gridSize([[1, 2, 3, 4, 5, 6, 7, 8]])).toEqual({ rows: 8, cols: 8 });
    expect(gridSize(Array.from({ length: 10 }, () => [1]))).toEqual({ rows: 10, cols: 7 });
  });
});

describe("move", () => {
  const size = { rows: 8, cols: 7 };
  it("moves one cell per arrow", () => {
    expect(move({ row: 2, col: 2 }, "ArrowUp", size)).toEqual({ row: 1, col: 2 });
    expect(move({ row: 2, col: 2 }, "ArrowDown", size)).toEqual({ row: 3, col: 2 });
    expect(move({ row: 2, col: 2 }, "ArrowLeft", size)).toEqual({ row: 2, col: 1 });
    expect(move({ row: 2, col: 2 }, "ArrowRight", size)).toEqual({ row: 2, col: 3 });
  });
  it("stops at the edges", () => {
    expect(move({ row: 0, col: 0 }, "ArrowUp", size)).toEqual({ row: 0, col: 0 });
    expect(move({ row: 0, col: 0 }, "ArrowLeft", size)).toEqual({ row: 0, col: 0 });
    expect(move({ row: 7, col: 6 }, "ArrowDown", size)).toEqual({ row: 7, col: 6 });
    expect(move({ row: 7, col: 6 }, "ArrowRight", size)).toEqual({ row: 7, col: 6 });
  });
  it("ignores other keys", () => {
    expect(move({ row: 1, col: 1 }, "a", size)).toEqual({ row: 1, col: 1 });
  });
});

describe("parseRef / inRects", () => {
  it("parses cells and ranges, in either corner order", () => {
    expect(parseRef("C2")).toEqual({ r1: 1, c1: 2, r2: 1, c2: 2 });
    expect(parseRef("B2:B6")).toEqual({ r1: 1, c1: 1, r2: 5, c2: 1 });
    expect(parseRef("$D$4:b2")).toEqual({ r1: 1, c1: 1, r2: 3, c2: 3 });
  });
  it("parses whole columns and rows", () => {
    expect(parseRef("B:C")).toEqual({ r1: 0, c1: 1, r2: Infinity, c2: 2 });
    expect(parseRef("3:3")).toEqual({ r1: 2, c1: 0, r2: 2, c2: Infinity });
  });
  it("rejects junk", () => {
    expect(parseRef("")).toBeNull();
    expect(parseRef("A0")).toBeNull();
    expect(parseRef("hello")).toBeNull();
    expect(parseRef("A1:")).toBeNull();
  });
  it("tests membership", () => {
    const rects = ["B2:B6", "D1"].map(parseRef).filter((r) => r !== null);
    expect(inRects(rects, 1, 1)).toBe(true);
    expect(inRects(rects, 5, 1)).toBe(true);
    expect(inRects(rects, 6, 1)).toBe(false);
    expect(inRects(rects, 0, 3)).toBe(true);
    expect(inRects(rects, 0, 0)).toBe(false);
  });
});

describe("formatValue / rawInput", () => {
  it("shows values the way a cell does", () => {
    expect(formatValue(null)).toBe("");
    expect(formatValue(6)).toBe("6");
    expect(formatValue(45366, true)).toBe("15 Mar 2024");
    expect(formatValue(0.1 + 0.2)).toBe("0.3");
    expect(formatValue(true)).toBe("TRUE");
    expect(formatValue(false)).toBe("FALSE");
    expect(formatValue("hi")).toBe("hi");
    expect(formatValue({ error: "#DIV/0!" })).toBe("#DIV/0!");
  });
  it("gives the formula bar the literal as typed", () => {
    expect(rawInput(null)).toBe("");
    expect(rawInput(0.1 + 0.2)).toBe(String(0.1 + 0.2));
    expect(rawInput(true)).toBe("TRUE");
    expect(rawInput("x")).toBe("x");
    expect(rawInput({ error: "#N/A" })).toBe("#N/A");
  });
});

describe("isTypingKey", () => {
  const k = (
    key: string,
    mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {},
  ) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...mods,
  });
  it("starts editing on printable characters", () => {
    expect(isTypingKey(k("1"))).toBe(true);
    expect(isTypingKey(k("="))).toBe(true);
    expect(isTypingKey(k(" "))).toBe(true);
  });
  it("leaves shortcuts and named keys alone", () => {
    expect(isTypingKey(k("c", { ctrlKey: true }))).toBe(false);
    expect(isTypingKey(k("v", { metaKey: true }))).toBe(false);
    expect(isTypingKey(k("Enter"))).toBe(false);
    expect(isTypingKey(k("ArrowUp"))).toBe(false);
  });
});

describe("tabStep", () => {
  const size = { rows: 8, cols: 7 };
  it("steps right on Tab and left on Shift+Tab", () => {
    expect(tabStep({ row: 2, col: 3 }, false, size)).toEqual({ row: 2, col: 4 });
    expect(tabStep({ row: 2, col: 3 }, true, size)).toEqual({ row: 2, col: 2 });
  });
  it("returns null at the edge so the browser can move focus out", () => {
    expect(tabStep({ row: 2, col: 6 }, false, size)).toBeNull();
    expect(tabStep({ row: 2, col: 0 }, true, size)).toBeNull();
  });
});

describe("editOutcome (an unchanged draft is never re-written)", () => {
  it("closes without writing when the draft equals what the cell holds", () => {
    expect(editOutcome("007", "007")).toBe("close");
    expect(editOutcome("=SUM(A1:A3)", "=SUM(A1:A3)")).toBe("close");
    expect(editOutcome("", "")).toBe("close");
  });
  it("commits any change, including whitespace", () => {
    expect(editOutcome("7", "007")).toBe("commit");
    expect(editOutcome(" 42", "42")).toBe("commit");
    expect(editOutcome("", "x")).toBe("commit");
  });
  it("keeps text literals intact: the formula bar shows them exactly as stored", () => {
    const sheet = new Sheet([["007", "1E5", "TRUE", " 42"]]);
    for (const a of ["A1", "B1", "C1", "D1"]) {
      const shown = sheet.getFormula(a) ?? rawInput(sheet.get(a));
      expect(editOutcome(shown, shown)).toBe("close");
    }
    expect(rawInput(sheet.get("A1"))).toBe("007");
    // Re-setting the same text would re-parse it: this is what "close" protects against.
    sheet.set("A1", "007");
    expect(sheet.get("A1")).toBe(7);
  });
});

describe("sameGrid (when a new grid prop resets the sheet)", () => {
  it("is true for the same reference or an equal copy", () => {
    const g = [
      [1, "a", null],
      [true, "=SUM(A1:A2)"],
    ];
    expect(sameGrid(g, g)).toBe(true);
    expect(
      sameGrid(g, [
        [1, "a", null],
        [true, "=SUM(A1:A2)"],
      ]),
    ).toBe(true);
    expect(sameGrid([], [])).toBe(true);
  });
  it("is false when any cell, row length or row count differs", () => {
    expect(sameGrid([[1, 2]], [[1, 3]])).toBe(false);
    expect(sameGrid([[1, 2]], [[1, 2, 3]])).toBe(false);
    expect(sameGrid([[1]], [[1], [2]])).toBe(false);
    expect(sameGrid([[null]], [[""]])).toBe(false);
    expect(sameGrid([[1]], [["1"]])).toBe(false);
    expect(sameGrid([[0]], [[false]])).toBe(false);
  });
});

describe("colMinChars (columns wide enough for the lesson's own text)", () => {
  const fruit = [
    ["Fruit", "Price"],
    ["Apples", 3],
    ["Bananas", 2],
    ["Cherries", 4],
  ];
  it("is the longest shown text per column, 0 for empty columns", () => {
    expect(colMinChars(new Sheet(fruit), gridSize(fruit))).toEqual([8, 5, 0, 0, 0, 0, 0]);
    expect(colMinChars(new Sheet([]), gridSize([]))).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
  it("measures what the cell shows, not what was typed", () => {
    expect(
      colMinChars(new Sheet([[0.1 + 0.2, true, "=1/0", "=10*10"]]), { rows: 1, cols: 4 }),
    ).toEqual([3, 4, 7, 3]);
  });
  it("caps very long text so one column can't take over the grid", () => {
    const long = [["A very long product description indeed"]];
    expect(colMinChars(new Sheet(long), { rows: 1, cols: 1 })).toEqual([14]);
    expect(colMinChars(new Sheet(long), { rows: 1, cols: 1 }, 20)).toEqual([20]);
  });
});

describe("gridColumns (the grid-template-columns value)", () => {
  it("keeps empty columns flexible down to 0, as before", () => {
    expect(gridColumns([0, 0])).toBe("var(--eg-rowhead) minmax(0, 1fr) minmax(0, 1fr)");
  });
  it("gives text columns a minimum of their text plus the cell padding, sharing space equally", () => {
    expect(gridColumns([8, 0])).toBe(
      "var(--eg-rowhead) minmax(calc(8ch + 8px), 1fr) minmax(0, 1fr)",
    );
  });
});

describe("what the grid relies on from the engine (T9 done-when)", () => {
  it("sums A1:A3, recalculates, shows #DIV/0! and keeps the old value on a parse error", () => {
    const sheet = new Sheet([]);
    sheet.set("A1", "1");
    sheet.set("A2", "2");
    sheet.set("A3", "3");
    sheet.set("B1", "=SUM(A1:A3)");
    expect(formatValue(sheet.get("B1"))).toBe("6");
    sheet.set("A1", "10");
    expect(formatValue(sheet.get("B1"))).toBe("15");

    sheet.set("C1", "=1/0");
    expect(formatValue(sheet.get("C1"))).toBe("#DIV/0!");

    let caught: unknown;
    try {
      sheet.set("B1", "=SUM(");
    } catch (e) {
      caught = e;
    }
    expect(caught instanceof ParseError || caught instanceof TokenizeError).toBe(true);
    expect((caught as Error).message).toMatch(/position/);
    expect(formatValue(sheet.get("B1"))).toBe("15");
    expect(sheet.getFormula("B1")).toBe("=SUM(A1:A3)");
  });
});

describe("rangeRef (the reference point mode inserts)", () => {
  it("is a cell when anchor and cursor match", () => {
    expect(rangeRef({ row: 0, col: 0 }, { row: 0, col: 0 })).toBe("A1");
  });
  it("is a top-left to bottom-right range whichever way it was drawn", () => {
    expect(rangeRef({ row: 0, col: 0 }, { row: 2, col: 0 })).toBe("A1:A3");
    expect(rangeRef({ row: 2, col: 1 }, { row: 0, col: 0 })).toBe("A1:B3");
  });
});

describe("selectionRef", () => {
  it("uses canonical cell and range references", () => {
    expect(selectionRef({ row: 1, col: 1 }, { row: 1, col: 1 })).toBe("B2");
    expect(selectionRef({ row: 3, col: 3 }, { row: 1, col: 1 })).toBe("B2:D4");
  });
  it("uses canonical whole-column and whole-row references", () => {
    expect(selectionRef({ row: 0, col: 3 }, { row: 0, col: 1 }, "column")).toBe("B:D");
    expect(selectionRef({ row: 4, col: 0 }, { row: 2, col: 0 }, "row")).toBe("3:5");
  });
});

describe("refArea (where a coloured reference is outlined)", () => {
  const size = { rows: 8, cols: 7 };
  it("places a range by CSS grid lines (line 1 is the headers)", () => {
    expect(refArea(parseRef("A1:B3")!, size)).toEqual({ gridRow: "2 / 5", gridColumn: "2 / 4" });
  });
  it("clips whole columns and rows to the grid", () => {
    expect(refArea(parseRef("B:B")!, size)).toEqual({ gridRow: "2 / 10", gridColumn: "3 / 4" });
    expect(refArea(parseRef("3:3")!, size)).toEqual({ gridRow: "4 / 5", gridColumn: "2 / 9" });
    expect(refArea(parseRef("F7:Z99")!, size)).toEqual({ gridRow: "8 / 10", gridColumn: "7 / 9" });
  });
  it("is null for a reference entirely off the grid", () => {
    expect(refArea(parseRef("Z99")!, size)).toBeNull();
  });
});

describe("sheet edit history (undo, redo, reset)", () => {
  const base = [
    ["Supply", "In stock", "Pack total"],
    ["Badges", 5, null],
    ["Lanyards", 4, null],
    ["007", 2, null],
  ];

  it("tracks edits, steps back with undo, restores with redo, and clears redo on a new edit", () => {
    let h = pushEdit(EMPTY_HISTORY, { addr: "B2", pos: { row: 1, col: 1 }, input: "10" });
    h = pushEdit(h, { addr: "C2", pos: { row: 1, col: 2 }, input: "=B2+B3" });
    expect(h.past).toHaveLength(2);

    const step1 = undoEdit(h);
    expect(step1.undone?.addr).toBe("C2");
    expect(step1.history.past).toHaveLength(1);
    expect(step1.history.future).toHaveLength(1);

    const step2 = undoEdit(step1.history);
    expect(step2.undone?.addr).toBe("B2");
    expect(step2.history.past).toHaveLength(0);
    expect(step2.history.future).toHaveLength(2);
    expect(undoEdit(step2.history).undone).toBeNull();

    const r1 = redoEdit(step2.history);
    expect(r1.redone?.input).toBe("10");
    expect(r1.history.past).toHaveLength(1);

    const branched = pushEdit(r1.history, { addr: "C2", pos: { row: 1, col: 2 }, input: "=B2+B4" });
    expect(branched.future).toEqual([]);
  });

  it("rebuilds exact initial literals and recalculates dependent formulas on undo and redo", () => {
    const edits = [
      { addr: "B2", pos: { row: 1, col: 1 }, input: "10" },
      { addr: "A4", pos: { row: 3, col: 0 }, input: "99" },
      { addr: "C2", pos: { row: 1, col: 2 }, input: "=B2+B3" },
    ];
    const edited = rebuildLoaded(base, edits);
    expect(edited.sheet.get("B2")).toBe(10);
    expect(edited.sheet.get("A4")).toBe(99);
    expect(edited.sheet.get("C2")).toBe(14);
    expect(edited.literals.has("C2")).toBe(false);

    const afterUndoOne = rebuildLoaded(base, edits.slice(0, 2));
    expect(afterUndoOne.sheet.get("C2")).toBeNull();
    expect(afterUndoOne.sheet.get("A4")).toBe(99);

    const reset = rebuildLoaded(base, []);
    expect(reset.sheet.get("B2")).toBe(5);
    expect(reset.sheet.get("A4")).toBe("007");
    expect(reset.sheet.get("C2")).toBeNull();
    expect(reset.literals.has("A4")).toBe(true);
  });
});
