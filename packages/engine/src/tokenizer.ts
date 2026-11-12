export type TokenType =
  | "NUM"
  | "STR"
  | "BOOL"
  | "REF"
  | "NAME"
  | "FUNC"
  | "ERROR"
  | "OP"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "COLON";

/**
 * `value` is the token's text, normalised: strings unescaped, refs/names/functions
 * uppercased, empty for punctuation. `pos` is the offset in the source string.
 */
export type Token = { type: TokenType; value: string; pos: number };

export class TokenizeError extends Error {
  constructor(
    message: string,
    readonly pos: number,
  ) {
    super(`${message} at position ${pos}`);
    this.name = "TokenizeError";
  }
}

const ERRORS = ["#DIV/0!", "#N/A", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#SPILL!"];
const TWO_CHAR_OPS = ["<>", "<=", ">="];
const ONE_CHAR_OPS = "+-*/^&%=<>";
const PUNCT: Record<string, TokenType> = { "(": "LPAREN", ")": "RPAREN", ",": "COMMA", ":": "COLON" };

const NUMBER_RE = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_.]*/;
const CELL_RE = /^\$?[A-Za-z]{1,3}\$?\d+/;
const COLUMN_RE = /^\$?[A-Za-z]{1,3}/;
const CELL_ONLY_RE = /^\$?[A-Z]{1,3}\$?\d+$/;

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = src.startsWith("=") ? 1 : 0;

  const prev = () => tokens[tokens.length - 1];
  const nextNonSpace = (from: number) => {
    while (from < src.length && /\s/.test(src[from]!)) from++;
    return src[from];
  };

  while (i < src.length) {
    const ch = src[i]!;
    const rest = src.slice(i);

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '"') {
      let value = "";
      let j = i + 1;
      for (;;) {
        if (j >= src.length) throw new TokenizeError("Unterminated string", i);
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            value += '"';
            j += 2;
            continue;
          }
          break;
        }
        value += src[j];
        j++;
      }
      tokens.push({ type: "STR", value, pos: i });
      i = j + 1;
      continue;
    }

    if (ch === "#") {
      const err = ERRORS.find((e) => rest.toUpperCase().startsWith(e));
      if (!err) throw new TokenizeError("Unknown error literal", i);
      tokens.push({ type: "ERROR", value: err, pos: i });
      i += err.length;
      continue;
    }

    const num = NUMBER_RE.exec(rest);
    if (num) {
      if (/^[eE][+-]?(?!\d)/.test(rest.slice(num[0].length))) {
        throw new TokenizeError("Malformed number", i);
      }
      tokens.push({ type: "NUM", value: num[0], pos: i });
      i += num[0].length;
      continue;
    }

    // `$` can only start a reference: $A$1, $A1 or a whole column $B.
    if (ch === "$") {
      const cell = CELL_RE.exec(rest) ?? COLUMN_RE.exec(rest);
      if (!cell) throw new TokenizeError("Invalid reference", i);
      tokens.push({ type: "REF", value: cell[0].toUpperCase(), pos: i });
      i += cell[0].length;
      continue;
    }

    const ident = IDENT_RE.exec(rest);
    if (ident) {
      // A1$2-style mixed refs: the identifier regex stops at `$`, so try the ref form first.
      const cell = CELL_RE.exec(rest);
      const text = cell && cell[0].length > ident[0].length ? cell[0] : ident[0];
      const upper = text.toUpperCase();
      const after = i + text.length;

      let type: TokenType;
      if (nextNonSpace(after) === "(") type = "FUNC";
      else if (upper === "TRUE" || upper === "FALSE") type = "BOOL";
      else if (CELL_ONLY_RE.test(upper)) type = "REF";
      else if (/^[A-Z]{1,3}$/.test(upper) && (src[after] === ":" || prev()?.type === "COLON")) {
        type = "REF"; // whole column, as in B:C
      } else type = "NAME";

      tokens.push({ type, value: upper, pos: i });
      i = after;
      continue;
    }

    const two = rest.slice(0, 2);
    if (TWO_CHAR_OPS.includes(two)) {
      tokens.push({ type: "OP", value: two, pos: i });
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.includes(ch)) {
      tokens.push({ type: "OP", value: ch, pos: i });
      i++;
      continue;
    }

    const punct = PUNCT[ch];
    if (punct) {
      tokens.push({ type: punct, value: "", pos: i });
      i++;
      continue;
    }

    throw new TokenizeError(`Unexpected character "${ch}"`, i);
  }

  return tokens;
}
