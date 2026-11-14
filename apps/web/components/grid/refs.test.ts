import { describe, expect, it } from "vitest";
import { canPoint, findRefs, insertRef, REF_COLOURS, refColours, wholeLineRef } from "./refs";

const texts = (f: string) => findRefs(f).map((r) => f.slice(r.start, r.end));

describe("findRefs (references with positions, from the engine's tokens)", () => {
  it("finds cells and ranges with their source positions", () => {
    expect(findRefs("=SUM(A1:A3)+B2")).toEqual([
      { start: 5, end: 10, text: "A1:A3" },
      { start: 12, end: 14, text: "B2" },
    ]);
  });
  it("keeps the text as typed (lower case, $ signs)", () => {
    expect(texts("=a1+$B$2*c$3")).toEqual(["a1", "$B$2", "c$3"]);
  });
  it("finds whole columns and whole rows", () => {
    expect(texts("=SUM(B:B)")).toEqual(["B:B"]);
    expect(texts("=SUM($B:$C)")).toEqual(["$B:$C"]);
    expect(texts("=SUM(3:3)")).toEqual(["3:3"]);
  });
  it("spans a range written with spaces around the colon", () => {
    expect(texts("=SUM(A1 : A3)")).toEqual(["A1 : A3"]);
  });
  it("ignores functions, names, numbers and strings that look like references", () => {
    expect(findRefs('=LOG10(2)+"A1"+total+3')).toEqual([]);
  });
  it("finds nothing in a literal (no leading =)", () => {
    expect(findRefs("A1")).toEqual([]);
    expect(findRefs("")).toEqual([]);
  });
  it("still finds the references before a part that doesn't tokenize yet", () => {
    expect(texts('=A1+"unterminated')).toEqual(["A1"]);
    expect(texts("=A1+B2+#")).toEqual(["A1", "B2"]);
  });
  it("treats a range missing its end as the cell typed so far", () => {
    expect(texts("=SUM(A1:")).toEqual(["A1"]);
  });
});

describe("refColours (one colour per distinct reference)", () => {
  it("numbers references in order of first appearance", () => {
    expect(refColours(findRefs("=A1+B2+C3"))).toEqual([0, 1, 2]);
  });
  it("gives the same reference the same colour, ignoring case and $", () => {
    expect(refColours(findRefs("=A1+B2+$a$1"))).toEqual([0, 1, 0]);
  });
  it("cycles through the palette", () => {
    const f = "=" + Array.from({ length: REF_COLOURS + 1 }, (_, i) => `A${i + 1}`).join("+");
    const c = refColours(findRefs(f));
    expect(c[REF_COLOURS]).toBe(0);
    expect(new Set(c).size).toBe(REF_COLOURS);
  });
});

describe("canPoint (point-mode trigger rules)", () => {
  it("points right after =, (, , and operators", () => {
    expect(canPoint("=", 1)).toBe(true);
    expect(canPoint("=SUM(", 5)).toBe(true);
    expect(canPoint("=SUM(A1,", 8)).toBe(true);
    for (const op of ["+", "-", "*", "/", "^", "&", "=", "<", ">", "<>", "<=", ">="]) {
      expect(canPoint(`=A1${op}`, 3 + op.length)).toBe(true);
    }
  });
  it("allows spaces between the trigger and the caret", () => {
    expect(canPoint("=A1 + ", 6)).toBe(true);
  });
  it("does not point after an operand", () => {
    expect(canPoint("=A1", 3)).toBe(false);
    expect(canPoint("=SUM(A1)", 8)).toBe(false);
    expect(canPoint("=5", 2)).toBe(false);
    expect(canPoint("=SUM", 4)).toBe(false);
    expect(canPoint("=A1%", 4)).toBe(false); // % is postfix: an operand ends there
  });
  it("needs a formula", () => {
    expect(canPoint("", 0)).toBe(false);
    expect(canPoint("5+", 2)).toBe(false);
  });
  it("needs the caret not to sit in front of an operand", () => {
    expect(canPoint("=SUM()", 5)).toBe(true);
    expect(canPoint("=SUM(,B1)", 5)).toBe(true);
    expect(canPoint("=SUM(A1)", 5)).toBe(false);
    expect(canPoint("=+B1", 1)).toBe(true);
  });
  it("does not point inside a string or after an untokenizable prefix", () => {
    expect(canPoint('="a,', 4)).toBe(false);
  });
});

describe("insertRef (insert at the caret, or replace the last inserted reference)", () => {
  it("inserts at the caret", () => {
    expect(insertRef("=SUM()", null, 5, "A1")).toEqual({ draft: "=SUM(A1)", start: 5, end: 7 });
  });
  it("replaces the last inserted reference", () => {
    expect(insertRef("=SUM(A1)", { start: 5, end: 7 }, 7, "A1:A3")).toEqual({ draft: "=SUM(A1:A3)", start: 5, end: 10 });
    expect(insertRef("=SUM(A1:A3)", { start: 5, end: 10 }, 10, "B2")).toEqual({ draft: "=SUM(B2)", start: 5, end: 7 });
  });
});

describe("wholeLineRef (space after a column letter or row number)", () => {
  const size = { rows: 8, cols: 7 };
  it("turns a column letter typed in point mode into a whole column", () => {
    expect(wholeLineRef("=SUM(B", 6, size)).toEqual({ draft: "=SUM(B:B", start: 5, end: 8 });
    expect(wholeLineRef("=SUM(b)", 6, size)).toEqual({ draft: "=SUM(B:B)", start: 5, end: 8 });
    expect(wholeLineRef("=A1+C", 5, size)).toEqual({ draft: "=A1+C:C", start: 4, end: 7 });
  });
  it("turns a row number typed after ( or , into a whole row", () => {
    expect(wholeLineRef("=SUM(3", 6, size)).toEqual({ draft: "=SUM(3:3", start: 5, end: 8 });
    expect(wholeLineRef("=SUM(A1,2)", 9, size)).toEqual({ draft: "=SUM(A1,2:2)", start: 8, end: 11 });
  });
  it("leaves numbers in arithmetic alone", () => {
    expect(wholeLineRef("=A1+3", 5, size)).toBeNull();
    expect(wholeLineRef("=3", 2, size)).toBeNull();
  });
  it("only for columns and rows on the grid", () => {
    expect(wholeLineRef("=SUM", 4, size)).toBeNull();
    expect(wholeLineRef("=SUM(H", 6, size)).toBeNull();
    expect(wholeLineRef("=SUM(9", 6, size)).toBeNull();
    expect(wholeLineRef("=SUM(0", 6, size)).toBeNull();
  });
  it("only right after the letter or number, typed in point mode", () => {
    expect(wholeLineRef("=SUM(B ", 7, size)).toBeNull();
    expect(wholeLineRef("=SUM(A1", 7, size)).toBeNull();
    expect(wholeLineRef("=A1B", 4, size)).toBeNull();
    expect(wholeLineRef("B", 1, size)).toBeNull();
    expect(wholeLineRef("=SUM(B1)", 6, size)).toBeNull(); // caret inside A1-style text
  });
});
