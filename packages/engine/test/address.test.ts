import { describe, expect, it } from "vitest";
import {
  columnToIndex,
  formatAddress,
  indexToColumn,
  MAX_COLS,
  MAX_ROWS,
  parseAddress,
  parseArea,
} from "../src/address";

describe("address: columns", () => {
  it("A is 0, Z is 25, AA is 26", () => {
    expect(columnToIndex("A")).toBe(0);
    expect(columnToIndex("Z")).toBe(25);
    expect(columnToIndex("AA")).toBe(26);
  });
  it("XFD is the last column", () => expect(columnToIndex("XFD")).toBe(MAX_COLS - 1));
  it("index back to letters", () => {
    expect(indexToColumn(0)).toBe("A");
    expect(indexToColumn(27)).toBe("AB");
    expect(indexToColumn(MAX_COLS - 1)).toBe("XFD");
  });
});

describe("address: cells", () => {
  it("A1 is grid[0][0]", () => expect(parseAddress("A1")).toEqual({ row: 0, col: 0 }));
  it("C5 is row 4, col 2", () => expect(parseAddress("C5")).toEqual({ row: 4, col: 2 }));
  it("strips $ from absolute and mixed refs", () => {
    expect(parseAddress("$B$3")).toEqual({ row: 2, col: 1 });
    expect(parseAddress("B$3")).toEqual({ row: 2, col: 1 });
    expect(parseAddress("$B3")).toEqual({ row: 2, col: 1 });
  });
  it("is case-insensitive", () => expect(parseAddress("b2")).toEqual({ row: 1, col: 1 }));
  it("round-trips through formatAddress", () => {
    for (const a of ["A1", "Z99", "AA10", "XFD1048576"]) expect(formatAddress(parseAddress(a)!)).toBe(a);
  });
  it("A0 is off-sheet", () => expect(parseAddress("A0")).toBeNull());
  it("XFE1 is off-sheet", () => expect(parseAddress("XFE1")).toBeNull());
  it("row past the last row is off-sheet", () => expect(parseAddress(`A${MAX_ROWS + 1}`)).toBeNull());
  it("malformed text is not an address", () => {
    expect(parseAddress("1A")).toBeNull();
    expect(parseAddress("A")).toBeNull();
    expect(parseAddress("")).toBeNull();
  });
});

describe("address: areas", () => {
  it("cell range, normalised so top-left comes first", () => {
    expect(parseArea("B3", "A1")).toEqual({ top: 0, left: 0, bottom: 2, right: 1 });
  });
  it("whole columns span every row", () => {
    expect(parseArea("B", "$C")).toEqual({ top: 0, left: 1, bottom: MAX_ROWS - 1, right: 2 });
  });
  it("an off-sheet corner makes the area invalid", () => expect(parseArea("A0", "B2")).toBeNull());
});
