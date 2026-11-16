import { describe, expect, it } from "vitest";
import { tokenize } from "../src/tokenizer";
import { parse } from "../src/parser";
import { evaluate, type CellValue, type ErrorCode, type EvalContext, type ExcelError, type Matrix } from "../src/evaluator";
import { Sheet } from "../src/index";

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

describe("Excel text function differences", () => {
  it("SEARCH supports case-insensitive wildcards", () => {
    expect(ev('=SEARCH("w*d","hello world")')).toBe(7);
    expect(ev('=SEARCH("?o","hello world")')).toBe(4);
  });
  it("SEARCH lets tilde escape wildcard characters", () => {
    expect(ev('=SEARCH("~*","a*b")')).toBe(2);
    expect(ev('=SEARCH("~?","a?b")')).toBe(2);
  });
  it("SEARCH returns VALUE when no match exists", () => {
    expect(ev('=SEARCH("z","hello")')).toEqual(err("#VALUE!"));
  });
  it("SEARCH honors start_num", () => {
    expect(ev('=SEARCH("a","banana",3)')).toBe(4);
  });
  it("FIND remains literal and case-sensitive", () => {
    expect(ev('=FIND("A","aA")')).toBe(2);
    expect(ev('=FIND("*","a*b")')).toBe(2);
    expect(ev('=FIND("A","a")')).toEqual(err("#VALUE!"));
  });
  it("PROPER capitalizes after every non-letter and lowercases other letters", () => {
    expect(ev('=PROPER("o\'neil smith")')).toBe("O'Neil Smith");
    expect(ev('=PROPER("2nd place")')).toBe("2Nd Place");
    expect(ev('=PROPER("e-mail")')).toBe("E-Mail");
  });
  it("PROPER treats punctuation and whitespace as word boundaries", () => {
    expect(ev('=PROPER("HELLO\tWORLD!yes")')).toBe("Hello\tWorld!Yes");
  });
  it("LEFT and RIGHT return VALUE for negative lengths", () => {
    expect(ev('=LEFT("hello",-1)')).toEqual(err("#VALUE!"));
    expect(ev('=RIGHT("hello",-1)')).toEqual(err("#VALUE!"));
  });
  it("LEFT and RIGHT return empty text for zero length", () => {
    expect(ev('=LEFT("hello",0)')).toBe("");
    expect(ev('=RIGHT("hello",0)')).toBe("");
  });
  it("LEFT and RIGHT default omitted length to one", () => {
    expect(ev('=LEFT("hello")')).toBe("h");
    expect(ev('=RIGHT("hello")')).toBe("o");
  });
  it("LEFT and RIGHT return all text when length exceeds its size", () => {
    expect(ev('=LEFT("hello",9)')).toBe("hello");
    expect(ev('=RIGHT("hello",9)')).toBe("hello");
  });
});

describe("MATCH", () => {
  it("finds exact text case-insensitively and exact numbers", () => {
    expect(ev('=MATCH("BEN",A1:A3,0)', [["Al"], ["Ben"], ["Cy"]])).toBe(2);
    expect(ev("=MATCH(30,A1:A3,0)", [[10], [30], [50]])).toBe(2);
  });
  it("supports * ? and ~ wildcards in exact mode", () => {
    expect(ev('=MATCH("ka*",A1:A3,0)', [["Kavya"], ["Ben"], ["Kara"]])).toBe(1);
    expect(ev('=MATCH("B?n",A1:A3,0)', [["Ben"], ["Bun"], ["Bo"]])).toBe(1);
    expect(ev('=MATCH("a~~?",A1:A2,0)', [["a~?"], ["a~x"]])).toBe(1);
  });
  it("returns #N/A when there is no exact match", () => {
    expect(ev('=MATCH("Kiwi",A1:A2,0)', [["Apple"], ["Pear"]])).toEqual(err("#N/A"));
  });
  it("uses the last value not above the key for type 1 and omitted type", () => {
    expect(ev("=MATCH(60,A1:A3,1)", [[0], [50], [75]])).toBe(2);
    expect(ev("=MATCH(60,A1:A3)", [[0], [50], [75]])).toBe(2);
    expect(ev("=MATCH(40,A1:A3,1)", [[10], [50], [30]])).toBe(1);
    expect(ev("=MATCH(5,A1:A3,2)", [[1], [10], [20]])).toBe(1);
  });
  it("uses approximate type 1 list order even when text is unsorted", () => {
    expect(ev('=MATCH("Omar",A1:A6,1)', [["Kavya"], ["Ben"], ["Lina"], ["Omar"], ["Jay"], ["Ravi"]])).toBe(5);
  });
  it("uses the last value not below the key for type -1", () => {
    expect(ev("=MATCH(60,A1:A3,-1)", [[90], [75], [50]])).toBe(2);
    expect(ev("=MATCH(40,A1:A3,-1)", [[50], [10], [45]])).toBe(1);
    expect(ev("=MATCH(5,A1:A3,-2)", [[10], [1], [0]])).toBe(1);
  });
  it("returns #N/A when type -1 has no qualifying value", () => {
    expect(ev("=MATCH(100,A1:A3,-1)", [[90], [75], [50]])).toEqual(err("#N/A"));
  });
  it("rejects a two-dimensional lookup range", () => {
    expect(ev("=MATCH(2,A1:B2,0)", [[1, 2], [3, 4]])).toEqual(err("#N/A"));
  });
  it("accepts a one-row range across columns", () => {
    expect(ev('=MATCH("Cy",A1:C1,0)', [["Al", "Bo", "Cy"]])).toBe(3);
  });
  it("counts positions from the range first cell", () => {
    expect(ev('=MATCH("Bo",B2:B4,0)', [[0], [0, "Al"], [0, "Bo"], [0, "Cy"]])).toBe(2);
  });
  it("skips blanks in approximate mode", () => {
    expect(ev("=MATCH(60,A1:A4,1)", [[0], [null], [50], [75]])).toBe(3);
  });
  it("works inside INDEX", () => {
    expect(ev('=INDEX(B1:B3,MATCH("Bo",A1:A3,0))', [["Al", 100], ["Bo", 350], ["Cy", 500]])).toBe(350);
  });
});

describe("ISERROR, ISERR, ISNA and ERROR.TYPE", () => {
  it("recognizes direct and computed errors", () => {
    expect(ev("=ISERROR(#N/A)")).toBe(true);
    expect(ev("=ISERR(#N/A)")).toBe(false);
    expect(ev("=ISNA(#N/A)")).toBe(true);
    expect(ev("=ISERROR(1/0)")).toBe(true);
    expect(ev("=ISERR(1/0)")).toBe(true);
    expect(ev("=ISNA(1/0)")).toBe(false);
  });
  it("recognizes errors read from cells", () => {
    expect(ev("=ISERROR(A1)", [[err("#NUM!")]])).toBe(true);
    expect(ev("=ISERR(A1)", [[err("#N/A")]])).toBe(false);
    expect(ev("=ISNA(A1)", [[err("#N/A")]])).toBe(true);
  });
  it("spills error predicates over ranges", () => {
    const grid = [[err("#N/A")], [err("#DIV/0!")], [3]];
    expect(ev("=ISERROR(A1:A3)", grid)).toEqual([[true], [true], [false]]);
    expect(ev("=ISERR(A1:A3)", grid)).toEqual([[false], [true], [false]]);
    expect(ev("=ISNA(A1:A3)", grid)).toEqual([[true], [false], [false]]);
  });
  it("maps ERROR.TYPE codes and returns #N/A for unlisted errors", () => {
    const cases: [string, number][] = [["#DIV/0!", 2], ["#VALUE!", 3], ["#REF!", 4], ["#NAME?", 5], ["#NUM!", 6], ["#N/A", 7]];
    for (const [code, number] of cases) expect(ev(`=ERROR.TYPE(${code})`)).toBe(number);
    expect(ev("=ERROR.TYPE(A1)", [[err("#CIRC!")]])).toEqual(err("#N/A"));
    expect(ev("=ERROR.TYPE(4)")).toEqual(err("#N/A"));
  });
  it("other IS predicates return FALSE for errors, except parity predicates", () => {
    expect(ev("=ISNUMBER(1/0)")).toBe(false);
    expect(ev("=ISTEXT(1/0)")).toBe(false);
    expect(ev("=ISBLANK(1/0)")).toBe(false);
    expect(ev("=ISLOGICAL(1/0)")).toBe(false);
    expect(ev("=ISNONTEXT(1/0)")).toBe(false);
    expect(ev("=ISEVEN(1/0)")).toEqual(err("#DIV/0!"));
    expect(ev("=ISODD(1/0)")).toEqual(err("#DIV/0!"));
  });
  it("parity predicates propagate errors from cells", () => {
    expect(ev("=ISEVEN(A1)", [[err("#N/A")]])).toEqual(err("#N/A"));
    expect(ev("=ISODD(A1)", [[err("#NUM!")]])).toEqual(err("#NUM!"));
  });
  it("parity predicates propagate range errors element by element", () => {
    expect(ev("=ISEVEN(A1:A2)", [[err("#DIV/0!")], [2]])).toEqual([[err("#DIV/0!")], [true]]);
  });
  it("ISERROR is false for non-errors", () => {
    expect(ev("=ISERROR(42)")).toBe(false);
    expect(ev('=ISERROR("#N/A")')).toBe(false);
  });
  it("ISERR recognizes non-NA errors", () => {
    expect(ev("=ISERR(#VALUE!)")).toBe(true);
    expect(ev("=ISERR(A1)", [[err("#CIRC!")]])).toBe(true);
  });
  it("ISNA is false for other errors and ordinary values", () => {
    expect(ev("=ISNA(#REF!)")).toBe(false);
    expect(ev("=ISNA(0)")).toBe(false);
  });
  it("ERROR.TYPE spills across a range", () => {
    expect(ev("=ERROR.TYPE(A1:A2)", [[err("#DIV/0!")], [err("#N/A")]])).toEqual([[2], [7]]);
  });
  it("other IS predicates return false for errors in ranges", () => {
    const grid = [[err("#VALUE!")], [2]];
    expect(ev("=ISNUMBER(A1:A2)", grid)).toEqual([[false], [true]]);
    expect(ev("=ISTEXT(A1:A2)", grid)).toEqual([[false], [false]]);
    expect(ev("=ISBLANK(A1:A2)", grid)).toEqual([[false], [false]]);
    expect(ev("=ISLOGICAL(A1:A2)", grid)).toEqual([[false], [false]]);
    expect(ev("=ISNONTEXT(A1:A2)", grid)).toEqual([[false], [true]]);
  });
});

// A1:A4 fruit names, B1:B4 their numbers.
const FRUIT: CellValue[][] = [["Apple", 1], ["Banana", 2], ["Cherry", 3], ["banana", 4]];
// A1:A4 sorted numbers, B1:B4 letters.
const TIERS: CellValue[][] = [[10, "a"], [20, "b"], [30, "c"], [40, "d"]];

describe("INDEX", () => {
  const G: CellValue[][] = [[10, 20, 30, 40], [50, 60, 70, 80], [90, 100, 110, 120], [130, 140, 150, 160]];
  it("uses the single index for one-row and one-column arrays", () => {
    expect(ev("=INDEX(A1:D1,2)", G)).toBe(20);
    expect(ev("=INDEX(A1:A4,2)", G)).toBe(50);
  });
  it("returns a 2-D indexed value", () => expect(ev("=INDEX(A1:D4,3,2)", G)).toBe(100));
  it("row zero or omitted row spills the selected column", () => {
    expect(ev("=INDEX(A1:D4,0,2)", G)).toEqual([[20], [60], [100], [140]]);
    expect(ev("=INDEX(A1:D4,,2)", G)).toEqual([[20], [60], [100], [140]]);
  });
  it("a row index without a column spills that row in a 2-D array", () => {
    expect(ev("=INDEX(A1:D4,2)", G)).toEqual([[50, 60, 70, 80]]);
  });
  it("column zero spills the selected row", () => expect(ev("=INDEX(A1:D4,3,0)", G)).toEqual([[90, 100, 110, 120]]));
  it("both zero returns the whole array", () => expect(ev("=INDEX(A1:D4,0,0)", G)).toEqual(G));
  it("returns REF for indices beyond either dimension", () => {
    expect(ev("=INDEX(A1:D4,5,1)", G)).toEqual(err("#REF!"));
    expect(ev("=INDEX(A1:D4,1,5)", G)).toEqual(err("#REF!"));
  });
  it("a second index on a one-column array must be one", () => {
    expect(ev("=INDEX(A1:A4,2,1)", G)).toBe(50);
    expect(ev("=INDEX(A1:A4,2,2)", G)).toEqual(err("#REF!"));
  });
  it("a column index on a one-row array selects that column", () => {
    expect(ev("=INDEX(A1:D1,2,1)", G)).toEqual(err("#REF!"));
    expect(ev("=INDEX(A1:D1,1,2)", G)).toBe(20);
  });
  it("negative and non-numeric indices return VALUE", () => {
    expect(ev("=INDEX(A1:D4,-1,1)", G)).toEqual(err("#VALUE!"));
    expect(ev("=INDEX(A1:D4,-0.5,1)", G)).toEqual(err("#VALUE!"));
    expect(ev('=INDEX(A1:D4,"x",1)', G)).toEqual(err("#VALUE!"));
  });
  it("truncates fractional indices", () => expect(ev("=INDEX(A1:D4,2.9,1)", G)).toBe(50));
  it("propagates row and column errors", () => {
    expect(ev("=INDEX(A1:D4,1/0,1)", G)).toEqual(err("#DIV/0!"));
    expect(ev("=INDEX(A1:D4,1,NA())", G)).toEqual(err("#N/A"));
  });
  it("returns zero for a blank selected cell and for spilled blanks", () => {
    const grid: CellValue[][] = [[1, null], [null, 4]];
    expect(ev("=INDEX(A1:B2,1,2)", grid)).toBe(0);
    expect(ev("=INDEX(A1:B2,0,2)", grid)).toEqual([[0], [4]]);
  });
  it("works with MATCH vertically", () => {
    expect(ev('=INDEX(B1:B4,MATCH("Bo",A1:A4,0))', [["Al", 100], ["Bo", 350], ["Cy", 500], ["De", 700]])).toBe(350);
  });
  it("works with MATCH horizontally", () => {
    expect(ev('=INDEX(A2:D2,MATCH("Bo",A1:D1,0))', [["Al", "Bo", "Cy", "De"], [100, 350, 500, 700]])).toBe(350);
  });
  it("works with two MATCH functions in 2-D", () => {
    expect(ev('=INDEX(B2:D4,MATCH("R3",A2:A4,0),MATCH("Q2",B1:D1,0))', [["", "Q1", "Q2", "Q3"], ["R1", 1, 2, 3], ["R2", 4, 5, 6], ["R3", 7, 8, 9]])).toBe(8);
  });
  it("spills through Sheet so cells can read the result", () => {
    const s = new Sheet([[1, 2], [3, 4]]);
    s.set("D1", "=INDEX(A1:B2,0,2)");
    expect(s.get("D1")).toBe(2);
    expect(s.get("D2")).toBe(4);
  });
});

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
  it("a multi-column return_array gives the whole matched row (T6: it spills)", () => {
    const grid: CellValue[][] = [["a", 1, "x"], ["b", 2, "y"]];
    expect(ev('=XLOOKUP("b",A1:A2,B1:C2)', grid)).toEqual([[2, "y"]]);
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
