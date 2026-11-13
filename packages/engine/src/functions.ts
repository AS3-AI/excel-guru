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
  if (c === undefined || c === null) return (v) => v === null || v === "";
  if (Array.isArray(c)) return criterion(c[0]?.[0] ?? null);
  if (isError(c)) return (v) => isError(v) && v.error === c.error;
  if (typeof c === "number") return (v) => toNumber(v) === c;
  if (typeof c === "boolean") return (v) => v === c;

  const [, op = "", operand = ""] = CRITERIA_RE.exec(c)!;
  const num = operand.trim() === "" ? NaN : Number(operand);
  const upper = operand.toUpperCase();

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

const OWN: Record<string, Impl> = {
  DATEVALUE: (text) => datevalue(text),
  COUNTIF: (range, crit) => count(selected(range, [range, crit])),
  COUNTIFS: (...pairs) => count(selected(pairs[0], pairs)),
  SUMIF: (range, crit, sumRange) => sum(selected(sumRange ?? range, [range, crit])),
  SUMIFS: (sumRange, ...pairs) => sum(selected(sumRange, pairs)),
  AVERAGEIF: (range, crit, avgRange) => average(selected(avgRange ?? range, [range, crit])),
  AVERAGEIFS: (avgRange, ...pairs) => average(selected(avgRange, pairs)),
};
