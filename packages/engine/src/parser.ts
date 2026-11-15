import type { Token } from "./tokenizer";

export type BinaryOp = "+" | "-" | "*" | "/" | "^" | "&" | "=" | "<>" | "<" | ">" | "<=" | ">=";

export type Ast =
  | { type: "num"; value: number }
  | { type: "str"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "error"; code: string }
  | { type: "ref"; ref: string }
  | { type: "range"; from: string; to: string }
  | { type: "name"; name: string }
  | { type: "empty" } // an omitted function argument, as in IF(A1,,0)
  | { type: "unary"; op: "-" | "+"; operand: Ast }
  | { type: "percent"; operand: Ast }
  | { type: "binary"; op: BinaryOp; left: Ast; right: Ast }
  | { type: "call"; name: string; args: Ast[] };

export class ParseError extends Error {
  constructor(
    message: string,
    readonly pos: number,
  ) {
    super(`${message} at position ${pos}`);
    this.name = "ParseError";
  }
}

// Binding powers, lowest to highest (SPEC §3). `:` is handled inside primary
// expressions, so it binds tighter than everything here.
const INFIX_BP: Record<string, number> = {
  "=": 10, "<>": 10, "<": 10, ">": 10, "<=": 10, ">=": 10,
  "&": 20,
  "+": 30, "-": 30,
  "*": 40, "/": 40,
  "^": 50, // left-associative in Excel: 2^3^2 = 64
};
const PERCENT_BP = 60;
const PREFIX_BP = 70; // unary minus binds tighter than ^, so -2^2 = 4

const isColumn = (ref: string) => /^\$?[A-Z]+$/.test(ref);
const isRow = (ref: string) => /^\$?\d+$/.test(ref);

export function parse(tokens: Token[]): Ast {
  let i = 0;
  // Positions of "(" not yet closed, so a missing ")" can point at its opener.
  const open: number[] = [];

  const peek = (): Token | undefined => tokens[i];
  const endPos = () => {
    const last = tokens[tokens.length - 1];
    return last ? last.pos + Math.max(last.value.length, 1) : 0;
  };

  function unexpected(tok: Token | undefined): never {
    if (!tok) throw new ParseError("Unexpected end of formula", endPos());
    const text = tok.type === "STR" ? `"${tok.value}"` : tok.value || describe(tok);
    throw new ParseError(`Unexpected ${text}`, tok.pos);
  }

  function closeParen() {
    const tok = peek();
    if (!tok) throw new ParseError("Missing closing parenthesis for '('", open[open.length - 1] ?? endPos());
    if (tok.type !== "RPAREN") unexpected(tok);
    open.pop();
    i++;
  }

  function expr(minBp: number): Ast {
    let left = prefix();
    for (;;) {
      const tok = peek();
      if (tok?.type !== "OP") break;
      if (tok.value === "%") {
        if (PERCENT_BP <= minBp) break;
        i++;
        left = { type: "percent", operand: left };
        continue;
      }
      const bp = INFIX_BP[tok.value];
      if (bp === undefined || bp <= minBp) break;
      i++;
      left = { type: "binary", op: tok.value as BinaryOp, left, right: expr(bp) };
    }
    return left;
  }

  function prefix(): Ast {
    const tok = peek();
    if (!tok) unexpected(tok);
    i++;
    switch (tok.type) {
      case "NUM":
        if (peek()?.type === "COLON") return rowRange(tok);
        return { type: "num", value: Number(tok.value) };
      case "STR":
        return { type: "str", value: tok.value };
      case "BOOL":
        return { type: "bool", value: tok.value === "TRUE" };
      case "ERROR":
        return { type: "error", code: tok.value };
      case "NAME":
        return { type: "name", name: tok.value };
      case "REF":
        return reference(tok);
      case "OP":
        if (tok.value === "-" || tok.value === "+") {
          return { type: "unary", op: tok.value, operand: expr(PREFIX_BP) };
        }
        break;
      case "LPAREN": {
        open.push(tok.pos);
        const inner = expr(0);
        closeParen();
        return inner;
      }
      case "FUNC":
        return call(tok);
    }
    i--;
    unexpected(tok);
  }

  function reference(tok: Token): Ast {
    if (peek()?.type !== "COLON") {
      if (isColumn(tok.value)) throw new ParseError("Whole-column reference must be part of a range", tok.pos);
      return { type: "ref", ref: tok.value };
    }
    const colon = peek()!;
    i++;
    const end = peek();
    if (end?.type !== "REF") {
      if (end?.type === "NUM" && /^\d+$/.test(end.value)) {
        if (isRow(tok.value) && validRow(tok.value) && Number(end.value) > 0) {
          i++;
          return { type: "range", from: tok.value, to: end.value };
        }
        i++;
        throw new ParseError("Range must join two rows", tok.pos);
      }
      throw new ParseError("Range must end in a cell or column reference", end?.pos ?? colon.pos);
    }
    i++;
    const isCell = (ref: string) => !isColumn(ref) && !isRow(ref);
    const sameKind = (isColumn(tok.value) && isColumn(end.value)) ||
      (isRow(tok.value) && isRow(end.value)) ||
      (isCell(tok.value) && isCell(end.value));
    if (!sameKind) {
      throw new ParseError("Range endpoints must have the same kind", tok.pos);
    }
    if (isRow(tok.value) && (!validRow(tok.value) || !validRow(end.value))) throw new ParseError("Row numbers must be positive integers", tok.pos);
    return { type: "range", from: tok.value, to: end.value };
  }

  function rowRange(tok: Token): Ast {
    const colon = peek()!;
    i++;
    const end = peek();
    if (!end || !((end.type === "NUM" && /^\d+$/.test(end.value)) || (end.type === "REF" && isRow(end.value)))) {
      throw new ParseError("Range must join two rows", end?.pos ?? colon.pos);
    }
    if (!/^\d+$/.test(tok.value) || Number(tok.value) < 1 || (end.type === "NUM" ? Number(end.value) < 1 : !validRow(end.value)))
      throw new ParseError("Row numbers must be positive integers", tok.pos);
    i++;
    return { type: "range", from: tok.value, to: end.value };
  }

  function validRow(ref: string): boolean { return /^\$?[1-9]\d*$/.test(ref); }

  function call(tok: Token): Ast {
    const paren = peek();
    if (paren?.type !== "LPAREN") unexpected(paren); // tokenizer only emits FUNC before "("
    open.push(paren.pos);
    i++;

    const args: Ast[] = [];
    if (peek()?.type === "RPAREN") {
      closeParen();
      return { type: "call", name: tok.value, args };
    }
    for (;;) {
      const next = peek()?.type;
      args.push(next === "COMMA" || next === "RPAREN" ? { type: "empty" } : expr(0));
      if (peek()?.type === "COMMA") {
        i++;
        continue;
      }
      closeParen();
      return { type: "call", name: tok.value, args };
    }
  }

  if (tokens.length === 0) throw new ParseError("Empty formula", 0);
  const ast = expr(0);
  const extra = peek();
  if (extra?.type === "RPAREN") throw new ParseError("Unmatched closing parenthesis", extra.pos);
  if (extra) unexpected(extra);
  return ast;
}

function describe(tok: Token): string {
  switch (tok.type) {
    case "LPAREN": return "'('";
    case "RPAREN": return "')'";
    case "COMMA": return "','";
    case "COLON": return "':'";
    default: return tok.type;
  }
}
