import { describe, expect, it } from "vitest";
import { evaluate, type CellValue, type EvalContext, type Matrix } from "../src/evaluator";
import { parse } from "../src/parser";
import { tokenize } from "../src/tokenizer";

function ev(src: string, grid: CellValue[][] = []): CellValue | Matrix {
  const ctx: EvalContext = {
    cell: (row, col) => grid[row]?.[col] ?? null,
    usedRows: () => grid.length,
    usedCols: () => Math.max(0, ...grid.map((row) => row.length)),
  };
  return evaluate(parse(tokenize(src)), ctx);
}

describe("element-wise function lifting", () => {
  const cases: [string, CellValue[][], CellValue | Matrix][] = [
    ['=LEN(A1:A3)', [["a"], ["abcd"], [""]], [[1], [4], [0]]],
    ['=ROUND(A1:A3,1)', [[1.24], [2.26], [-1.25]], [[1.2], [2.3], [-1.3]]],
    ['=ABS(A1:A3)', [[-2], [0], [3]], [[2], [0], [3]]],
    ['=UPPER(A1:A3)', [["ab"], ["cde"], ["f"]], [["AB"], ["CDE"], ["F"]]],
    ['=NOT(A1:A3>1)', [[0], [2], [3]], [[true], [false], [false]]],
    ['=ISNUMBER(A1:A3)', [[1], ["x"], [2]], [[true], [false], [true]]],
    ['=TEXTBEFORE(A1:A3,"-")', [["a-b"], ["x-y-z"], ["plain"]], [["a"], ["x"], [{ error: "#N/A" }]]],
    ['=IF(A1:A3>1,"Y","N")', [[0], [2], [3]], [["N"], ["Y"], ["Y"]]],
  ];
  for (const [formula, grid, expected] of cases) {
    it(`${formula} lifts over array values`, () => expect(ev(formula, grid)).toEqual(expected));
  }

  it("two single-value array arguments broadcast by the existing rules", () => {
    expect(ev("=ROUND(A1:A2*B1:C1,0)", [[1.1, 2.1, 3.1], [2.2]])).toEqual([[2, 3], [5, 7]]);
  });
  it("a mismatch in single-value arrays yields #N/A at missing cells", () => {
    expect(ev("=ROUND(A1:A3+B1:B2,0)", [[1, 1], [2, 2], [3]])).toEqual([[2], [4], [{ error: "#N/A" }]]);
  });
  it("IF remains lazy with a scalar condition", () => expect(ev("=IF(TRUE,7,1/0)")).toBe(7));
  it("IF with a scalar condition can return an array branch", () => {
    expect(ev("=IF(TRUE,A1:A2,0)", [[1], [2]])).toEqual([[1], [2]]);
  });
  it("range taking functions still receive whole arrays", () => expect(ev("=SUM(LEN(A1:A3))", [["a"], ["ab"], ["abc"]])).toBe(6));
  it("COUNT still counts a whole range", () => expect(ev("=COUNT(A1:A3)", [[1], ["x"], [2]])).toBe(2));
  it("TEXTJOIN still joins a whole range", () => expect(ev('=TEXTJOIN(",",TRUE,A1:A3)', [["a"], [null], ["b"]])).toBe("a,b"));
  const extra: [string, CellValue[][], CellValue | Matrix][] = [
    ['=LEN(A1:A2)', [[""], ["abc"]], [[0], [3]]], ['=LEN(A1:A2)', [["x"], ["yz"]], [[1], [2]]],
    ['=LEN(A1:A2)', [["four"], ["five!"]], [[4], [5]]], ['=LEN(A1:A2)', [["q"], ["rr"]], [[1], [2]]],
    ['=ROUND(A1:A2,0)', [[1.2], [1.8]], [[1], [2]]], ['=ROUND(A1:A2,2)', [[1.234], [2.345]], [[1.23], [2.35]]],
    ['=ROUND(A1:A2,1)', [[-1.24], [-2.26]], [[-1.2], [-2.3]]], ['=ROUND(A1:A2,-1)', [[14], [16]], [[10], [20]]],
    ['=ABS(A1:A2)', [[-5], [-7]], [[5], [7]]], ['=ABS(A1:A2)', [[-0.5], [0.5]], [[0.5], [0.5]]],
    ['=ABS(A1:A2)', [[0], [-1]], [[0], [1]]], ['=ABS(A1:A2)', [[-9], [4]], [[9], [4]]],
    ['=UPPER(A1:A2)', [["abc"], ["def"]], [["ABC"], ["DEF"]]], ['=UPPER(A1:A2)', [["X"], ["yZ"]], [["X"], ["YZ"]]],
    ['=UPPER(A1:A2)', [["one two"], ["three"]], [["ONE TWO"], ["THREE"]]], ['=UPPER(A1:A2)', [["a1"], ["b2"]], [["A1"], ["B2"]]],
    ['=NOT(A1:A2)', [[true], [false]], [[false], [true]]], ['=NOT(A1:A2)', [[0], [1]], [[true], [false]]],
    ['=NOT(A1:A2)', [[false], [true]], [[true], [false]]], ['=NOT(A1:A2)', [[2], [0]], [[false], [true]]],
    ['=ISNUMBER(A1:A2)', [[1], ["1"]], [[true], [false]]], ['=ISNUMBER(A1:A2)', [[null], [2]], [[false], [true]]],
    ['=ISNUMBER(A1:A2)', [[true], [0]], [[false], [true]]], ['=ISNUMBER(A1:A2)', [[-3], ["x"]], [[true], [false]]],
    ['=IF(A1:A2>0,1,0)', [[-1], [1]], [[0], [1]]], ['=IF(A1:A2>0,"yes","no")', [[0], [2]], [["no"], ["yes"]]],
    ['=TEXTBEFORE(A1:A2,"/")', [["a/b"], ["c/d"]], [["a"], ["c"]]], ['=TEXTBEFORE(A1:A2,"-")', [["a-b-c"], ["c-d"]], [["a"], ["c"]]],
  ];
  for (const [formula, grid, expected] of extra) {
    it(`${formula} lifts a second input`, () => expect(ev(formula, grid)).toEqual(expected));
  }
});
