import * as formulajs from "@formulajs/formulajs";
import type { CellValue, ErrorCode, ExcelError, Matrix } from "./evaluator";

/** A function argument: a scalar, a range as a 2-D array, or undefined for an omitted one. */
export type Arg = CellValue | Matrix | undefined;
type Impl = (...args: Arg[]) => CellValue | Matrix;

const CODES: ErrorCode[] = ["#DIV/0!", "#N/A", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#SPILL!", "#CIRC!"];
const LIBRARY = formulajs as unknown as Record<string, unknown>;

// Day 0 of Excel's 1900 date system, so 1900-03-01 onwards matches Excel's serials.
const EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

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
function xlookup(args: Arg[]): CellValue {
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
  // Until T6 spills, a return_array several columns wide (or rows tall) gives the first
  // value of the matched row (or column); T6 should return the whole row/column.
  let cells: CellValue[];
  let result: (i: number) => CellValue;
  if (keys.every((row) => row.length === 1)) {
    cells = keys.map((row) => row[0]!);
    if (ret.length !== cells.length) return VALUE;
    result = (i) => ret[i]![0] ?? null;
  } else if (keys.length === 1) {
    const row = keys[0]!;
    cells = row;
    if (ret.some((r) => r.length !== row.length)) return VALUE;
    result = (i) => ret[0]![i] ?? null;
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

const OWN: Record<string, Impl> = {
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
