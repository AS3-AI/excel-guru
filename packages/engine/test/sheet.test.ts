import { describe, expect, it } from "vitest";
import { ParseError, Sheet, TokenizeError } from "../src/index";

const CIRC = { error: "#CIRC!" };

describe("Sheet: card example", () => {
  it("SUM recalculates when an input changes", () => {
    const s = new Sheet([[1], [2], [3]]);
    s.set("B1", "=SUM(A1:A3)");
    expect(s.get("B1")).toBe(6);
    s.set("A1", "10");
    expect(s.get("B1")).toBe(15);
  });
});

describe("Sheet: grid and literals", () => {
  it("grid[0][0] is A1", () => {
    const s = new Sheet([["Region", "Sales"], ["East", 120]]);
    expect(s.get("A1")).toBe("Region");
    expect(s.get("B2")).toBe(120);
  });
  it("cells outside the grid are empty", () => expect(new Sheet([[1]]).get("Z9")).toBeNull());
  it("literal input: number, boolean, empty, text", () => {
    const s = new Sheet([]);
    s.set("A1", "42");
    s.set("A2", "TRUE");
    s.set("A3", "");
    s.set("A4", "hello");
    s.set("A5", "-1.5");
    expect([s.get("A1"), s.get("A2"), s.get("A3"), s.get("A4"), s.get("A5")]).toEqual([42, true, null, "hello", -1.5]);
  });
  it("$ in the address is ignored", () => {
    const s = new Sheet([[7]]);
    expect(s.get("$A$1")).toBe(7);
  });
  it("an invalid address throws", () => expect(() => new Sheet([]).get("A0")).toThrow(RangeError));
});

describe("Sheet: formulas", () => {
  it("getFormula returns the formula text, or null for literals", () => {
    const s = new Sheet([[1]]);
    s.set("B1", "=A1*2");
    expect(s.getFormula("B1")).toBe("=A1*2");
    expect(s.getFormula("A1")).toBeNull();
  });
  it("overwriting a formula with a literal clears it", () => {
    const s = new Sheet([[1]]);
    s.set("B1", "=A1*2");
    s.set("B1", "5");
    expect(s.getFormula("B1")).toBeNull();
    expect(s.get("B1")).toBe(5);
  });
  it("a tokenize error throws and keeps the old content", () => {
    const s = new Sheet([[1]]);
    s.set("B1", "=A1+1");
    expect(() => s.set("B1", '="abc')).toThrow(TokenizeError);
    expect(s.getFormula("B1")).toBe("=A1+1");
    expect(s.get("B1")).toBe(2);
  });
  it("a parse error throws and keeps the old content", () => {
    const s = new Sheet([[1]]);
    s.set("B1", "7");
    expect(() => s.set("B1", "=SUM(")).toThrow(ParseError);
    expect(s.get("B1")).toBe(7);
  });
  it("grid strings starting with = are formulas", () => {
    const s = new Sheet([[2, "=A1*3"]]);
    expect(s.get("B1")).toBe(6);
    expect(s.getFormula("B1")).toBe("=A1*3");
  });
});

describe("Sheet: recalculation", () => {
  it("chains recompute in dependency order", () => {
    const s = new Sheet([[1]]);
    s.set("C1", "=B1+1");
    s.set("B1", "=A1*10");
    expect(s.get("C1")).toBe(11);
    s.set("A1", "2");
    expect([s.get("B1"), s.get("C1")]).toEqual([20, 21]);
  });
  it("diamond dependencies see fresh values", () => {
    const s = new Sheet([[1]]);
    s.set("B1", "=A1+1");
    s.set("C1", "=A1*2");
    s.set("D1", "=B1+C1");
    s.set("A1", "5");
    expect(s.get("D1")).toBe(16);
  });
  it("whole-column ranges pick up new rows", () => {
    const s = new Sheet([[1], [2]]);
    s.set("B1", "=SUM(A:A)");
    expect(s.get("B1")).toBe(3);
    s.set("A5", "10");
    expect(s.get("B1")).toBe(13);
  });
  it("clearing an input updates dependents", () => {
    const s = new Sheet([[4]]);
    s.set("B1", "=A1*2");
    s.set("A1", "");
    expect(s.get("B1")).toBe(0);
  });
});

describe("Sheet: cycles", () => {
  it("A1=B1, B1=A1 marks both #CIRC!", () => {
    const s = new Sheet([]);
    s.set("A1", "=B1");
    s.set("B1", "=A1");
    expect(s.get("A1")).toEqual(CIRC);
    expect(s.get("B1")).toEqual(CIRC);
  });
  it("a self-reference is #CIRC!", () => {
    const s = new Sheet([]);
    s.set("A1", "=A1+1");
    expect(s.get("A1")).toEqual(CIRC);
  });
  it("a cell downstream of a cycle sees the error", () => {
    const s = new Sheet([]);
    s.set("A1", "=B1");
    s.set("B1", "=A1");
    s.set("C1", "=A1+1");
    expect(s.get("C1")).toEqual(CIRC);
  });
  it("breaking the cycle recomputes its cells", () => {
    const s = new Sheet([]);
    s.set("A1", "=B1");
    s.set("B1", "=A1");
    s.set("C1", "=B1*2");
    s.set("A1", "5");
    expect([s.get("A1"), s.get("B1"), s.get("C1")]).toEqual([5, 5, 10]);
  });
  it("a range that covers its own cell is #CIRC!", () => {
    const s = new Sheet([[1], [2]]);
    s.set("A3", "=SUM(A1:A3)");
    expect(s.get("A3")).toEqual(CIRC);
  });
});

describe("Sheet: functionsUsed", () => {
  it("card example", () => {
    const s = new Sheet([[1], [2]]);
    s.set("B1", "=IF(SUM(A1:A2)>1,ROUND(A1,0),0)");
    expect(s.functionsUsed("B1")).toEqual(["IF", "SUM", "ROUND"]);
  });
  it("lower-case input is reported uppercase, once", () => {
    const s = new Sheet([]);
    s.set("A1", "=sumif(B1:B2,\">1\")+SUMIF(B1:B2,\"<0\")");
    expect(s.functionsUsed("A1")).toEqual(["SUMIF"]);
  });
  it("literal cells use no functions", () => expect(new Sheet([[1]]).functionsUsed("A1")).toEqual([]));
});

describe("Sheet: spilled cells through the frozen API (T6)", () => {
  it("get() of a spilled cell returns its value; getFormula() is null", () => {
    const s = new Sheet([[1], [2]]);
    s.set("B1", "=A1:A2");
    expect(s.get("B2")).toBe(2);
    expect(s.getFormula("B2")).toBeNull();
    expect(s.getFormula("B1")).toBe("=A1:A2");
  });
  it("functionsUsed belongs to the anchor only", () => {
    const s = new Sheet([["b"], ["a"]]);
    s.set("B1", "=SORT(A1:A2)");
    expect(s.functionsUsed("B1")).toEqual(["SORT"]);
    expect(s.functionsUsed("B2")).toEqual([]);
  });
  it("a starting-grid literal blocks a starting-grid spill", () => {
    const s = new Sheet([[1, "=A1:A2"], [2, "x"]]);
    expect(s.get("B1")).toEqual({ error: "#SPILL!" });
    expect(s.get("B2")).toBe("x");
  });
  it("a parse error on the anchor keeps the spill", () => {
    const s = new Sheet([[1], [2]]);
    s.set("B1", "=A1:A2");
    expect(() => s.set("B1", "=SUM(")).toThrow(ParseError);
    expect([s.get("B1"), s.get("B2")]).toEqual([1, 2]);
  });
});
