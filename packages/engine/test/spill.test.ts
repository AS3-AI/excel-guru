import { describe, expect, it } from "vitest";
import { Sheet, type CellValue, type ErrorCode, type ExcelError } from "../src/index";

const err = (code: ErrorCode): ExcelError => ({ error: code });
const SPILL = err("#SPILL!");

/** The values of a block of cells, row by row, e.g. col(s, "C1:C3"). */
function block(s: Sheet, from: string, rows: number, cols = 1): CellValue[][] {
  const col0 = from.charCodeAt(0) - 65;
  const row0 = Number(from.slice(1)) - 1;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => s.get(`${String.fromCharCode(65 + col0 + c)}${row0 + r + 1}`)),
  );
}
const column = (s: Sheet, from: string, rows: number) => block(s, from, rows).map((r) => r[0]);

// A1:A6 regions with repeats (mixed case), B1:B6 sales.
const SALES = [
  ["East", 120],
  ["West", 80],
  ["east", 50],
  ["North", 200],
  ["West", 30],
  ["South", 90],
];

describe("spill: a bare range", () => {
  it("=A1:A3 spills down from the anchor", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C1", "=A1:A3");
    expect(column(s, "C1", 3)).toEqual([1, 2, 3]);
  });
  it("=A1:C1 spills right", () => {
    const s = new Sheet([[1, 2, 3]]);
    s.set("A3", "=A1:C1");
    expect(block(s, "A3", 1, 3)).toEqual([[1, 2, 3]]);
  });
  it("a 2-D range spills down and right", () => {
    const s = new Sheet([[1, "a"], [2, "b"]]);
    s.set("D1", "=A1:B2");
    expect(block(s, "D1", 2, 2)).toEqual([[1, "a"], [2, "b"]]);
  });
  it("a 1×1 range is just a value, nothing spills", () => {
    const s = new Sheet([[7]]);
    s.set("C1", "=A1:A1");
    expect(s.get("C1")).toBe(7);
    expect(s.get("C2")).toBeNull();
  });
  it("empty source cells spill as 0", () => {
    const s = new Sheet([[1], [null], [3]]);
    s.set("C1", "=A1:A3");
    expect(column(s, "C1", 3)).toEqual([1, 0, 3]);
  });
  it("only the anchor holds the formula", () => {
    const s = new Sheet([[1], [2]]);
    s.set("C1", "=A1:A2");
    expect(s.getFormula("C1")).toBe("=A1:A2");
    expect(s.getFormula("C2")).toBeNull();
    expect(s.functionsUsed("C2")).toEqual([]);
  });
  it("arithmetic on a range spills element by element", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C1", "=A1:A3*10");
    expect(column(s, "C1", 3)).toEqual([10, 20, 30]);
  });
});

describe("spill: #SPILL! when blocked", () => {
  it("a literal in the way gives #SPILL! at the anchor and nothing spills", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C3", "x");
    s.set("C1", "=A1:A3");
    expect(s.get("C1")).toEqual(SPILL);
    expect(s.get("C2")).toBeNull();
    expect(s.get("C3")).toBe("x");
  });
  it("a formula in the way blocks it too", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C2", "=1+1");
    s.set("C1", "=A1:A3");
    expect(s.get("C1")).toEqual(SPILL);
    expect(s.get("C2")).toBe(2);
  });
  it("another spill in the way blocks it", () => {
    const s = new Sheet([[1, 2, 3], [4, 5, 6]]);
    s.set("B4", "=A1:A2"); // B4:B5
    s.set("A5", "=A1:C1"); // would need A5:C5, B5 is spilled
    expect(s.get("A5")).toEqual(SPILL);
    expect(column(s, "B4", 2)).toEqual([1, 4]);
  });
  it("clearing the blocker re-spills", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C3", "x");
    s.set("C1", "=A1:A3");
    s.set("C3", "");
    expect(column(s, "C1", 3)).toEqual([1, 2, 3]);
  });
  it("replacing a blocking formula with nothing re-spills", () => {
    const s = new Sheet([[1], [2]]);
    s.set("C2", "=5");
    s.set("C1", "=A1:A2");
    expect(s.get("C1")).toEqual(SPILL);
    s.set("C2", "");
    expect(column(s, "C1", 2)).toEqual([1, 2]);
  });
  it("typing into a spilled cell makes it a normal cell and blocks the spill", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C1", "=A1:A3");
    s.set("C2", "99");
    expect(s.get("C2")).toBe(99);
    expect(s.get("C1")).toEqual(SPILL);
    expect(s.get("C3")).toBeNull();
  });
  it("deleting the typed value lets the spill come back", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C1", "=A1:A3");
    s.set("C2", "99");
    s.set("C2", "");
    expect(column(s, "C1", 3)).toEqual([1, 2, 3]);
  });
  it("clearing a spilled cell (it holds nothing of its own) changes nothing", () => {
    const s = new Sheet([[1], [2]]);
    s.set("C1", "=A1:A2");
    s.set("C2", "");
    expect(column(s, "C1", 2)).toEqual([1, 2]);
  });
  it("a spill that would run off the sheet is #SPILL!", () => {
    const s = new Sheet([[1], [2]]);
    s.set("C1048576", "=A1:A2");
    expect(s.get("C1048576")).toEqual(SPILL);
  });
  it("the blocked spill re-spills when the other spill shrinks", () => {
    const s = new Sheet([[1, 2, 3], [4, 5, 6], [true]]);
    s.set("B5", "=FILTER(A1:A2,A1:A2>0)"); // B5:B6 while both are positive
    s.set("A6", "=A1:C1"); // A6:C6 blocked by B6
    expect(s.get("A6")).toEqual(SPILL);
    s.set("A2", "-4"); // FILTER now keeps only 1 → B5 alone
    expect(s.get("B5")).toBe(1);
    expect(block(s, "A6", 1, 3)).toEqual([[1, 2, 3]]); // B6 now belongs to A6's spill
  });
});

describe("spill: recalculation", () => {
  it("spilled cells update when the source changes", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C1", "=A1:A3");
    s.set("A2", "20");
    expect(column(s, "C1", 3)).toEqual([1, 20, 3]);
  });
  it("a formula reading a spill sees its values", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C1", "=A1:A3*2");
    s.set("E1", "=SUM(C1:C3)");
    expect(s.get("E1")).toBe(12);
  });
  it("a formula reading a spill updates when the source changes", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C1", "=A1:A3*2");
    s.set("E1", "=SUM(C2:C3)");
    s.set("A3", "10");
    expect(s.get("E1")).toBe(24);
  });
  it("a formula written before the spill picks it up", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("E1", "=C3+1");
    s.set("C1", "=A1:A3");
    expect(s.get("E1")).toBe(4);
  });
  it("a single-cell reference to a spilled cell updates", () => {
    const s = new Sheet([[1], [2]]);
    s.set("C1", "=A1:A2");
    s.set("E1", "=C2*100");
    s.set("A2", "3");
    expect(s.get("E1")).toBe(300);
  });
  it("a shrinking spill clears its old cells", () => {
    const s = new Sheet([["a"], ["b"], ["a"]]);
    s.set("C1", "=UNIQUE(A1:A3)");
    expect(column(s, "C1", 2)).toEqual(["a", "b"]);
    s.set("A2", "a");
    expect(column(s, "C1", 2)).toEqual(["a", null]);
  });
  it("readers of a cleared spill cell see it empty", () => {
    const s = new Sheet([["a"], ["b"], ["c"]]);
    s.set("C1", "=UNIQUE(A1:A3)");
    s.set("E1", '=C3&"!"');
    expect(s.get("E1")).toBe("c!");
    s.set("A3", "a");
    expect(s.get("E1")).toBe("!");
  });
  it("a growing spill fills new cells and their readers", () => {
    const s = new Sheet([["a"], ["a"], ["a"]]);
    s.set("C1", "=UNIQUE(A1:A3)");
    s.set("E1", "=COUNTA(C1:C3)");
    expect(s.get("E1")).toBe(1);
    s.set("A3", "b");
    expect(column(s, "C1", 2)).toEqual(["a", "b"]);
    expect(s.get("E1")).toBe(2);
  });
  it("overwriting the anchor with a literal clears the spill", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C1", "=A1:A3");
    s.set("E1", "=SUM(C1:C3)");
    s.set("C1", "5");
    expect(column(s, "C1", 3)).toEqual([5, null, null]);
    expect(s.get("E1")).toBe(5);
  });
  it("overwriting the anchor with a scalar formula clears the spill", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("C1", "=A1:A3");
    s.set("C1", "=A1+A2");
    expect(column(s, "C1", 3)).toEqual([3, null, null]);
  });
  it("whole-column ranges include spilled rows", () => {
    const s = new Sheet([[1], [2], [3], [4]]);
    s.set("C1", "=A1:A4");
    s.set("E1", "=SUM(C:C)");
    expect(s.get("E1")).toBe(10);
  });
  it("a cycle through a spill is #CIRC!", () => {
    const s = new Sheet([[null], [5]]);
    s.set("A1", "=C2");
    s.set("C1", "=A1:A2"); // C2 spills A2, but C1 reads A1, which reads C2
    expect(s.get("C1")).toEqual(err("#CIRC!"));
    expect(s.get("A1")).toEqual(err("#CIRC!"));
  });
  it("a spill that reads its own spill area is #CIRC!", () => {
    const s = new Sheet([[1]]);
    s.set("C1", "=C2:C3");
    expect(s.get("C1")).toEqual(err("#CIRC!"));
  });
  it("breaking a cycle through a spill recomputes it", () => {
    const s = new Sheet([[null], [5]]);
    s.set("A1", "=C2");
    s.set("C1", "=A1:A2");
    s.set("A1", "1");
    expect(column(s, "C1", 2)).toEqual([1, 5]);
  });
  it("formulas in the starting grid spill", () => {
    const s = new Sheet([[3, "=SORT(A1:A3)"], [1], [2]]);
    expect(column(s, "B1", 3)).toEqual([1, 2, 3]);
  });
});

describe("UNIQUE", () => {
  it("removes repeats, keeping first-seen order", () => {
    const s = new Sheet(SALES);
    s.set("D1", "=UNIQUE(A1:A6)");
    expect(column(s, "D1", 5)).toEqual(["East", "West", "North", "South", null]);
  });
  it("text compares case-insensitively", () => {
    const s = new Sheet([["a"], ["A"], ["b"]]);
    s.set("C1", "=UNIQUE(A1:A3)");
    expect(column(s, "C1", 3)).toEqual(["a", "b", null]);
  });
  it("a number and the same number as text are different", () => {
    const s = new Sheet([[1], ["1"], [1]]);
    s.set("C1", "=UNIQUE(A1:A3)");
    expect(column(s, "C1", 3)).toEqual([1, "1", null]);
  });
  it("compares whole rows of a multi-column range", () => {
    const s = new Sheet([["a", 1], ["a", 2], ["A", 1]]);
    s.set("D1", "=UNIQUE(A1:B3)");
    expect(block(s, "D1", 3, 2)).toEqual([["a", 1], ["a", 2], [null, null]]);
  });
  it("by_col compares columns", () => {
    const s = new Sheet([["x", "y", "x"], [1, 2, 1]]);
    s.set("A4", "=UNIQUE(A1:C2,TRUE)");
    expect(block(s, "A4", 2, 3)).toEqual([["x", "y", null], [1, 2, null]]);
  });
  it("exactly_once keeps values that appear once", () => {
    const s = new Sheet(SALES);
    s.set("D1", "=UNIQUE(A1:A6,FALSE,TRUE)");
    expect(column(s, "D1", 3)).toEqual(["North", "South", null]);
  });
  it("exactly_once with nothing unique gives #VALUE! (Excel's #CALC!)", () => {
    const s = new Sheet([["a"], ["a"]]);
    s.set("C1", "=UNIQUE(A1:A2,,TRUE)");
    expect(s.get("C1")).toEqual(err("#VALUE!"));
  });
  it("blank cells are one value, spilled as 0", () => {
    const s = new Sheet([[1], [null], [null], [1]]);
    s.set("C1", "=UNIQUE(A1:A4)");
    expect(column(s, "C1", 3)).toEqual([1, 0, null]);
  });
  it("errors in the data are kept as values", () => {
    const s = new Sheet([["=1/0"], [1], ["=1/0"]]);
    s.set("C1", "=UNIQUE(A1:A3)");
    expect(column(s, "C1", 3)).toEqual([err("#DIV/0!"), 1, null]);
  });
  it("an error argument propagates", () => {
    const s = new Sheet([]);
    s.set("A1", "=UNIQUE(1/0)");
    expect(s.get("A1")).toEqual(err("#DIV/0!"));
  });
  it("COUNTA over UNIQUE counts distinct values", () => {
    const s = new Sheet(SALES);
    s.set("D1", "=COUNTA(UNIQUE(A1:A6))");
    expect(s.get("D1")).toBe(4);
  });
});

describe("FILTER", () => {
  it("keeps rows where include is TRUE", () => {
    const s = new Sheet(SALES);
    s.set("D1", "=FILTER(A1:A6,B1:B6>85)");
    expect(column(s, "D1", 4)).toEqual(["East", "North", "South", null]);
  });
  it("returns whole rows of a multi-column range", () => {
    const s = new Sheet(SALES);
    s.set("D1", '=FILTER(A1:B6,A1:A6="west")');
    expect(block(s, "D1", 3, 2)).toEqual([["West", 80], ["West", 30], [null, null]]);
  });
  it("a row of flags filters columns", () => {
    const s = new Sheet([["a", "b", "c"], [1, 0, 1]]);
    s.set("A4", "=FILTER(A1:C1,A2:C2)");
    expect(block(s, "A4", 1, 3)).toEqual([["a", "c", null]]);
  });
  it("numbers count as TRUE when non-zero, blanks as FALSE", () => {
    const s = new Sheet([["a", 2], ["b", null], ["c", 0], ["d", -1]]);
    s.set("D1", "=FILTER(A1:A4,B1:B4)");
    expect(column(s, "D1", 3)).toEqual(["a", "d", null]);
  });
  it("criteria multiply for AND", () => {
    const s = new Sheet(SALES);
    s.set("D1", '=FILTER(A1:A6,(B1:B6>40)*(A1:A6<>"East"))');
    expect(column(s, "D1", 4)).toEqual(["West", "North", "South", null]);
  });
  it("no match uses if_empty", () => {
    const s = new Sheet(SALES);
    s.set("D1", '=FILTER(A1:A6,B1:B6>1000,"none")');
    expect(s.get("D1")).toBe("none");
  });
  it("no match without if_empty is #VALUE! (Excel's #CALC!)", () => {
    const s = new Sheet(SALES);
    s.set("D1", "=FILTER(A1:A6,B1:B6>1000)");
    expect(s.get("D1")).toEqual(err("#VALUE!"));
  });
  it("include of the wrong size is #VALUE!", () => {
    const s = new Sheet(SALES);
    s.set("D1", "=FILTER(A1:A6,B1:B5>1)");
    expect(s.get("D1")).toEqual(err("#VALUE!"));
  });
  it("an error in include propagates", () => {
    const s = new Sheet([["a", 1], ["b", "=NA()"]]);
    s.set("D1", "=FILTER(A1:A2,B1:B2>0)");
    expect(s.get("D1")).toEqual(err("#N/A"));
  });
  it("text in include is #VALUE!", () => {
    const s = new Sheet([["a", "yes"], ["b", 1]]);
    s.set("D1", "=FILTER(A1:A2,B1:B2)");
    expect(s.get("D1")).toEqual(err("#VALUE!"));
  });
  it("a single match is just a value", () => {
    const s = new Sheet(SALES);
    s.set("D1", "=FILTER(A1:A6,B1:B6=200)");
    expect(s.get("D1")).toBe("North");
    expect(s.get("D2")).toBeNull();
  });
  it("SUM over FILTER", () => {
    const s = new Sheet(SALES);
    s.set("D1", '=SUM(FILTER(B1:B6,A1:A6="west"))');
    expect(s.get("D1")).toBe(110);
  });
});

describe("SORT", () => {
  it("sorts ascending by default", () => {
    const s = new Sheet([[3], [1], [2]]);
    s.set("C1", "=SORT(A1:A3)");
    expect(column(s, "C1", 3)).toEqual([1, 2, 3]);
  });
  it("sort_order -1 sorts descending", () => {
    const s = new Sheet([[3], [1], [2]]);
    s.set("C1", "=SORT(A1:A3,1,-1)");
    expect(column(s, "C1", 3)).toEqual([3, 2, 1]);
  });
  it("text sorts case-insensitively", () => {
    const s = new Sheet([["banana"], ["Apple"], ["cherry"], ["apple"]]);
    s.set("C1", "=SORT(A1:A4)");
    expect(column(s, "C1", 4)).toEqual(["Apple", "apple", "banana", "cherry"]);
  });
  it("mixed types sort numbers < text < booleans", () => {
    const s = new Sheet([[true], ["b"], [10], ["a"], [false], [2]]);
    s.set("C1", "=SORT(A1:A6)");
    expect(column(s, "C1", 6)).toEqual([2, 10, "a", "b", false, true]);
  });
  it("sort_index picks the column rows are sorted by", () => {
    const s = new Sheet(SALES);
    s.set("D1", "=SORT(A1:B6,2,-1)");
    expect(block(s, "D1", 3, 2)).toEqual([["North", 200], ["East", 120], ["South", 90]]);
  });
  it("ties keep their original order", () => {
    const s = new Sheet([["b", 1], ["a", 2], ["B", 3]]);
    s.set("D1", "=SORT(A1:B3)");
    expect(block(s, "D1", 3, 2)).toEqual([["a", 2], ["b", 1], ["B", 3]]);
  });
  it("by_col sorts columns by a row", () => {
    const s = new Sheet([["c", "a", "b"], [3, 1, 2]]);
    s.set("A4", "=SORT(A1:C2,2,1,TRUE)");
    expect(block(s, "A4", 2, 3)).toEqual([["a", "b", "c"], [1, 2, 3]]);
  });
  it("sort_index past the array is #VALUE!", () => {
    const s = new Sheet([[3], [1]]);
    s.set("C1", "=SORT(A1:A2,2)");
    expect(s.get("C1")).toEqual(err("#VALUE!"));
  });
  it("a sort_order other than 1 or -1 is #VALUE!", () => {
    const s = new Sheet([[3], [1]]);
    s.set("C1", "=SORT(A1:A2,1,0)");
    expect(s.get("C1")).toEqual(err("#VALUE!"));
  });
  it("an error argument propagates", () => {
    const s = new Sheet([[3], [1]]);
    s.set("C1", "=SORT(A1:A2,1/0)");
    expect(s.get("C1")).toEqual(err("#DIV/0!"));
  });
  it("SORT(UNIQUE(...)) nests", () => {
    const s = new Sheet(SALES);
    s.set("D1", "=SORT(UNIQUE(A1:A6))");
    expect(column(s, "D1", 5)).toEqual(["East", "North", "South", "West", null]);
  });
  it("SORT over FILTER", () => {
    const s = new Sheet(SALES);
    s.set("D1", "=SORT(FILTER(B1:B6,B1:B6<100))");
    expect(column(s, "D1", 4)).toEqual([30, 50, 80, 90]);
  });
});

describe("XLOOKUP spills a multi-column return_array", () => {
  it("returns the matched row", () => {
    const s = new Sheet([["a", 1, "x"], ["b", 2, "y"], ["b"]]);
    s.set("E1", '=XLOOKUP("b",A1:A2,B1:C2)');
    expect(block(s, "E1", 1, 2)).toEqual([[2, "y"]]);
  });
  it("a horizontal lookup returns the matched column", () => {
    const s = new Sheet([["Q1", "Q2"], [100, 200], [10, 20]]);
    s.set("E1", '=XLOOKUP("q2",A1:B1,A2:B3)');
    expect(column(s, "E1", 2)).toEqual([200, 20]);
  });
  it("is blocked like any spill", () => {
    const s = new Sheet([["a", 1, "x"]]);
    s.set("F1", "busy");
    s.set("E1", '=XLOOKUP("a",A1:A1,B1:C1)');
    expect(s.get("E1")).toEqual(SPILL);
  });
});

describe("every ExcelError has a formula that produces it", () => {
  const cases: [ErrorCode, string][] = [
    ["#DIV/0!", "=1/0"],
    ["#N/A", '=VLOOKUP("z",A1:B1,2,FALSE)'],
    ["#VALUE!", '="a"+1'],
    ["#REF!", "=A0"],
    ["#NAME?", "=NOPE(1)"],
    ["#NUM!", "=SQRT(-1)"],
    ["#SPILL!", "=A1:A2"],
  ];
  for (const [code, formula] of cases) {
    it(`${code} from ${formula}`, () => {
      const s = new Sheet([["a", 1], [2]]);
      s.set("D2", "in the way");
      s.set("D1", formula);
      expect(s.get("D1")).toEqual(err(code));
    });
  }
  it("#CIRC! from A1=B1, B1=A1", () => {
    const s = new Sheet([]);
    s.set("A1", "=B1");
    s.set("B1", "=A1");
    expect(s.get("A1")).toEqual(err("#CIRC!"));
  });
});
