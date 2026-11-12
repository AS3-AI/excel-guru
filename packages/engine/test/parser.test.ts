import { describe, expect, it } from "vitest";
import { tokenize } from "../src/tokenizer";
import { parse, ParseError, type Ast } from "../src/parser";

// S-expression form, e.g. "(^ (neg 2) 2)", so precedence is visible at a glance.
function show(ast: Ast): string {
  switch (ast.type) {
    case "num": return String(ast.value);
    case "str": return JSON.stringify(ast.value);
    case "bool": return ast.value ? "TRUE" : "FALSE";
    case "error": return ast.code;
    case "ref": return ast.ref;
    case "range": return `${ast.from}:${ast.to}`;
    case "name": return `name:${ast.name}`;
    case "empty": return "_";
    case "unary": return `(${ast.op === "-" ? "neg" : "pos"} ${show(ast.operand)})`;
    case "percent": return `(% ${show(ast.operand)})`;
    case "binary": return `(${ast.op} ${show(ast.left)} ${show(ast.right)})`;
    case "call": return `${ast.name}(${ast.args.map(show).join(", ")})`;
  }
}

const p = (src: string) => show(parse(tokenize(src)));

function parseError(src: string): ParseError {
  try {
    parse(tokenize(src));
  } catch (e) {
    if (e instanceof ParseError) return e;
    throw e;
  }
  throw new Error(`expected ParseError for ${src}`);
}

describe("parse: card precedence examples", () => {
  it("=-2^2 is (-2)^2", () => expect(p("=-2^2")).toBe("(^ (neg 2) 2)"));
  it("=1+2*3 is 1+(2*3)", () => expect(p("=1+2*3")).toBe("(+ 1 (* 2 3))"));
  it("=A1&B1=C1 is (A1&B1)=C1", () => expect(p("=A1&B1=C1")).toBe("(= (& A1 B1) C1)"));
});

describe("parse: literals and references", () => {
  it("number", () => expect(parse(tokenize("=1.5E+3"))).toEqual({ type: "num", value: 1500 }));
  it("string", () => expect(parse(tokenize('="a""b"'))).toEqual({ type: "str", value: 'a"b' }));
  it("boolean", () => expect(p("=FALSE")).toBe("FALSE"));
  it("error literal", () => expect(p("=#N/A")).toBe("#N/A"));
  it("cell ref", () => expect(p("=$A$1")).toBe("$A$1"));
  it("cell range", () => expect(p("=A1:B10")).toBe("A1:B10"));
  it("whole-column range", () => expect(p("=B:C")).toBe("B:C"));
  it("unknown name", () => expect(p("=foo")).toBe("name:FOO"));
});

describe("parse: operator precedence and associativity", () => {
  it("* before +, left to right", () => expect(p("=1*2+3*4")).toBe("(+ (* 1 2) (* 3 4))"));
  it("- is left-associative", () => expect(p("=10-4-3")).toBe("(- (- 10 4) 3)"));
  it("/ is left-associative", () => expect(p("=8/4/2")).toBe("(/ (/ 8 4) 2)"));
  it("^ is left-associative in Excel", () => expect(p("=2^3^2")).toBe("(^ (^ 2 3) 2)"));
  it("^ before *", () => expect(p("=2*3^2")).toBe("(* 2 (^ 3 2))"));
  it("% before ^", () => expect(p("=2^50%")).toBe("(^ 2 (% 50))"));
  it("unary minus before %", () => expect(p("=-5%")).toBe("(% (neg 5))"));
  it("unary minus in exponent", () => expect(p("=2^-1")).toBe("(^ 2 (neg 1))"));
  it("double negation", () => expect(p("=--A1")).toBe("(neg (neg A1))"));
  it("unary plus", () => expect(p("=+A1")).toBe("(pos A1)"));
  it("+ before &", () => expect(p('=1+2&"x"')).toBe('(& (+ 1 2) "x")'));
  it("& before comparison", () => expect(p('="a"&"b"<>"ab"')).toBe('(<> (& "a" "b") "ab")'));
  it.each(["=", "<>", "<", ">", "<=", ">="])("comparison %s is lowest", (op) =>
    expect(p(`=1+1${op}2*1`)).toBe(`(${op} (+ 1 1) (* 2 1))`));
  it("comparisons chain left to right", () => expect(p("=1<2=TRUE")).toBe("(= (< 1 2) TRUE)"));
  it("parentheses override precedence", () => expect(p("=(1+2)*3")).toBe("(* (+ 1 2) 3)"));
  it("range binds tighter than unary minus", () => expect(p("=-A1:A2")).toBe("(neg A1:A2)"));
});

describe("parse: functions", () => {
  it("no arguments", () => expect(p("=TODAY()")).toBe("TODAY()"));
  it("one argument", () => expect(p("=SUM(A1:A3)*2")).toBe("(* SUM(A1:A3) 2)"));
  it("several arguments", () => expect(p('=SUMIF(A2:A4,"East",B2:B4)')).toBe('SUMIF(A2:A4, "East", B2:B4)'));
  it("nested functions", () =>
    expect(p("=IF(SUM(A1:A3)>10,MAX(B1,ROUND(C1,2)),0)")).toBe(
      "IF((> SUM(A1:A3) 10), MAX(B1, ROUND(C1, 2)), 0)",
    ));
  it("empty middle argument", () => expect(p("=IF(A1,,0)")).toBe("IF(A1, _, 0)"));
  it("empty first and last arguments", () => expect(p("=F(,1,)")).toBe("F(_, 1, _)"));
  it("single empty argument from a lone comma", () => expect(p("=F(,)")).toBe("F(_, _)"));
  it("expressions as arguments", () => expect(p("=ROUND(-A1*2%,0)")).toBe("ROUND((* (neg A1) (% 2)), 0)"));
});

describe("parse: errors", () => {
  it("missing closing paren names the opener", () => {
    const e = parseError("=(1+2");
    expect(e.message).toMatch(/missing closing parenthesis/i);
    expect(e.pos).toBe(1);
  });
  it("missing closing paren on a function call", () => {
    const e = parseError("=SUM(1,2");
    expect(e.message).toMatch(/missing closing parenthesis/i);
    expect(e.pos).toBe(4);
  });
  it("nested unclosed paren points at the innermost", () => expect(parseError("=SUM((1)").pos).toBe(4));
  it("extra closing paren", () => {
    const e = parseError("=1+2)");
    expect(e.message).toMatch(/unmatched closing parenthesis/i);
    expect(e.pos).toBe(4);
  });
  it("empty parentheses", () => expect(parseError("=()").message).toMatch(/unexpected/i));
  it("empty formula", () => expect(parseError("=").message).toMatch(/empty formula/i));
  it("dangling operator", () => expect(parseError("=1+").message).toMatch(/unexpected end/i));
  it("two values with no operator", () => expect(parseError("=1 2").pos).toBe(3));
  it("operator with no left side", () => expect(parseError("=*2").pos).toBe(1));
  it("missing comma between arguments", () => expect(parseError("=SUM(1 2)").pos).toBe(7));
  it("range mixing a cell and a column", () => expect(parseError("=A1:C").message).toMatch(/range/i));
  it("range mixing a column and a cell", () => expect(parseError("=B:C3").message).toMatch(/range/i));
  it("range end must be a reference", () => expect(parseError("=A1:5").message).toMatch(/range/i));
  it("chained range", () => expect(parseError("=A1:B2:C3").pos).toBe(6));
  it("lone colon", () => expect(parseError("=:").pos).toBe(1));
});
