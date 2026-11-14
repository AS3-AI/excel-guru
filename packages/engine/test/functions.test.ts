import { describe, expect, it } from "vitest";
import { tokenize } from "../src/tokenizer";
import { parse } from "../src/parser";
import { evaluate, type CellValue, type ErrorCode, type EvalContext, type ExcelError } from "../src/evaluator";
import { Sheet } from "../src/index";

// Evaluates a formula against a literal grid (grid[0][0] is A1).
function ev(src: string, grid: CellValue[][] = []): CellValue {
  const ctx: EvalContext = {
    cell: (row, col) => grid[row]?.[col] ?? null,
    usedRows: () => grid.length,
  };
  return evaluate(parse(tokenize(src)), ctx);
}

const err = (code: ErrorCode): ExcelError => ({ error: code });

// A1:A4 fruit names, B1:B4 their numbers.
const FRUIT: CellValue[][] = [["Apple", 1], ["Banana", 2], ["Cherry", 3], ["banana", 4]];
// A1:A4 sorted numbers, B1:B4 letters.
const TIERS: CellValue[][] = [[10, "a"], [20, "b"], [30, "c"], [40, "d"]];

describe("XLOOKUP: exact match", () => {
  it("finds a text value", () => expect(ev('=XLOOKUP("Cherry",A1:A4,B1:B4)', FRUIT)).toBe(3));
  it("text matching is case-insensitive and returns the first match", () => {
    expect(ev('=XLOOKUP("BANANA",A1:A4,B1:B4)', FRUIT)).toBe(2);
  });
  it("finds a number", () => expect(ev("=XLOOKUP(30,A1:A4,B1:B4)", TIERS)).toBe("c"));
  it("a number does not match numeric text", () => {
    expect(ev("=XLOOKUP(1,A1:A2,B1:B2)", [["1", "x"], ["2", "y"]])).toEqual(err("#N/A"));
  });
  it("lookup value from a cell", () => {
    expect(ev("=XLOOKUP(C1,A1:A4,B1:B4)", [["Apple", 1, "cherry"], ["Banana", 2], ["Cherry", 3], ["banana", 4]])).toBe(3);
  });
});

describe("XLOOKUP: not found", () => {
  it("no match gives #N/A", () => expect(ev('=XLOOKUP("Kiwi",A1:A4,B1:B4)', FRUIT)).toEqual(err("#N/A")));
  it("no match gives if_not_found when given", () => {
    expect(ev('=XLOOKUP("Kiwi",A1:A4,B1:B4,"none")', FRUIT)).toBe("none");
  });
  it("if_not_found is ignored on a match", () => {
    expect(ev('=XLOOKUP("Apple",A1:A4,B1:B4,"none")', FRUIT)).toBe(1);
  });
  it("wildcards are literal in exact mode", () => {
    expect(ev('=XLOOKUP("ch*",A1:A4,B1:B4)', FRUIT)).toEqual(err("#N/A"));
  });
});

describe("XLOOKUP: reverse search", () => {
  it("search_mode -1 returns the last match", () => {
    expect(ev('=XLOOKUP("banana",A1:A4,B1:B4,,0,-1)', FRUIT)).toBe(4);
  });
  it("search_mode 1 returns the first match", () => {
    expect(ev('=XLOOKUP("banana",A1:A4,B1:B4,,0,1)', FRUIT)).toBe(2);
  });
  it("binary search modes on sorted data", () => {
    expect(ev("=XLOOKUP(20,A1:A4,B1:B4,,0,2)", TIERS)).toBe("b");
    expect(ev("=XLOOKUP(25,A1:A4,B1:B4,,-1,2)", TIERS)).toBe("b");
    expect(ev("=XLOOKUP(20,A1:A4,B1:B4,,0,-2)", [[40, "d"], [30, "c"], [20, "b"], [10, "a"]])).toBe("b");
  });
});

describe("XLOOKUP: wildcard match_mode 2", () => {
  it("* matches any run", () => expect(ev('=XLOOKUP("ch*",A1:A4,B1:B4,,2)', FRUIT)).toBe(3));
  it("? matches one character, reverse search", () => {
    expect(ev('=XLOOKUP("?ANANA",A1:A4,B1:B4,,2,-1)', FRUIT)).toBe(4);
  });
  it("~ escapes a wildcard character", () => {
    const grid: CellValue[][] = [["ab", 1], ["a*", 2]];
    expect(ev('=XLOOKUP("a~*",A1:A2,B1:B2,,2)', grid)).toBe(2);
    expect(ev('=XLOOKUP("a*",A1:A2,B1:B2,,2)', grid)).toBe(1);
  });
  it("no wildcard match gives if_not_found", () => {
    expect(ev('=XLOOKUP("z*",A1:A4,B1:B4,"-",2)', FRUIT)).toBe("-");
  });
});

describe("XLOOKUP: approximate match_mode -1 and 1", () => {
  it("-1 takes the next smaller item", () => expect(ev("=XLOOKUP(25,A1:A4,B1:B4,,-1)", TIERS)).toBe("b"));
  it("1 takes the next larger item", () => expect(ev("=XLOOKUP(25,A1:A4,B1:B4,,1)", TIERS)).toBe("c"));
  it("an exact match wins over the neighbours", () => {
    expect(ev("=XLOOKUP(30,A1:A4,B1:B4,,-1)", TIERS)).toBe("c");
    expect(ev("=XLOOKUP(30,A1:A4,B1:B4,,1)", TIERS)).toBe("c");
  });
  it("nothing smaller / larger gives #N/A", () => {
    expect(ev("=XLOOKUP(5,A1:A4,B1:B4,,-1)", TIERS)).toEqual(err("#N/A"));
    expect(ev("=XLOOKUP(50,A1:A4,B1:B4,,1)", TIERS)).toEqual(err("#N/A"));
  });
  it("does not need sorted data", () => {
    const grid: CellValue[][] = [[30, "c"], [10, "a"], [25, "x"], [40, "d"]];
    expect(ev("=XLOOKUP(27,A1:A4,B1:B4,,-1)", grid)).toBe("x");
    expect(ev("=XLOOKUP(12,A1:A4,B1:B4,,1)", grid)).toBe("x");
  });
});

describe("XLOOKUP: shapes and errors", () => {
  it("lookup and return arrays of different lengths give #VALUE!", () => {
    expect(ev('=XLOOKUP("Apple",A1:A4,B1:B3)', FRUIT)).toEqual(err("#VALUE!"));
  });
  it("searches a row and returns from another row", () => {
    const grid: CellValue[][] = [["Q1", "Q2", "Q3"], [100, 200, 300]];
    expect(ev('=XLOOKUP("q2",A1:C1,A2:C2)', grid)).toBe(200);
  });
  it("a multi-column return_array gives the matched row's first value (until T6 spills)", () => {
    const grid: CellValue[][] = [["a", 1, "x"], ["b", 2, "y"]];
    expect(ev('=XLOOKUP("b",A1:A2,B1:C2)', grid)).toBe(2);
  });
  it("a 2-D lookup_array gives #VALUE!", () => {
    expect(ev('=XLOOKUP("a",A1:B2,C1:C2)', [["a", "b"], ["c", "d"]])).toEqual(err("#VALUE!"));
  });
  it("an invalid match_mode or search_mode gives #VALUE!", () => {
    expect(ev('=XLOOKUP("Apple",A1:A4,B1:B4,,3)', FRUIT)).toEqual(err("#VALUE!"));
    expect(ev('=XLOOKUP("Apple",A1:A4,B1:B4,,0,0)', FRUIT)).toEqual(err("#VALUE!"));
  });
  it("an error lookup value propagates", () => {
    expect(ev("=XLOOKUP(1/0,A1:A4,B1:B4)", TIERS)).toEqual(err("#DIV/0!"));
  });
});

describe("TEXTBEFORE / TEXTAFTER", () => {
  const T = '"Red-Green-Blue"';
  it("first instance by default", () => {
    expect(ev(`=TEXTBEFORE(${T},"-")`)).toBe("Red");
    expect(ev(`=TEXTAFTER(${T},"-")`)).toBe("Green-Blue");
  });
  it("instance_num 2", () => {
    expect(ev(`=TEXTBEFORE(${T},"-",2)`)).toBe("Red-Green");
    expect(ev(`=TEXTAFTER(${T},"-",2)`)).toBe("Blue");
  });
  it("negative instance_num counts from the end", () => {
    expect(ev(`=TEXTBEFORE(${T},"-",-1)`)).toBe("Red-Green");
    expect(ev(`=TEXTAFTER(${T},"-",-1)`)).toBe("Blue");
    expect(ev(`=TEXTBEFORE(${T},"-",-2)`)).toBe("Red");
    expect(ev(`=TEXTAFTER(${T},"-",-2)`)).toBe("Green-Blue");
  });
  it("multi-character delimiter", () => {
    expect(ev('=TEXTAFTER("ana@example.com","@")')).toBe("example.com");
    expect(ev('=TEXTBEFORE("one, two, three",", ")')).toBe("one");
  });
  it("matching is case-sensitive by default", () => {
    expect(ev('=TEXTBEFORE("Hello World","WORLD")')).toEqual(err("#N/A"));
    expect(ev('=TEXTAFTER("aXbxc","x")')).toBe("c");
  });
  it("match_mode 1 is case-insensitive", () => {
    expect(ev('=TEXTBEFORE("Hello World","WORLD",,1)')).toBe("Hello ");
    expect(ev('=TEXTAFTER("aXbxc","x",1,1)')).toBe("bxc");
  });
  it("match_end 1 treats the end of text as a delimiter", () => {
    expect(ev('=TEXTBEFORE("Red","-",,,1)')).toBe("Red");
    expect(ev('=TEXTAFTER("Red","-",,,1)')).toBe("");
    expect(ev(`=TEXTBEFORE(${T},"-",3,,1)`)).toBe("Red-Green-Blue");
    expect(ev(`=TEXTAFTER(${T},"-",3,,1)`)).toBe("");
  });
  it("match_end 1 with a negative instance treats the start as a delimiter", () => {
    expect(ev('=TEXTAFTER("Red","-",-1,,1)')).toBe("Red");
    expect(ev('=TEXTBEFORE("Red","-",-1,,1)')).toBe("");
  });
  it("delimiter not found gives #N/A, or if_not_found", () => {
    expect(ev('=TEXTAFTER("Red","-")')).toEqual(err("#N/A"));
    expect(ev('=TEXTAFTER("Red","-",,,,"none")')).toBe("none");
    expect(ev('=TEXTBEFORE("Red","-",,,,"none")')).toBe("none");
  });
  it("instance_num beyond the occurrences gives #N/A, or if_not_found", () => {
    expect(ev(`=TEXTBEFORE(${T},"-",3)`)).toEqual(err("#N/A"));
    expect(ev(`=TEXTAFTER(${T},"-",-3,,,"?")`)).toBe("?");
  });
  it("instance_num 0 or longer than the text gives #VALUE!", () => {
    expect(ev('=TEXTBEFORE("a-b","-",0)')).toEqual(err("#VALUE!"));
    expect(ev('=TEXTAFTER("a-b","-",4)')).toEqual(err("#VALUE!"));
    expect(ev('=TEXTAFTER("a-b","-",-4)')).toEqual(err("#VALUE!"));
  });
  it("an empty delimiter matches immediately", () => {
    expect(ev('=TEXTBEFORE("abc","")')).toBe("");
    expect(ev('=TEXTAFTER("abc","")')).toBe("abc");
    expect(ev('=TEXTBEFORE("abc","",-1)')).toBe("abc");
    expect(ev('=TEXTAFTER("abc","",-1)')).toBe("");
  });
  it("reads cells and turns numbers into text", () => {
    expect(ev('=TEXTBEFORE(A1,".")', [[12.5]])).toBe("12");
    expect(ev('=TEXTAFTER(A1," ")', [["Ada Lovelace"]])).toBe("Lovelace");
  });
  it("an error argument propagates", () => {
    expect(ev('=TEXTBEFORE(1/0,"-")')).toEqual(err("#DIV/0!"));
  });
});

describe("VLOOKUP / HLOOKUP", () => {
  const PRICES: CellValue[][] = [["Pens", 12], ["Tape", 3], ["Clips", 40]];
  it("exact match, case-insensitive", () => expect(ev('=VLOOKUP("tape",A1:B3,2,FALSE)', PRICES)).toBe(3));
  it("exact match understands wildcards", () => expect(ev('=VLOOKUP("Cl*",A1:B3,2,FALSE)', PRICES)).toBe(40));
  it("an empty table gives #N/A", () => {
    const empty: CellValue[][] = [[null, null, "x"], [null, null], [null, null]];
    expect(ev('=VLOOKUP("Pens",A1:B3,2,FALSE)', empty)).toEqual(err("#N/A"));
    expect(ev("=VLOOKUP(5,A1:B3,2,TRUE)", empty)).toEqual(err("#N/A"));
    expect(ev("=VLOOKUP(5,A1:B3,2)", empty)).toEqual(err("#N/A"));
  });
  it("approximate match takes the largest value not above the lookup", () => {
    expect(ev("=VLOOKUP(25,A1:B4,2,TRUE)", TIERS)).toBe("b");
    expect(ev("=VLOOKUP(40,A1:B4,2)", TIERS)).toBe("d");
    expect(ev("=VLOOKUP(99,A1:B4,2)", TIERS)).toBe("d");
  });
  it("approximate match below the first value gives #N/A", () => {
    expect(ev("=VLOOKUP(5,A1:B4,2,TRUE)", TIERS)).toEqual(err("#N/A"));
  });
  it("an empty range_lookup argument means exact match", () => {
    expect(ev("=VLOOKUP(25,A1:B4,2,)", TIERS)).toEqual(err("#N/A"));
  });
  it("col_index_num past the table gives #REF!, below 1 gives #VALUE!", () => {
    expect(ev('=VLOOKUP("Pens",A1:B3,3,FALSE)', PRICES)).toEqual(err("#REF!"));
    expect(ev('=VLOOKUP("Pens",A1:B3,0,FALSE)', PRICES)).toEqual(err("#VALUE!"));
  });
  it("HLOOKUP exact match", () => {
    expect(ev('=HLOOKUP("q2",A1:C2,2,FALSE)', [["Q1", "Q2", "Q3"], [100, 200, 300]])).toBe(200);
  });
  it("HLOOKUP with no match or an empty table gives #N/A", () => {
    expect(ev('=HLOOKUP("Q9",A1:C2,2,FALSE)', [["Q1", "Q2", "Q3"], [100, 200, 300]])).toEqual(err("#N/A"));
    expect(ev("=HLOOKUP(5,A1:C2,2)", [])).toEqual(err("#N/A"));
  });
});

describe("COUNTIF family: criteria from an empty cell", () => {
  // A1:A5 holds 0, blank, 0, 0, blank (three zeros, two blanks); C is a sum column; D1 is empty.
  const G: CellValue[][] = [[0, null, 1], [null, null, 2], [0, null, 4], [0, null, 8], [null, null, 16]];
  it("a reference to an empty cell counts zeros, not blanks", () => expect(ev("=COUNTIF(A1:A5,D1)", G)).toBe(3));
  it("an omitted criterion counts zeros", () => expect(ev("=COUNTIF(A1:A5,)", G)).toBe(3));
  it('a literal "" still counts blanks', () => expect(ev('=COUNTIF(A1:A5,"")', G)).toBe(2));
  it("COUNTIFS treats the empty cell as 0", () => expect(ev("=COUNTIFS(A1:A5,D1,C1:C5,\">1\")", G)).toBe(2));
  it("SUMIF treats the empty cell as 0", () => expect(ev("=SUMIF(A1:A5,D1,C1:C5)", G)).toBe(13));
  it("works through Sheet: COUNTIF(B2:B6,Y1) with Y1 empty", () => {
    const s = new Sheet([["Item", "Qty"], ["a", 0], ["b", null], ["c", 3], ["d", 0], ["e", 0]]);
    s.set("C1", "=COUNTIF(B2:B6,Y1)");
    expect(s.get("C1")).toBe(3);
    s.set("Y1", "3");
    expect(s.get("C1")).toBe(1);
  });
});

describe("COUNTIF family: error criteria", () => {
  const G: CellValue[][] = [[err("#N/A"), 1], [5, 2], [err("#DIV/0!"), 4], [err("#N/A"), 8], [null, 16]];
  it('"#N/A" counts #N/A cells', () => expect(ev('=COUNTIF(A1:A5,"#N/A")', G)).toBe(2));
  it('"=#DIV/0!" counts #DIV/0! cells', () => expect(ev('=COUNTIF(A1:A5,"=#DIV/0!")', G)).toBe(1));
  it('"<>#N/A" counts everything else, blanks included', () => expect(ev('=COUNTIF(A1:A5,"<>#N/A")', G)).toBe(3));
  it("SUMIF skips the error rows", () => expect(ev('=SUMIF(A1:A5,"<>#N/A",B1:B5)', G)).toBe(22));
  it("an error criterion does not match text that looks like it", () => {
    expect(ev('=COUNTIF(A1:A2,"#N/A")', [["#N/A"], [err("#N/A")]])).toBe(1);
  });
});
