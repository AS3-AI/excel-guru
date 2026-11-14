import type { Ast, BinaryOp } from "./parser";
import { parseAddress, parseArea } from "./address";
import { lookupFunction, type Arg } from "./functions";

export type ErrorCode = "#DIV/0!" | "#N/A" | "#VALUE!" | "#REF!" | "#NAME?" | "#NUM!" | "#SPILL!" | "#CIRC!";
export type ExcelError = { error: ErrorCode };
export type CellValue = number | string | boolean | null | ExcelError;
/** A range's values, row by row; empty cells are null. */
export type Matrix = CellValue[][];

/** What the evaluator needs from a sheet. */
export interface EvalContext {
  cell(row: number, col: number): CellValue;
  /** Rows in use, so whole columns (B:C) can be clipped to them. */
  usedRows(): number;
}

type Value = CellValue | Matrix;

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export const isError = (v: unknown): v is ExcelError => typeof v === "object" && v !== null && "error" in v;
const err = (code: ErrorCode): ExcelError => ({ error: code });

/**
 * A formula's value for its cell: a single value, or a 2-D array (at least 2 cells) that the
 * sheet spills from the anchor down and right. A 1×1 array is just its value. Empty cells read
 * as 0, as in Excel (=A1 on an empty A1 shows 0, and so does an empty cell in a spill).
 */
export function evaluate(ast: Ast, ctx: EvalContext): CellValue | Matrix {
  const v = new Evaluator(ctx).eval(ast);
  if (!Array.isArray(v)) return v ?? 0;
  if (v.length === 0 || v[0]!.length === 0) return err("#VALUE!");
  if (v.length === 1 && v[0]!.length === 1) return v[0]![0] ?? 0;
  return v.map((row) => row.map((c) => c ?? 0));
}

/** Unique uppercase function names in first-use order, nested calls included. */
export function functionNames(ast: Ast): string[] {
  const names = new Set<string>();
  const walk = (node: Ast): void => {
    switch (node.type) {
      case "call":
        names.add(node.name.toUpperCase());
        node.args.forEach(walk);
        break;
      case "unary":
      case "percent":
        walk(node.operand);
        break;
      case "binary":
        walk(node.left);
        walk(node.right);
        break;
    }
  };
  walk(ast);
  return [...names];
}

class Evaluator {
  constructor(private readonly ctx: EvalContext) {}

  eval(ast: Ast): Value {
    switch (ast.type) {
      case "num":
      case "str":
      case "bool":
        return ast.value;
      case "error":
        return err(ast.code as ErrorCode);
      case "empty":
        return null;
      case "name":
        return err("#NAME?");
      case "ref": {
        const a = parseAddress(ast.ref);
        return a ? this.ctx.cell(a.row, a.col) : err("#REF!");
      }
      case "range":
        return this.range(ast.from, ast.to);
      case "unary": {
        const v = this.eval(ast.operand);
        if (ast.op === "+") return v; // Excel's unary plus leaves the value alone: =+"a" is "a"
        return lift1(v, (x) => {
          const n = toNumber(x);
          return isError(n) ? n : -n;
        });
      }
      case "percent":
        return lift1(this.eval(ast.operand), (x) => {
          const n = toNumber(x);
          return isError(n) ? n : n / 100;
        });
      case "binary": {
        const l = this.eval(ast.left);
        const r = this.eval(ast.right);
        return lift2(l, r, (a, b) => binary(ast.op, a, b));
      }
      case "call":
        return this.call(ast.name.toUpperCase(), ast.args);
    }
  }

  private scalar(ast: Ast): CellValue {
    return single(this.eval(ast));
  }

  private range(from: string, to: string): Value {
    const area = parseArea(from, to);
    if (!area) return err("#REF!");
    const wholeColumn = !/\d/.test(from);
    const bottom = wholeColumn ? Math.min(area.bottom, this.ctx.usedRows() - 1) : area.bottom;
    const rows: Matrix = [];
    for (let r = area.top; r <= bottom; r++) {
      const row: CellValue[] = [];
      for (let c = area.left; c <= area.right; c++) row.push(this.ctx.cell(r, c));
      rows.push(row);
    }
    return rows;
  }

  private call(name: string, args: Ast[]): Value {
    switch (name) {
      case "IF":
        return this.if(args);
      case "IFERROR":
        return this.iferror(args, () => true);
      case "IFNA":
        return this.iferror(args, (e) => e.error === "#N/A");
      case "AND":
        return this.logical(args, false);
      case "OR":
        return this.logical(args, true);
    }
    const fn = lookupFunction(name);
    if (!fn) return err("#NAME?");
    const values: Arg[] = args.map((a) => (a.type === "empty" ? undefined : this.eval(a)));
    try {
      return fn(...values);
    } catch {
      return err("#VALUE!");
    }
  }

  // Lazy: only the branch taken is evaluated, so IF(TRUE,1,1/0) = 1.
  private if(args: Ast[]): Value {
    if (args.length < 2 || args.length > 3) return err("#VALUE!");
    const cond = toBoolean(this.scalar(args[0]!));
    if (isError(cond)) return cond;
    const branch = cond ? args[1] : args[2];
    if (!branch) return false; // IF(FALSE,1) is FALSE
    return branch.type === "empty" ? 0 : this.eval(branch);
  }

  /**
   * IFERROR (any error) and IFNA (only #N/A). Lazy: the fallback is evaluated only when some
   * value needs it. On an array the test is per element, and an array fallback pairs up with
   * it under the operators' broadcasting rules, so IFERROR(1/A1:A2,"z") spills 1, "z".
   */
  private iferror(args: Ast[], catches: (e: ExcelError) => boolean): Value {
    if (args.length !== 2) return err("#VALUE!");
    const caught = (x: CellValue) => isError(x) && catches(x);
    const v = args[0]!.type === "empty" ? 0 : this.eval(args[0]!);
    const fallback = () => (args[1]!.type === "empty" ? 0 : this.eval(args[1]!));
    if (!Array.isArray(v)) return caught(v) ? fallback() : v;
    if (!v.some((row) => row.some(caught))) return v;
    return lift2(v, fallback(), (x, y) => (caught(x) ? y : x));
  }

  // AND (stopOn = false) and OR (stopOn = true) stop at the first value that decides them.
  // Text and blanks inside ranges or cells are skipped; literal text must read TRUE/FALSE.
  private logical(args: Ast[], stopOn: boolean): Value {
    let seen = false;
    for (const arg of args) {
      const fromCells = arg.type === "ref" || arg.type === "range";
      const v = arg.type === "empty" ? false : this.eval(arg);
      for (const cell of Array.isArray(v) ? v.flat() : [v]) {
        if (isError(cell)) return cell;
        let b: boolean;
        if (typeof cell === "boolean" || typeof cell === "number") b = Boolean(cell);
        else if (cell === null || (fromCells || Array.isArray(v))) continue;
        else {
          const t = toBoolean(cell);
          if (isError(t)) return t;
          b = t;
        }
        seen = true;
        if (b === stopOn) return stopOn;
      }
    }
    return seen ? !stopOn : err("#VALUE!");
  }
}

// Operators on arrays work element by element (Excel 365): =A1:A3*2, =A1:A3=B1:B3.
// A side with one row (or column) is repeated along that direction, so a column times a row
// makes a table; where sizes still differ, the cells one side lacks are #N/A, as in Excel.

function lift1(v: Value, f: (x: CellValue) => CellValue): Value {
  return Array.isArray(v) ? v.map((row) => row.map(f)) : f(v);
}

function lift2(l: Value, r: Value, f: (a: CellValue, b: CellValue) => CellValue): Value {
  if (!Array.isArray(l) && !Array.isArray(r)) return f(l, r);
  const a: Matrix = Array.isArray(l) ? l : [[l]];
  const b: Matrix = Array.isArray(r) ? r : [[r]];
  const rows = Math.max(a.length, b.length);
  const cols = Math.max(a[0]?.length ?? 0, b[0]?.length ?? 0);
  const at = (m: Matrix, i: number, j: number): CellValue | undefined => {
    const row = m.length === 1 ? m[0] : m[i];
    if (!row) return undefined;
    return row.length === 1 ? row[0] : row[j];
  };
  const out: Matrix = [];
  for (let i = 0; i < rows; i++) {
    const row: CellValue[] = [];
    for (let j = 0; j < cols; j++) {
      const x = at(a, i, j);
      const y = at(b, i, j);
      row.push(x === undefined || y === undefined ? err("#N/A") : f(x, y));
    }
    out.push(row);
  }
  return out;
}

/** A 1×1 range reads as its cell; any larger range is #VALUE! in a scalar slot. */
function single(v: Value): CellValue {
  if (!Array.isArray(v)) return v;
  return v.length === 1 && v[0]!.length === 1 ? v[0]![0]! : err("#VALUE!");
}

function binary(op: BinaryOp, l: CellValue, r: CellValue): CellValue {
  if (isError(l)) return l;
  if (isError(r)) return r;
  switch (op) {
    case "&":
      return toText(l) + toText(r);
    case "=": return compare(l, r) === 0;
    case "<>": return compare(l, r) !== 0;
    case "<": return compare(l, r) < 0;
    case ">": return compare(l, r) > 0;
    case "<=": return compare(l, r) <= 0;
    case ">=": return compare(l, r) >= 0;
  }
  const a = toNumber(l);
  if (isError(a)) return a;
  const b = toNumber(r);
  if (isError(b)) return b;
  let result: number;
  switch (op) {
    case "+": result = a + b; break;
    case "-": result = a - b; break;
    case "*": result = a * b; break;
    case "/":
      if (b === 0) return err("#DIV/0!");
      result = a / b;
      break;
    case "^":
      if (a === 0 && b === 0) return err("#NUM!");
      result = a ** b;
      break;
  }
  return Number.isFinite(result) ? result : err("#NUM!");
}

function toNumber(v: CellValue): number | ExcelError {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null) return 0;
  if (isError(v)) return v;
  const s = v.trim();
  return NUMBER_RE.test(s) ? Number(s) : err("#VALUE!");
}

function toText(v: CellValue): string {
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(Number(v.toPrecision(15))); // Excel keeps 15 significant digits
  return v === null ? "" : String(v);
}

function toBoolean(v: CellValue): boolean | ExcelError {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null) return false;
  if (isError(v)) return v;
  const upper = v.toUpperCase();
  if (upper === "TRUE" || upper === "FALSE") return upper === "TRUE";
  return err("#VALUE!");
}

// Excel orders mixed types number < text < boolean; text compares case-insensitively.
// An empty cell takes the other side's type: 0, "" or FALSE.
const RANK = { number: 0, string: 1, boolean: 2 } as const;

function compare(l: Exclude<CellValue, ExcelError>, r: Exclude<CellValue, ExcelError>): number {
  const a = l ?? blankLike(r);
  const b = r ?? blankLike(l);
  const ta = typeof a as keyof typeof RANK;
  const tb = typeof b as keyof typeof RANK;
  if (ta !== tb) return RANK[ta] - RANK[tb];
  if (ta === "string") {
    const x = (a as string).toUpperCase();
    const y = (b as string).toUpperCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return Number(a) - Number(b);
}

function blankLike(v: Exclude<CellValue, ExcelError>): number | string | boolean {
  if (typeof v === "string") return "";
  if (typeof v === "boolean") return false;
  return 0;
}
