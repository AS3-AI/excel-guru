import * as formulajs from "@formulajs/formulajs";
import type { CellValue, ErrorCode, ExcelError, Matrix } from "./evaluator";

/** A function argument: a scalar, a range as a 2-D array, or undefined for an omitted one. */
export type Arg = CellValue | Matrix | undefined;
type Impl = (...args: Arg[]) => CellValue | Matrix;

/** Only these positions receive element-wise single-value evaluation. All other array arguments stay whole. */
export const liftingArgumentPositions: Readonly<Record<string, readonly number[]>> = {
  ABS: [0], ROUND: [0, 1], ROUNDUP: [0, 1], ROUNDDOWN: [0, 1], INT: [0], MOD: [0, 1], SQRT: [0], POWER: [0, 1],
  FLOOR: [0, 1], CEILING: [0, 1], ODD: [0], EVEN: [0], SIGN: [0],
  LEN: [0], LEFT: [0, 1], RIGHT: [0, 1], MID: [0, 1, 2], UPPER: [0], LOWER: [0], PROPER: [0], TRIM: [0],
  SUBSTITUTE: [0, 1, 2, 3], REPLACE: [0, 1, 2, 3], FIND: [0, 1, 2], SEARCH: [0, 1, 2],
  TEXTBEFORE: [0, 1, 2], TEXTAFTER: [0, 1, 2], VALUE: [0], TEXT: [0, 1], CONCATENATE: [-1], EXACT: [0, 1], REPT: [0, 1],
  NOT: [0], ISNUMBER: [0], ISTEXT: [0], ISBLANK: [0], ISERROR: [0], ISERR: [0], ISNA: [0], ISLOGICAL: [0], ISEVEN: [0], ISODD: [0],
  DATE: [0, 1, 2], YEAR: [0], MONTH: [0], DAY: [0], WEEKDAY: [0, 1], DATEVALUE: [0], DAYS: [0, 1], DATEDIF: [0, 1, 2],
  COUNTIF: [1], COUNTIFS: [1, 3, 5, 7], SUMIF: [1], SUMIFS: [2, 4, 6],
  AVERAGEIF: [1], AVERAGEIFS: [2, 4, 6], VLOOKUP: [0], HLOOKUP: [0], XLOOKUP: [0], MATCH: [0],
};

/** Positions that receive full arrays because the function's contract consumes ranges. */
export const rangeArgumentPositions: Readonly<Record<string, readonly number[]>> = {
  SUM: [-1], SUMSQ: [-1], PRODUCT: [-1], AVERAGE: [-1], MIN: [-1], MAX: [-1], COUNT: [-1], COUNTA: [-1], COUNTBLANK: [0],
  COUNTIF: [0], COUNTIFS: [0, 2, 4, 6], SUMIF: [0, 2], SUMIFS: [0, 1, 3, 5],
  AVERAGEIF: [0, 2], AVERAGEIFS: [0, 1, 3, 5],
  VLOOKUP: [1], HLOOKUP: [1], XLOOKUP: [1, 2], INDEX: [0], MATCH: [1],
  UNIQUE: [0], FILTER: [0, 1], SORT: [0], TEXTJOIN: [2], CONCAT: [0],
  SUMPRODUCT: [-1],
};

const CODES: ErrorCode[] = ["#DIV/0!", "#N/A", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#SPILL!", "#CIRC!"];
const LIBRARY = formulajs as unknown as Record<string, unknown>;

// Day 0 of Excel's 1900 date system, so 1900-03-01 onwards matches Excel's serials.
const EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
const serialDay = (n: number) => new Date(EPOCH + Math.floor(n) * DAY_MS);
const serial = (d: Date) => (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / DAY_MS;
function dateArgs(args: Arg[]): number[] | ExcelError {
  const out: number[] = [];
  for (const a of args) {
    const v = scalar(a);
    if (isError(v)) return v;
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
    if (!Number.isFinite(n)) return { error: "#VALUE!" };
    out.push(Math.trunc(n));
  }
  return out;
}
function dateFunction(args: Arg[]): CellValue {
  if (args.length !== 3) return VALUE;
  const a = dateArgs(args); if (isError(a)) return a;
  let [year, month, day] = a;
  if (year! >= 0 && year! < 1900) year! += 1900;
  const t = new Date(Date.UTC(year!, month! - 1, day!));
  return Number.isNaN(t.getTime()) ? { error: "#NUM!" } : serial(t);
}
function datedif(args: Arg[]): CellValue {
  if (args.length !== 3) return VALUE;
  const a = dateArgs(args.slice(0, 2)); if (isError(a)) return a;
  const unitArg = scalar(args[2]);
  if (isError(unitArg)) return unitArg;
  if (typeof unitArg !== "string") return VALUE;
  const [start, end] = a!; if (start! > end!) return { error: "#NUM!" };
  const s = serialDay(start!), e = serialDay(end!);
  const years = e.getUTCFullYear() - s.getUTCFullYear();
  const months = years * 12 + e.getUTCMonth() - s.getUTCMonth();
  const anniversary = (m: number) => { const d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + m, 1)); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(s.getUTCDate(), last)); return d; };
  const completedMonths = months - (e < anniversary(months) ? 1 : 0);
  const completedYears = Math.floor(completedMonths / 12);
  switch (unitArg.toUpperCase()) {
    case "D": return end! - start!;
    case "M": return completedMonths;
    case "Y": return completedYears;
    case "YM": return ((completedMonths % 12) + 12) % 12;
    case "YD": { const endInStartYear = new Date(Date.UTC(s.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())); return (endInStartYear.getTime() - s.getTime()) / DAY_MS; }
    case "MD": { const lib = libraryFunction("DATEDIF"); return lib ? fromLibrary(lib(...args.map((x) => Array.isArray(x) ? x : x ?? null))) as CellValue : VALUE; }
    default: return VALUE;
  }
}
function dateShift(a: Arg, monthsArg: Arg, endOfMonth = false): CellValue {
  const vals = dateArgs([a, monthsArg]); if (isError(vals)) return vals;
  const [day, months] = vals!; const src = serialDay(day!);
  const target = new Date(Date.UTC(src.getUTCFullYear(), src.getUTCMonth() + months!, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(endOfMonth ? last : Math.min(src.getUTCDate(), last));
  return serial(target);
}
function workday(args: Arg[]): CellValue {
  if (args.length < 2 || args.length > 3) return VALUE;
  const vals = dateArgs(args.slice(0, 2)); if (isError(vals)) return vals;
  let day = vals![0]!, left = Math.abs(vals![1]!), direction = Math.sign(vals![1]!);
  while (left > 0) { day += direction; const wd = serialDay(day).getUTCDay(); if (wd !== 0 && wd !== 6) left--; }
  return day;
}

/** The implementation behind a (case-insensitive) function name, or null → #NAME?. */
export function lookupFunction(name: string): Impl | null {
  const upper = name.toUpperCase();
  const own = OWN[upper];
  if (own) return own;
  const lib = libraryFunction(upper);
  return lib ? (...args) => fromLibrary(lib(...args.map(toLibrary))) : null;
}

// formula.js exports dotted names both ways: STDEV.S is STDEV.S and STDEVS.
function libraryFunction(name: string): ((...args: unknown[]) => unknown) | null {
  let found: unknown = LIBRARY[name];
  if (found === undefined && name.includes(".")) {
    found = LIBRARY[name.replace(/\./g, "")];
    if (found === undefined) {
      found = name.split(".").reduce<unknown>((obj, key) => (obj as Record<string, unknown> | undefined)?.[key], LIBRARY);
    }
  }
  return typeof found === "function" ? (found as (...args: unknown[]) => unknown) : null;
}

// formula.js recognises errors with `instanceof Error`.
function toLibrary(arg: Arg): unknown {
  if (Array.isArray(arg)) return arg.map((row) => row.map(toLibrary));
  return isError(arg) ? new Error(arg.error) : arg;
}

function fromLibrary(result: unknown): CellValue | Matrix {
  if (result instanceof Error) return toExcelError(result.message);
  if (result instanceof Date) {
    const local = Date.UTC(result.getFullYear(), result.getMonth(), result.getDate(),
      result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds());
    return (local - EPOCH) / DAY_MS;
  }
  if (typeof result === "number") return Number.isFinite(result) ? result : { error: "#NUM!" };
  if (typeof result === "string" || typeof result === "boolean" || result === null) return result;
  if (Array.isArray(result)) {
    const rows = result.map((row) => (Array.isArray(row) ? row : [row]));
    return rows.map((row) => row.map((v) => fromLibrary(v) as CellValue));
  }
  return { error: "#VALUE!" };
}

function toExcelError(message: string): ExcelError {
  return { error: CODES.find((c) => c === message) ?? "#VALUE!" };
}

// ---------------------------------------------------------------------------
// Criteria functions. formula.js's COUNTIF/SUMIF don't handle wildcards ("E*",
// "?ast"), so the *IF family is implemented here with Excel's criteria rules.

type Test = (v: CellValue) => boolean;
const CRITERIA_RE = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/;

function criterion(c: Arg): Test {
  // Microsoft: "If the criteria argument is a reference to an empty cell, the COUNTIFS function
  // treats the empty cell as a 0 value." An omitted criterion (COUNTIF(r,)) does the same.
  // Only a literal "" (handled below) matches blank cells.
  if (c === undefined || c === null) return criterion(0);
  if (Array.isArray(c)) return criterion(c[0]?.[0] ?? null);
  if (isError(c)) return (v) => isError(v) && v.error === c.error;
  if (typeof c === "number") return (v) => toNumber(v) === c;
  if (typeof c === "boolean") return (v) => v === c;

  const [, op = "", operand = ""] = CRITERIA_RE.exec(c)!;
  const num = operand.trim() === "" ? NaN : Number(operand);
  const upper = operand.toUpperCase();

  // "#N/A", "=#N/A" and "<>#N/A" name an error value, not text.
  const code = CODES.find((e) => e === upper);
  if (code) {
    const match = (v: CellValue) => isError(v) && v.error === code;
    if (op === "" || op === "=") return match;
    return op === "<>" ? (v) => !match(v) : () => false;
  }

  if (!Number.isNaN(num)) {
    const cmp = compareWith(op);
    return (v) => {
      // Numeric text matches only on equality, as in Excel.
      const n = typeof v === "number" ? v : op === "" || op === "=" ? toNumber(v) : null;
      if (n === null) return op === "<>";
      return cmp(n - num);
    };
  }
  if (upper === "TRUE" || upper === "FALSE") {
    const b = upper === "TRUE";
    return (v) => (op === "<>" ? v !== b : op === "" || op === "=" ? v === b : false);
  }
  if (op === "" || op === "=" || op === "<>") {
    const match = operand === ""
      ? (v: CellValue) => v === null || v === ""
      : (v: CellValue) => typeof v === "string" && wildcard(operand).test(v);
    return op === "<>" ? (v) => !match(v) : match;
  }
  const cmp = compareWith(op);
  return (v) => typeof v === "string" && cmp(v.toUpperCase() < upper ? -1 : v.toUpperCase() > upper ? 1 : 0);
}

function compareWith(op: string): (diff: number) => boolean {
  switch (op) {
    case "<": return (d) => d < 0;
    case ">": return (d) => d > 0;
    case "<=": return (d) => d <= 0;
    case ">=": return (d) => d >= 0;
    case "<>": return (d) => d !== 0;
    default: return (d) => d === 0;
  }
}

// * any run, ? one character, ~ escapes the next character. Case-insensitive, whole value.
function wildcard(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === "~" && i + 1 < pattern.length) re += escapeRe(pattern[++i]!);
    else if (ch === "*") re += "[\\s\\S]*";
    else if (ch === "?") re += "[\\s\\S]";
    else re += escapeRe(ch);
  }
  return new RegExp(`^${re}$`, "i");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function toNumber(v: CellValue): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

const isError = (v: unknown): v is ExcelError => typeof v === "object" && v !== null && "error" in v;

function errorPredicate(arg: Arg, test: (value: CellValue) => boolean): CellValue | Matrix {
  if (Array.isArray(arg)) return arg.map((row) => row.map((value) => test(value)));
  return test(arg ?? null);
}

function errorType(arg: Arg): CellValue | Matrix {
  const types: Partial<Record<ErrorCode, number>> = {
    "#DIV/0!": 2, "#VALUE!": 3, "#REF!": 4, "#NAME?": 5, "#NUM!": 6, "#N/A": 7,
  };
  const typeOf = (value: CellValue): CellValue => {
    if (!isError(value)) return NA;
    const type = types[value.error];
    return type ?? NA;
  };
  if (Array.isArray(arg)) return arg.map((row) => row.map(typeOf));
  return typeOf(arg ?? null);
}

function parityPredicate(arg: Arg, name: "ISEVEN" | "ISODD"): CellValue | Matrix {
  const test = (value: CellValue): CellValue => {
    if (isError(value)) return value;
    const fn = libraryFunction(name);
    return fn ? fromLibrary(fn(value)) as CellValue : VALUE;
  };
  if (Array.isArray(arg)) return arg.map((row) => row.map(test));
  return test(arg ?? null);
}

const asMatrix = (a: Arg): Matrix => (Array.isArray(a) ? a : [[a ?? null]]);

/**
 * Cells of `target` whose position passes every (range, criteria) pair, or an error.
 * Ranges must match the first range's shape; `target` is read at the same offsets.
 */
function selected(target: Arg, pairs: Arg[]): CellValue[] | ExcelError {
  if (pairs.length === 0 || pairs.length % 2 !== 0) return { error: "#VALUE!" };
  const t = asMatrix(target);
  const ranges: Matrix[] = [];
  const tests: Test[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    ranges.push(asMatrix(pairs[i]));
    tests.push(criterion(pairs[i + 1]));
  }
  const rows = ranges[0]!.length;
  const cols = ranges[0]![0]?.length ?? 0;
  if (ranges.some((r) => r.length !== rows || (r[0]?.length ?? 0) !== cols)) return { error: "#VALUE!" };

  const out: CellValue[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tests.every((test, k) => test(ranges[k]![r]![c] ?? null))) out.push(t[r]?.[c] ?? null);
    }
  }
  return out;
}

function sum(cells: CellValue[] | ExcelError): CellValue {
  if (!Array.isArray(cells)) return cells;
  let total = 0;
  for (const v of cells) {
    if (isError(v)) return v;
    if (typeof v === "number") total += v;
  }
  return total;
}

function average(cells: CellValue[] | ExcelError): CellValue {
  if (!Array.isArray(cells)) return cells;
  const nums = cells.filter((v) => typeof v === "number" || isError(v));
  const total = sum(nums);
  if (isError(total)) return total;
  return nums.length === 0 ? { error: "#DIV/0!" } : (total as number) / nums.length;
}

function count(cells: CellValue[] | ExcelError): CellValue {
  return Array.isArray(cells) ? cells.length : cells;
}

// ---------------------------------------------------------------------------
// DATEVALUE. JS parses "2024-01-01" as UTC midnight but "1/1/2024" as local
// midnight, so formula.js's result drifts by the timezone offset. Take the
// calendar day each form names and build the serial in UTC.

const ISO_DATE_RE = /^\s*(\d{4})-(\d\d?)-(\d\d?)\s*$/;

function datevalue(text: Arg): CellValue {
  if (isError(text)) return text;
  if (typeof text !== "string") return { error: "#VALUE!" };
  const iso = ISO_DATE_RE.exec(text);
  let day: number;
  if (iso) {
    day = Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  } else {
    const local = new Date(text);
    if (Number.isNaN(local.getTime())) return { error: "#VALUE!" };
    day = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate());
  }
  return Number.isNaN(day) ? { error: "#VALUE!" } : (day - EPOCH) / DAY_MS;
}

// ---------------------------------------------------------------------------
// Lookups. formula.js's VLOOKUP returns an empty cell (shown as 0) instead of #N/A
// over an empty table, orders text with localeCompare and ignores wildcards, and
// it has no XLOOKUP, so all three follow Microsoft's documentation here.

type Scalar = Exclude<CellValue, ExcelError>;
const NA: ExcelError = { error: "#N/A" };
const VALUE: ExcelError = { error: "#VALUE!" };

/** An argument that must be one value: a 1×1 range reads as its cell. */
function scalar(a: Arg): CellValue {
  if (!Array.isArray(a)) return a ?? null;
  return a.length === 1 && a[0]!.length === 1 ? a[0]![0]! : VALUE;
}

/** A whole-number argument, or `fallback` when it is omitted. */
function numberArg(a: Arg, fallback: number): number | ExcelError {
  if (a === undefined) return fallback;
  const v = scalar(a);
  if (isError(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null) return 0;
  const n = toNumber(v);
  return n === null ? VALUE : Math.trunc(n);
}

function transpose(m: Matrix): Matrix {
  const cols = Math.max(0, ...m.map((row) => row.length));
  return Array.from({ length: cols }, (_, c) => m.map((row) => row[c] ?? null));
}

/**
 * How a cell orders against the lookup value (<0, 0, >0), or null when they can't be
 * compared: lookups only match values of the same type, and text ignores case.
 */
function order(cell: CellValue, key: Scalar): number | null {
  if (cell === null || isError(cell) || typeof cell !== typeof key) return null;
  if (typeof cell === "string") {
    const a = cell.toUpperCase();
    const b = (key as string).toUpperCase();
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return Number(cell) - Number(key);
}

// VLOOKUP(lookup, table, col_index_num, [range_lookup]); HLOOKUP is VLOOKUP on the transposed table.
function vlookup(args: Arg[]): CellValue {
  if (args.length < 3 || args.length > 4) return VALUE;
  const lookup = scalar(args[0]);
  if (isError(lookup)) return lookup;
  const table = asMatrix(args[1]);
  const index = numberArg(args[2], 1);
  if (isError(index)) return index;
  // A missing range_lookup is TRUE, but an empty one, VLOOKUP(x,t,2,), is FALSE as in Excel.
  const approx = args.length < 4 ? true : flag(args[3]);
  if (isError(approx)) return approx;
  if (index < 1) return VALUE;
  if (index > Math.max(0, ...table.map((row) => row.length))) return { error: "#REF!" };

  const key = lookup ?? 0;
  let found = -1;
  if (!approx) {
    // Exact match: text lookups understand * ? ~.
    const re = typeof key === "string" ? wildcard(key) : null;
    found = table.findIndex((row) => {
      const cell = row[0] ?? null;
      return re ? typeof cell === "string" && re.test(cell) : order(cell, key) === 0;
    });
  } else {
    // Approximate match on a sorted first column: the last value of the lookup's type that
    // isn't above it. Excel binary-searches; on sorted data this linear scan agrees.
    for (let r = 0; r < table.length; r++) {
      const d = order(table[r]![0] ?? null, key);
      if (d === null) continue;
      if (d > 0) break;
      found = r;
    }
  }
  return found < 0 ? NA : table[found]![index - 1] ?? null;
}

// MATCH(lookup_value, lookup_array, [match_type]).
function match(args: Arg[]): CellValue {
  if (args.length < 2 || args.length > 3) return VALUE;
  const lookup = scalar(args[0]);
  if (isError(lookup)) return lookup;
  const key: Scalar = lookup ?? 0;
  const array = asMatrix(args[1]);
  const rows = array.length;
  const cols = Math.max(0, ...array.map((row) => row.length));
  if (rows !== 1 && cols !== 1) return NA;
  const values = rows === 1
    ? Array.from({ length: cols }, (_, c) => array[0]?.[c] ?? null)
    : Array.from({ length: rows }, (_, r) => array[r]?.[0] ?? null);
  const type = numberArg(args[2], 1);
  if (isError(type)) return type;
  const matchType = Math.sign(type);

  if (matchType === 0) {
    const re = typeof key === "string" ? wildcard(key) : null;
    const found = values.findIndex((cell) => re
      ? typeof cell === "string" && re.test(cell)
      : order(cell, key) === 0);
    return found < 0 ? NA : found + 1;
  }

  // Approximate MATCH follows VLOOKUP's ordered scan: skip incomparable values,
  // stop at the first value past the key in the selected direction, and keep the
  // last qualifying position before that value.
  let found = -1;
  for (let i = 0; i < values.length; i++) {
    const d = order(values[i]!, key);
    if (d === null) continue;
    if ((matchType === 1 && d > 0) || (matchType === -1 && d < 0)) break;
    found = i;
  }
  return found < 0 ? NA : found + 1;
}

function flag(a: Arg): boolean | ExcelError {
  if (a === undefined) return false;
  const v = scalar(a);
  if (isError(v)) return v;
  if (typeof v === "string") {
    const upper = v.toUpperCase();
    return upper === "TRUE" ? true : upper === "FALSE" ? false : VALUE;
  }
  return Boolean(v);
}

// XLOOKUP(lookup, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])
function xlookup(args: Arg[]): CellValue | Matrix {
  if (args.length < 3 || args.length > 6) return VALUE;
  const lookup = scalar(args[0]);
  if (isError(lookup)) return lookup;
  const keys = asMatrix(args[1]);
  const ret = asMatrix(args[2]);
  const matchMode = numberArg(args[4], 0);
  if (isError(matchMode)) return matchMode;
  const searchMode = numberArg(args[5], 1);
  if (isError(searchMode)) return searchMode;
  if (![0, -1, 1, 2].includes(matchMode) || ![1, -1, 2, -2].includes(searchMode)) return VALUE;

  // lookup_array is one column or one row; return_array must be as long in that direction.
  // A return_array several columns wide (or rows tall) gives the whole matched row (or
  // column), which spills (T6).
  let cells: CellValue[];
  let result: (i: number) => CellValue | Matrix;
  if (keys.every((row) => row.length === 1)) {
    cells = keys.map((row) => row[0]!);
    if (ret.length !== cells.length) return VALUE;
    result = (i) => (ret[i]!.length === 1 ? ret[i]![0] ?? null : [ret[i]!]);
  } else if (keys.length === 1) {
    const row = keys[0]!;
    cells = row;
    if (ret.some((r) => r.length !== row.length)) return VALUE;
    result = (i) => (ret.length === 1 ? ret[0]![i] ?? null : ret.map((r) => [r[i] ?? null]));
  } else {
    return VALUE;
  }

  // Binary search modes (±2) fall back to a linear scan: the same answer on sorted data.
  const indices = cells.map((_, i) => i);
  if (searchMode < 0) indices.reverse();

  const key = lookup ?? 0;
  let found = -1;
  if (matchMode === 2 && typeof key === "string") {
    const re = wildcard(key);
    found = indices.find((i) => typeof cells[i] === "string" && re.test(cells[i] as string)) ?? -1;
  } else {
    // match_mode -1 / 1: an exact match, else the next smaller / larger item (data needn't be sorted).
    const side = matchMode === -1 || matchMode === 1 ? matchMode : 0;
    for (const i of indices) {
      const d = order(cells[i]!, key);
      if (d === null) continue;
      if (d === 0) {
        found = i;
        break;
      }
      if (side === 0 || Math.sign(d) !== side) continue;
      if (found < 0 || order(cells[i]!, cells[found] as Scalar)! * side < 0) found = i;
    }
  }
  if (found >= 0) return result(found);
  return args[3] === undefined ? NA : scalar(args[3]);
}

// ---------------------------------------------------------------------------
// TEXTBEFORE / TEXTAFTER(text, delimiter, [instance_num], [match_mode], [match_end], [if_not_found])

type Hit = { start: number; end: number };

function textSplit(args: Arg[], side: "before" | "after"): CellValue {
  if (args.length < 2 || args.length > 6) return VALUE;
  const t = scalar(args[0]);
  if (isError(t)) return t;
  const text = toText(t);
  const delimiters: string[] = [];
  for (const d of Array.isArray(args[1]) ? args[1].flat() : [args[1] ?? null]) {
    if (isError(d)) return d;
    delimiters.push(toText(d));
  }
  const instance = numberArg(args[2], 1);
  if (isError(instance)) return instance;
  const matchMode = numberArg(args[3], 0);
  if (isError(matchMode)) return matchMode;
  const matchEnd = numberArg(args[4], 0);
  if (isError(matchEnd)) return matchEnd;
  if (![0, 1].includes(matchMode) || ![0, 1].includes(matchEnd)) return VALUE;
  // Microsoft: #VALUE! if instance_num = 0 or is greater than the length of text.
  if (instance === 0 || Math.abs(instance) > text.length) return VALUE;

  const fold = (s: string) => (matchMode === 1 ? s.toLowerCase() : s);
  const delims = delimiters.map(fold);
  const at = (from: number, d: string) => fold(text.slice(from, from + d.length)) === d;

  const hits: Hit[] = [];
  if (instance > 0) {
    // Scan from the start; match_end adds the end of the text as a last delimiter.
    for (let i = 0; i <= text.length && hits.length < instance; ) {
      const d = delims.find((d) => at(i, d));
      if (d === undefined) {
        i++;
      } else {
        hits.push({ start: i, end: i + d.length });
        i += Math.max(d.length, 1);
      }
    }
    if (matchEnd === 1) hits.push({ start: text.length, end: text.length });
  } else {
    // Scan from the end; match_end adds the start of the text as a last delimiter.
    for (let i = text.length; i >= 0 && hits.length < -instance; ) {
      const d = delims.find((d) => d.length <= i && at(i - d.length, d));
      if (d === undefined) {
        i--;
      } else {
        hits.push({ start: i - d.length, end: i });
        i -= Math.max(d.length, 1);
      }
    }
    if (matchEnd === 1) hits.push({ start: 0, end: 0 });
  }

  const hit = hits[Math.abs(instance) - 1];
  if (!hit) return args[5] === undefined ? NA : scalar(args[5]);
  return side === "before" ? text.slice(0, hit.start) : text.slice(hit.end);
}

function toText(v: Scalar): string {
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(Number(v.toPrecision(15))); // Excel keeps 15 significant digits
  return v ?? "";
}

function search(args: Arg[]): CellValue {
  if (args.length < 2 || args.length > 3) return VALUE;
  const needle = scalar(args[0]);
  const haystack = scalar(args[1]);
  if (isError(needle)) return needle;
  if (isError(haystack)) return haystack;
  const start = numberArg(args[2], 1);
  if (isError(start)) return start;
  if (start < 1) return VALUE;
  const text = toText(haystack);
  const source = wildcard(toText(needle)).source.slice(1, -1);
  const re = new RegExp(`^(?:${source})`, "i");
  for (let i = start - 1; i < text.length; i++) {
    if (re.test(text.slice(i))) return i + 1;
  }
  return VALUE;
}

function proper(arg: Arg): CellValue {
  const value = scalar(arg);
  if (isError(value)) return value;
  let atWordStart = true;
  return [...toText(value)].map((ch) => {
    if (/\p{L}/u.test(ch)) {
      const capitalize = atWordStart;
      atWordStart = false;
      return capitalize ? ch.toUpperCase() : ch.toLowerCase();
    }
    atWordStart = true;
    return ch;
  }).join("");
}

function leftRight(args: Arg[], side: "left" | "right"): CellValue {
  if (args.length < 1 || args.length > 2) return VALUE;
  const value = scalar(args[0]);
  if (isError(value)) return value;
  const length = numberArg(args[1], 1);
  if (isError(length)) return length;
  if (length < 0) return VALUE;
  const text = toText(value);
  return side === "left" ? text.slice(0, length) : length === 0 ? "" : text.slice(-length);
}

// ---------------------------------------------------------------------------
// Dynamic-array functions (T6). Their results spill from the formula's cell.
// Where Excel returns #CALC! (an empty result), we return #VALUE!: #CALC! isn't in ErrorCode.

const CALC: ExcelError = VALUE;

/** The array argument: a range or array, a lone value as 1×1, an error as itself. */
function arrayArg(a: Arg): Matrix | ExcelError {
  if (isError(a)) return a;
  return asMatrix(a);
}

/** UNIQUE's identity for a value: text ignores case; 1 and "1" differ; blanks are one value. */
function identity(v: CellValue): string {
  if (v === null) return "z";
  if (isError(v)) return `e${v.error}`;
  if (typeof v === "string") return `s${v.toUpperCase()}`;
  return `${typeof v === "number" ? "n" : "b"}${String(v)}`;
}

// UNIQUE(array, [by_col], [exactly_once])
function unique(args: Arg[]): CellValue | Matrix {
  if (args.length < 1 || args.length > 3) return VALUE;
  const m = arrayArg(args[0]);
  if (isError(m)) return m;
  const byCol = flag(args[1]);
  if (isError(byCol)) return byCol;
  const once = flag(args[2]);
  if (isError(once)) return once;

  const lines = byCol ? transpose(m) : m;
  const seen = new Map<string, { line: CellValue[]; count: number }>();
  for (const line of lines) {
    const key = line.map(identity).join("\u0000");
    const entry = seen.get(key);
    if (entry) entry.count++;
    else seen.set(key, { line, count: 1 });
  }
  const kept = [...seen.values()].filter((e) => !once || e.count === 1).map((e) => e.line);
  if (kept.length === 0) return CALC;
  return byCol ? transpose(kept) : kept;
}

// FILTER(array, include, [if_empty])
function filter(args: Arg[]): CellValue | Matrix {
  if (args.length < 2 || args.length > 3) return VALUE;
  const m = arrayArg(args[0]);
  if (isError(m)) return m;
  const inc = arrayArg(args[1]);
  if (isError(inc)) return inc;

  // include is one column as tall as the array (keep rows) or one row as wide (keep columns).
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  let flags: CellValue[];
  let byCol: boolean;
  if (inc.length === rows && inc.every((r) => r.length === 1)) {
    flags = inc.map((r) => r[0]!);
    byCol = false;
  } else if (inc.length === 1 && inc[0]!.length === cols) {
    flags = inc[0]!;
    byCol = true;
  } else {
    return VALUE;
  }

  const keep: boolean[] = [];
  for (const f of flags) {
    if (isError(f)) return f; // an error in include propagates
    if (typeof f === "string") return VALUE;
    keep.push(Boolean(f)); // non-zero numbers and TRUE keep; 0, FALSE and blanks drop
  }
  const out = byCol ? m.map((row) => row.filter((_, c) => keep[c])) : m.filter((_, r) => keep[r]);
  if (out.length === 0 || out[0]!.length === 0) {
    return args[2] === undefined ? CALC : args[2];
  }
  return out;
}

// SORT order: numbers < text < booleans < errors, text ignoring case; blanks always last.
const SORT_RANK = { number: 0, string: 1, boolean: 2 } as const;

function sortCompare(a: CellValue, b: CellValue, order: number): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const ra = isError(a) ? 3 : SORT_RANK[typeof a as keyof typeof SORT_RANK];
  const rb = isError(b) ? 3 : SORT_RANK[typeof b as keyof typeof SORT_RANK];
  let d: number;
  if (ra !== rb) d = ra - rb;
  else if (isError(a) || isError(b)) d = 0;
  else if (typeof a === "string") {
    const x = a.toUpperCase();
    const y = (b as string).toUpperCase();
    d = x < y ? -1 : x > y ? 1 : 0;
  } else d = Number(a) - Number(b);
  return d * order;
}

// SORT(array, [sort_index], [sort_order], [by_col])
function sort(args: Arg[]): CellValue | Matrix {
  if (args.length < 1 || args.length > 4) return VALUE;
  const m = arrayArg(args[0]);
  if (isError(m)) return m;
  const index = numberArg(args[1], 1);
  if (isError(index)) return index;
  const order = numberArg(args[2], 1);
  if (isError(order)) return order;
  const byCol = flag(args[3]);
  if (isError(byCol)) return byCol;
  if (order !== 1 && order !== -1) return VALUE;

  const lines = byCol ? transpose(m) : m;
  const width = lines[0]?.length ?? 0;
  if (index < 1 || index > width) return VALUE;
  // Array.prototype.sort is stable, so ties keep their order.
  const sorted = [...lines].sort((x, y) => sortCompare(x[index - 1] ?? null, y[index - 1] ?? null, order));
  return byCol ? transpose(sorted) : sorted;
}

// INDEX(array, row_num, [column_num]) — array form only. A zero index selects
// the complete corresponding dimension, which the evaluator spills.
function index(args: Arg[]): CellValue | Matrix {
  if (args.length < 2 || args.length > 3) return VALUE;
  const m = arrayArg(args[0]);
  if (isError(m)) return m;
  const rows = m.length;
  const cols = Math.max(0, ...m.map((row) => row.length));

  let rowArg = args[1];
  let colArg = args[2];
  // In a one-dimensional array, a sole index addresses its non-singleton axis.
  const singleRowIndex = args.length === 2 && rows === 1 && cols > 1;
  if (singleRowIndex) {
    colArg = rowArg;
    rowArg = 1;
  } else if (args.length === 2) {
    colArg = 0;
  }
  const negative = (a: Arg) => {
    const value = scalar(a);
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
    return n < 0;
  };
  if (negative(rowArg) || negative(colArg)) return VALUE;
  const row = numberArg(rowArg, 0);
  if (isError(row)) return row;
  const col = numberArg(colArg, 1);
  if (isError(col)) return col;
  if (row < 0 || col < 0) return VALUE;
  if (row > rows || col > cols) return { error: "#REF!" };
  if (row === 0 && col === 0) return m.map((line) => line.map((v) => v ?? 0));
  if (row === 0) return m.map((line) => [line[col - 1] ?? 0]);
  if (col === 0) return [[...Array.from({ length: cols }, (_, c) => m[row - 1]?.[c] ?? 0)]];
  if (args.length === 2 && !singleRowIndex) {
    return [[...Array.from({ length: cols }, (_, c) => m[row - 1]?.[c] ?? 0)]];
  }
  const value = m[row - 1]?.[col - 1] ?? 0;
  return value;
}

const OWN: Record<string, Impl> = {
  DATE: (...args) => dateFunction(args),
  DATEDIF: (...args) => datedif(args),
  EDATE: (start, months) => dateShift(start, months),
  EOMONTH: (start, months) => dateShift(start, months, true),
  WORKDAY: (...args) => workday(args),
  SEARCH: (...args) => search(args),
  PROPER: (arg) => proper(arg),
  LEFT: (...args) => leftRight(args, "left"),
  RIGHT: (...args) => leftRight(args, "right"),
  ISERROR: (arg) => errorPredicate(arg, isError),
  ISERR: (arg) => errorPredicate(arg, (value) => isError(value) && value.error !== "#N/A"),
  ISNA: (arg) => errorPredicate(arg, (value) => isError(value) && value.error === "#N/A"),
  "ERROR.TYPE": (arg) => errorType(arg),
  ISNUMBER: (arg) => errorPredicate(arg, (value) => !isError(value) && typeof value === "number"),
  ISTEXT: (arg) => errorPredicate(arg, (value) => !isError(value) && typeof value === "string"),
  ISBLANK: (arg) => errorPredicate(arg, (value) => !isError(value) && value === null),
  ISLOGICAL: (arg) => errorPredicate(arg, (value) => !isError(value) && typeof value === "boolean"),
  ISNONTEXT: (arg) => errorPredicate(arg, (value) => !isError(value) && typeof value !== "string"),
  ISEVEN: (arg) => parityPredicate(arg, "ISEVEN"),
  ISODD: (arg) => parityPredicate(arg, "ISODD"),
  UNIQUE: (...args) => unique(args),
  FILTER: (...args) => filter(args),
  SORT: (...args) => sort(args),
  INDEX: (...args) => index(args),
  MATCH: (...args) => match(args),
  DATEVALUE: (text) => datevalue(text),
  VLOOKUP: (...args) => vlookup(args),
  HLOOKUP: (...args) => vlookup([args[0], transpose(asMatrix(args[1])), ...args.slice(2)]),
  XLOOKUP: (...args) => xlookup(args),
  TEXTBEFORE: (...args) => textSplit(args, "before"),
  TEXTAFTER: (...args) => textSplit(args, "after"),
  COUNTIF: (range, crit) => count(selected(range, [range, crit])),
  COUNTIFS: (...pairs) => count(selected(pairs[0], pairs)),
  SUMIF: (range, crit, sumRange) => sum(selected(sumRange ?? range, [range, crit])),
  SUMIFS: (sumRange, ...pairs) => sum(selected(sumRange, pairs)),
  AVERAGEIF: (range, crit, avgRange) => average(selected(avgRange ?? range, [range, crit])),
  AVERAGEIFS: (avgRange, ...pairs) => average(selected(avgRange, pairs)),
};
