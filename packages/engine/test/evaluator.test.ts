import { afterEach, describe, expect, it, vi } from "vitest";
import { tokenize } from "../src/tokenizer";
import { parse } from "../src/parser";
import { evaluate, functionNames, type CellValue, type ErrorCode, type EvalContext, type ExcelError } from "../src/evaluator";

// Evaluates a formula against a literal grid (grid[0][0] is A1).
function ev(src: string, grid: CellValue[][] = []): CellValue {
  const ctx: EvalContext = {
    cell: (row, col) => grid[row]?.[col] ?? null,
    usedRows: () => grid.length,
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
  it("a range result is #VALUE! until spilling lands", () => {
    expect(ev("=A1:A3", [[1], [2], [3]])).toEqual(err("#VALUE!"));
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
  it("SUMIFS with two criteria", () => {
    const grid = [["East", "Q1", 10], ["East", "Q2", 20], ["West", "Q1", 30], ["East", "Q1", 5]];
    expect(ev('=SUMIFS(C1:C4,A1:A4,"East",B1:B4,"Q1")', grid)).toBe(15);
  });
  it("whole column clipped to the used rows", () => expect(ev("=SUM(A:A)", [[1], [2], [4]])).toBe(7));
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
