import { afterEach, describe, expect, it, vi } from "vitest";
import { tokenize } from "../src/tokenizer";
import { parse } from "../src/parser";
import {
  evaluate, functionNames, type CellValue, type ErrorCode, type EvalContext, type ExcelError, type Matrix,
} from "../src/evaluator";

// Evaluates a formula against a literal grid (grid[0][0] is A1).
function ev(src: string, grid: CellValue[][] = []): CellValue | Matrix {
  const ctx: EvalContext = {
    cell: (row, col) => grid[row]?.[col] ?? null,
    usedRows: () => grid.length,
    usedCols: () => Math.max(0, ...grid.map((row) => row.length)),
  };
  return evaluate(parse(tokenize(src)), ctx);
}

const err = (code: ErrorCode): ExcelError => ({ error: code });

describe("evaluate: card precedence examples", () => {
  it("=-2^2 is 4", () => expect(ev("=-2^2")).toBe(4));
  it("=2^3^2 is 64", () => expect(ev("=2^3^2")).toBe(64));
  it("=1+2*3 is 7", () => expect(ev("=1+2*3")).toBe(7));
  it('="a"&"b"="AB" is TRUE', () => expect(ev('="a"&"b"="AB"')).toBe(true));
  it("=50% is 0.5", () => expect(ev("=50%")).toBe(0.5));
});

describe("evaluate: arithmetic and coercion", () => {
  it("+ - * /", () => {
    expect(ev("=7-2")).toBe(5);
    expect(ev("=6*7")).toBe(42);
    expect(ev("=7/2")).toBe(3.5);
  });
  it('numeric text coerces: "3"+1 = 4', () => expect(ev('="3"+1')).toBe(4));
  it("TRUE+1 = 2", () => expect(ev("=TRUE+1")).toBe(2));
  it("empty cell is 0", () => expect(ev("=A1+5", [[null]])).toBe(5));
  it("unary minus on a ref", () => expect(ev("=-A1", [[3]])).toBe(-3));
  it("% on a ref", () => expect(ev("=A1%", [[25]])).toBe(0.25));
  it("a formula pointing at an empty cell shows 0", () => expect(ev("=A1", [[null]])).toBe(0));
});

describe("evaluate: & joins as text", () => {
  it('TRUE&"" = "TRUE"', () => expect(ev('=TRUE&""')).toBe("TRUE"));
  it('1.5&"" = "1.5"', () => expect(ev('=1.5&""')).toBe("1.5"));
  it("empty cell joins as empty text", () => expect(ev('="x"&A1&"y"', [[null]])).toBe("xy"));
});

describe("evaluate: comparisons", () => {
  it("numbers", () => {
    expect(ev("=1<2")).toBe(true);
    expect(ev("=2<=2")).toBe(true);
    expect(ev("=3>=4")).toBe(false);
    expect(ev("=1<>1")).toBe(false);
  });
  it("text is case-insensitive", () => {
    expect(ev('="abc"="ABC"')).toBe(true);
    expect(ev('="apple"<"Banana"')).toBe(true);
  });
  it("number < text < boolean across types", () => {
    expect(ev('=999<"a"')).toBe(true);
    expect(ev('="zzz"<FALSE')).toBe(true);
    expect(ev("=1=TRUE")).toBe(false);
  });
  it("an empty cell equals 0 and empty text", () => {
    expect(ev("=A1=0", [[null]])).toBe(true);
    expect(ev('=A1=""', [[null]])).toBe(true);
  });
});

describe("evaluate: errors", () => {
  it("#DIV/0! from =1/0", () => expect(ev("=1/0")).toEqual(err("#DIV/0!")));
  it("#N/A from a VLOOKUP miss", () => {
    expect(ev('=VLOOKUP("z",A1:B2,2,FALSE)', [["a", 1], ["b", 2]])).toEqual(err("#N/A"));
  });
  it("#N/A from a VLOOKUP over an empty table (not 0)", () => {
    expect(ev("=VLOOKUP(1,A1:B3,2)", [[null, null], [null, null], [null, null]])).toEqual(err("#N/A"));
  });
  it("#N/A from an HLOOKUP miss", () => {
    expect(ev('=HLOOKUP("z",A1:B2,2,FALSE)', [["a", "b"], [1, 2]])).toEqual(err("#N/A"));
  });
  it("#N/A from an XLOOKUP miss", () => expect(ev('=XLOOKUP("z",A1:A2,B1:B2)', [["a", 1], ["b", 2]])).toEqual(err("#N/A")));
  it('#VALUE! from ="a"+1', () => expect(ev('="a"+1')).toEqual(err("#VALUE!")));
  it("#REF! from =A0", () => expect(ev("=A0")).toEqual(err("#REF!")));
  it("#REF! from an off-sheet column", () => expect(ev("=XFE1")).toEqual(err("#REF!")));
  it("#NAME? from =NOPE(1)", () => expect(ev("=NOPE(1)")).toEqual(err("#NAME?")));
  it("#NAME? from an unknown name", () => expect(ev("=foo+1")).toEqual(err("#NAME?")));
  it("#NUM! from =SQRT(-1)", () => expect(ev("=SQRT(-1)")).toEqual(err("#NUM!")));
  it("error literal evaluates to itself", () => expect(ev("=#N/A")).toEqual(err("#N/A")));
  it("left error operand wins", () => expect(ev("=(1/0)+NOPE()")).toEqual(err("#DIV/0!")));
  it("error in a cell propagates", () => expect(ev("=A1*2", [[err("#NUM!")]])).toEqual(err("#NUM!")));
});

describe("evaluate: array results (T6)", () => {
  it("a range result is a 2-D array", () => expect(ev("=A1:A3", [[1], [2], [3]])).toEqual([[1], [2], [3]]));
  it("a 1×1 range result is just its value", () => expect(ev("=A1:A1", [[4]])).toBe(4));
  it("empty cells in an array result read as 0", () => expect(ev("=A1:A2", [[null], [2]])).toEqual([[0], [2]]));
  it("range op scalar works per element", () => expect(ev("=A1:A3*2", [[1], [2], [3]])).toEqual([[2], [4], [6]]));
  it("scalar op range works per element", () => expect(ev("=10-A1:B1", [[1, 2]])).toEqual([[9, 8]]));
  it("two ranges of the same size pair up", () => {
    expect(ev("=A1:A2+B1:B2", [[1, 10], [2, 20]])).toEqual([[11], [22]]);
  });
  it("a column and a row broadcast to a table", () => {
    expect(ev("=A1:A2*B1:C1", [[1, 10, 100], [2]])).toEqual([[10, 100], [20, 200]]);
  });
  it("mismatched sizes give #N/A where one side runs out", () => {
    expect(ev("=A1:A3+B1:B2", [[1, 1], [2, 2], [3]])).toEqual([[2], [4], [err("#N/A")]]);
  });
  it("comparisons on a range give booleans", () => {
    expect(ev('=A1:A3="b"', [["a"], ["B"], ["c"]])).toEqual([[false], [true], [false]]);
  });
  it("& joins per element", () => expect(ev('=A1:A2&"!"', [["a"], [1]])).toEqual([["a!"], ["1!"]]));
  it("unary minus and % work per element", () => {
    expect(ev("=-A1:A2", [[1], [2]])).toEqual([[-1], [-2]]);
    expect(ev("=A1:A2%", [[50], [10]])).toEqual([[0.5], [0.1]]);
  });
  it("an error in one element stays in that element", () => {
    expect(ev("=A1:A2*2", [[err("#NUM!")], [3]])).toEqual([[err("#NUM!")], [6]]);
  });
  it("SUM over an array expression", () => expect(ev("=SUM(A1:A3*2)", [[1], [2], [3]])).toBe(12));
  it("SUMPRODUCT with a condition array", () => {
    expect(ev("=SUMPRODUCT((A1:A3>1)*B1:B3)", [[1, 10], [2, 20], [3, 30]])).toBe(50);
  });
  it("IF passes an array branch through", () => {
    expect(ev("=IF(TRUE,A1:A2,0)", [[1], [2]])).toEqual([[1], [2]]);
  });
  it("IFERROR passes an array through", () => {
    expect(ev('=IFERROR(A1:A2,"x")', [[1], [2]])).toEqual([[1], [2]]);
  });
});

describe("evaluate: IFERROR and IFNA work per element on arrays", () => {
  it('IFERROR(1/A1:A2,"z") replaces only the error element', () => {
    expect(ev('=IFERROR(1/A1:A2,"z")', [[1], [0]])).toEqual([[1], ["z"]]);
  });
  it("SUM(IFERROR(1/A1:A2,0)) sums what's left", () => {
    expect(ev("=SUM(IFERROR(1/A1:A2,0))", [[1], [0]])).toBe(1);
  });
  it("an array fallback pairs up element by element", () => {
    expect(ev("=IFERROR(1/A1:A3,B1:B3)", [[0, "a"], [2, "b"], [0, "c"]])).toEqual([["a"], [0.5], ["c"]]);
  });
  it("a single-cell fallback broadcasts", () => {
    expect(ev("=IFERROR(A1:B1/0,C1)", [[1, 2, "none"]])).toEqual([["none", "none"]]);
  });
  it("an array with no errors is unchanged and the fallback isn't evaluated", () => {
    expect(ev("=IFERROR(A1:A2*2,NOPE())", [[1], [2]])).toEqual([[2], [4]]);
  });
  it("IFERROR stays lazy for a scalar", () => expect(ev("=IFERROR(5,1/0)")).toBe(5));
  it("IFNA replaces only #N/A, per element", () => {
    const na = err("#N/A");
    expect(ev('=IFNA(A1:A3,"-")', [[na], [err("#DIV/0!")], [3]])).toEqual([["-"], [err("#DIV/0!")], [3]]);
  });
  it("IFNA on a scalar", () => {
    expect(ev('=IFNA(NA(),"x")')).toBe("x");
    expect(ev('=IFNA(1/0,"x")')).toEqual(err("#DIV/0!"));
    expect(ev("=IFNA(4,1/0)")).toBe(4);
  });
});

describe("evaluate: functions", () => {
  it("SUM over a range", () => expect(ev("=SUM(A1:A3)", [[1], [2], [3]])).toBe(6));
  it("name lookup is case-insensitive", () => expect(ev("=sum(1,2)")).toBe(3));
  it("SUMIF from the card", () => {
    const grid = [["Region", "Sales"], ["East", 120], ["West", 80], ["East", 50]];
    expect(ev('=SUMIF(A2:A4,"East",B2:B4)', grid)).toBe(170);
  });
  it("COUNT from the SPEC §5 example", () => {
    const grid = [["Item", "Qty"], ["Pens", 12], ["Tape", "n/a"], ["Clips", 40], ["Glue", 7], ["Ink", 3]];
    expect(ev("=COUNT(B2:B6)", grid)).toBe(4);
  });
  it('COUNTIF ">100"', () => expect(ev('=COUNTIF(A1:A4,">100")', [[120], [80], [150], [null]])).toBe(2));
  it('COUNTIF "E*" (wildcard, case-insensitive)', () => {
    expect(ev('=COUNTIF(A1:A4,"E*")', [["East"], ["West"], ["east"], ["Eagle"]])).toBe(3);
  });
  it('COUNTIF "?ast"', () => {
    expect(ev('=COUNTIF(A1:A4,"?ast")', [["East"], ["West"], ["Past"], ["Feast"]])).toBe(2);
  });
  it("COUNTIF with a criteria cell that is empty counts zeros", () => {
    expect(ev("=COUNTIF(A1:A4,B1)", [[0, null], [null], [0], [7]])).toBe(2);
  });
  it('COUNTIF "#N/A" counts #N/A cells', () => {
    expect(ev('=COUNTIF(A1:A3,"#N/A")', [[err("#N/A")], [1], [err("#N/A")]])).toBe(2);
  });
  it("error-valued criteria match error cells", () =>
    expect(ev("=COUNTIF(A1:A3,NA())", [[err("#N/A")], [1], [err("#N/A")]])).toBe(2));
  it("multi-cell criteria retain T12 array behavior", () =>
    expect(ev("=COUNTIF(A1:A3,A1:A2)", [[1], [1], [2]])).toBe(2));
  it("SUMIFS with two criteria", () => {
    const grid = [["East", "Q1", 10], ["East", "Q2", 20], ["West", "Q1", 30], ["East", "Q1", 5]];
    expect(ev('=SUMIFS(C1:C4,A1:A4,"East",B1:B4,"Q1")', grid)).toBe(15);
  });
  it("whole column clipped to the used rows", () => expect(ev("=SUM(A:A)", [[1], [2], [4]])).toBe(7));
  it("a lone integer remains a number", () => expect(ev("=3")).toBe(3));
  it("whole rows clip to used columns", () => {
    expect(ev("=SUM(2:2)", [[1, 10, null], [2, 20, 200]])).toBe(222);
    expect(ev("=COUNT(2:2)", [[1, 10, null], [2, 20, "x"]])).toBe(2);
  });
  it("COUNTIF works on whole rows", () => expect(ev('=COUNTIF(2:2,">10")', [[1, 10, null], [2, 20, 200]])).toBe(2));
  it("nested calls", () => expect(ev("=ROUND(AVERAGE(1,2,2),1)")).toBe(1.7));
  it("dotted names", () => expect(ev("=STDEV.S(2,4,4,4,5,5,7,9)")).toBeCloseTo(2.138, 3));
  it("DATE returns an Excel serial number", () => expect(ev("=DATE(2024,1,1)")).toBe(45292));
});

describe("evaluate: DATEVALUE is timezone-independent", () => {
  afterEach(() => vi.unstubAllEnvs());

  for (const tz of ["UTC", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Kiritimati"]) {
    it(`gives whole-day serials under ${tz}`, () => {
      vi.stubEnv("TZ", tz);
      expect(ev('=DATEVALUE("2024-01-01")')).toBe(45292);
      expect(ev('=DATEVALUE("1/1/2024")')).toBe(45292);
      expect(ev('=DATEVALUE("2024-03-15")')).toBe(45366);
    });
  }

  it("rejects text that isn't a date", () => expect(ev('=DATEVALUE("hello")')).toEqual(err("#VALUE!")));
});

describe("evaluate: lazy IF, IFERROR, AND, OR", () => {
  it("IF(TRUE,1,1/0) = 1", () => expect(ev("=IF(TRUE,1,1/0)")).toBe(1));
  it("IF picks the else branch", () => expect(ev('=IF(A1>5,"big","small")', [[3]])).toBe("small"));
  it("IF(A1,,0) = 0 when A1 is FALSE", () => expect(ev("=IF(A1,,0)", [[false]])).toBe(0));
  it("IF with no else is FALSE", () => expect(ev("=IF(FALSE,1)")).toBe(false));
  it("IFERROR replaces an error", () => expect(ev('=IFERROR(1/0,"none")')).toBe("none"));
  it("IFERROR passes a value through", () => expect(ev("=IFERROR(2,1/0)")).toBe(2));
  it("AND stops at the first FALSE", () => expect(ev("=AND(FALSE,1/0)")).toBe(false));
  it("OR stops at the first TRUE", () => expect(ev("=OR(TRUE,1/0)")).toBe(true));
  it("AND over a range ignores text and blanks", () => {
    expect(ev("=AND(A1:A3)", [[true], ["x"], [null]])).toBe(true);
  });
});

describe("functionNames", () => {
  it("unique uppercase names in first-use order, nested included", () => {
    const ast = parse(tokenize("=IF(SUM(A1:A2)>1,ROUND(A1,0),sum(1))"));
    expect(functionNames(ast)).toEqual(["IF", "SUM", "ROUND"]);
  });
});
