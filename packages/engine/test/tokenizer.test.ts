import { describe, expect, it } from "vitest";
import { tokenize, TokenizeError, type Token } from "../src/tokenizer";

// Compact "TYPE value" form, e.g. ["FUNC SUM", "LPAREN", "REF A1"].
function t(src: string): string[] {
  return tokenize(src).map((tok: Token) => (tok.value === "" ? tok.type : `${tok.type} ${tok.value}`));
}

describe("tokenize: card example", () => {
  it("=SUM(A1:A3)*2", () => {
    expect(t("=SUM(A1:A3)*2")).toEqual([
      "FUNC SUM", "LPAREN", "REF A1", "COLON", "REF A3", "RPAREN", "OP *", "NUM 2",
    ]);
  });
});

describe("tokenize: numbers", () => {
  it("integer", () => expect(t("=42")).toEqual(["NUM 42"]));
  it("decimal", () => expect(t("=3.14")).toEqual(["NUM 3.14"]));
  it("leading dot", () => expect(t("=.5")).toEqual(["NUM .5"]));
  it("exponent", () => expect(t("=1.5E+3")).toEqual(["NUM 1.5E+3"]));
  it("negative exponent, lowercase e", () => expect(t("=2e-4")).toEqual(["NUM 2e-4"]));
  it("minus is a separate operator", () => expect(t("=-2")).toEqual(["OP -", "NUM 2"]));
  it("malformed exponent throws", () => expect(() => tokenize("=1E+")).toThrow(TokenizeError));
  it.each(["=2A1", "=1.2.3", "=1e2e3", "=3_x"])("number glued to more text throws: %s", (src) =>
    expect(() => tokenize(src)).toThrow(TokenizeError));
});

describe("tokenize: strings", () => {
  it("simple string", () => expect(t('="East"')).toEqual(["STR East"]));
  it("empty string", () => expect(t('=""')).toEqual(["STR"]));
  it("doubled quotes unescape", () => expect(t('="say ""hi"""')).toEqual(['STR say "hi"']));
  it("only an escaped quote", () => expect(t('=""""')).toEqual(['STR "']));
  it("keeps spaces and operators inside", () => expect(t('="a, b + (c)"')).toEqual(["STR a, b + (c)"]));
  it("criteria string", () => expect(t('=">100"')).toEqual(["STR >100"]));
  it("unterminated string throws", () => expect(() => tokenize('="abc')).toThrow(TokenizeError));
});

describe("tokenize: booleans", () => {
  it("TRUE and FALSE", () => expect(t("=TRUE&FALSE")).toEqual(["BOOL TRUE", "OP &", "BOOL FALSE"]));
  it("case-insensitive", () => expect(t("=true")).toEqual(["BOOL TRUE"]));
  it("TRUE() is a function", () => expect(t("=TRUE()")).toEqual(["FUNC TRUE", "LPAREN", "RPAREN"]));
});

describe("tokenize: references", () => {
  it("absolute $A$1", () => expect(t("=$A$1")).toEqual(["REF $A$1"]));
  it("mixed $A1 and A$1", () => expect(t("=$A1+A$1")).toEqual(["REF $A1", "OP +", "REF A$1"]));
  it("lowercase is uppercased", () => expect(t("=b2")).toEqual(["REF B2"]));
  it("multi-letter column", () => expect(t("=XFD1048576")).toEqual(["REF XFD1048576"]));
  it("whole columns B:C", () => expect(t("=B:C")).toEqual(["REF B", "COLON", "REF C"]));
  it("absolute whole columns $B:$C", () => expect(t("=$B:$C")).toEqual(["REF $B", "COLON", "REF $C"]));
  it("range with absolute ends", () =>
    expect(t("=$A$1:B$10")).toEqual(["REF $A$1", "COLON", "REF B$10"]));
  it("unknown identifier is a NAME", () => expect(t("=foo")).toEqual(["NAME FOO"]));
  it("bare column letter without colon is a NAME", () => expect(t("=B")).toEqual(["NAME B"]));
  it("lone $column outside a range throws", () => expect(() => tokenize("=$B+1")).toThrow(TokenizeError));
  it("$column after a colon is a REF", () => expect(t("=B:$C")).toEqual(["REF B", "COLON", "REF $C"]));
});

describe("tokenize: functions", () => {
  it("case-insensitive name", () => expect(t("=sum(1)")).toEqual(["FUNC SUM", "LPAREN", "NUM 1", "RPAREN"]));
  it("dotted name", () => expect(t("=STDEV.S(A1:A2)")[0]).toBe("FUNC STDEV.S"));
  it("name that looks like a ref", () => expect(t("=LOG10(100)")[0]).toBe("FUNC LOG10"));
  it("nested with commas and empty arg", () =>
    expect(t("=IF(A1,,0)")).toEqual([
      "FUNC IF", "LPAREN", "REF A1", "COMMA", "COMMA", "NUM 0", "RPAREN",
    ]));
  it("SUMIF with criteria", () =>
    expect(t('=SUMIF(A2:A4,"East",B2:B4)')).toEqual([
      "FUNC SUMIF", "LPAREN", "REF A2", "COLON", "REF A4", "COMMA", "STR East", "COMMA",
      "REF B2", "COLON", "REF B4", "RPAREN",
    ]));
});

describe("tokenize: operators", () => {
  it("arithmetic", () =>
    expect(t("=1+2-3*4/5^6")).toEqual([
      "NUM 1", "OP +", "NUM 2", "OP -", "NUM 3", "OP *", "NUM 4", "OP /", "NUM 5", "OP ^", "NUM 6",
    ]));
  it("percent", () => expect(t("=50%")).toEqual(["NUM 50", "OP %"]));
  it("concatenation", () => expect(t("=A1&B1")).toEqual(["REF A1", "OP &", "REF B1"]));
  it("<> is one token", () => expect(t("=A1<>B1")).toEqual(["REF A1", "OP <>", "REF B1"]));
  it("<= and >= are one token", () =>
    expect(t("=A1<=1>=2")).toEqual(["REF A1", "OP <=", "NUM 1", "OP >=", "NUM 2"]));
  it("= < > comparisons", () =>
    expect(t("=1=2<3>4")).toEqual(["NUM 1", "OP =", "NUM 2", "OP <", "NUM 3", "OP >", "NUM 4"]));
  it("leading = is stripped, later = is an operator", () =>
    expect(t("=A1&B1=C1")).toEqual(["REF A1", "OP &", "REF B1", "OP =", "REF C1"]));
});

describe("tokenize: errors, whitespace, positions", () => {
  it.each(["#DIV/0!", "#N/A", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#SPILL!"])("error literal %s", (e) =>
    expect(t(`=${e}`)).toEqual([`ERROR ${e}`]));
  it("unknown error literal throws", () => expect(() => tokenize("=#BOGUS!")).toThrow(TokenizeError));
  it("skips whitespace", () => expect(t("= SUM ( 1 , 2 )")).toEqual([
    "FUNC SUM", "LPAREN", "NUM 1", "COMMA", "NUM 2", "RPAREN",
  ]));
  it("works without leading =", () => expect(t("1+1")).toEqual(["NUM 1", "OP +", "NUM 1"]));
  it("empty formula gives no tokens", () => expect(tokenize("=")).toEqual([]));
  it("records source positions", () =>
    expect(tokenize("=A1+ 2").map((x) => x.pos)).toEqual([1, 3, 5]));
  it("unexpected character throws with its position", () => {
    try {
      tokenize("=1 @ 2");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TokenizeError);
      expect((e as TokenizeError).pos).toBe(3);
    }
  });
});
