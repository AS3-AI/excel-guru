import { ParseError, Sheet, TokenizeError, tokenize, type CellValue } from "@excel-guru/engine";
import type { FormulaStep } from "./types";

export type GradeResult = {
  correct: boolean;
  reason?:
    | "not_formula"
    | "parse_error"
    | "wrong_value"
    | "missing_function"
    | "disallowed_function"
    | "missing_reference";
};

const TOLERANCE = 1e-9;
// Spill cells beyond 100 rows or columns are not scanned; lessons are at most 7×8.
const SPILL_SCAN = 100;
export const LESSON_TODAY = "2026-01-15";

/**
 * Grades a learner's formula on a fresh sheet built from the step's grid.
 * Order: not_formula → parse_error → wrong_value → missing_function → disallowed_function → missing_reference.
 */
export function gradeFormulaStep(step: FormulaStep, input: string): GradeResult {
  if (!input.startsWith("=")) return { correct: false, reason: "not_formula" };

  const sheet = new Sheet(step.grid, { today: LESSON_TODAY });
  const before = new Sheet(step.grid, { today: LESSON_TODAY });
  try {
    sheet.set(step.targetCell, input);
  } catch (e) {
    if (e instanceof TokenizeError || e instanceof ParseError) {
      return { correct: false, reason: "parse_error" };
    }
    throw e;
  }

  const solutionSheet = new Sheet(step.grid);
  solutionSheet.set(step.targetCell, step.solution);

  const learnerSpill = spillValues(before, sheet, step.targetCell);
  const solutionSpill = spillValues(before, solutionSheet, step.targetCell);
  if (solutionSpill.size > 1) {
    if (!sameSpill(learnerSpill, solutionSpill)) return { correct: false, reason: "wrong_value" };
  } else if (learnerSpill.size > 1) {
    return { correct: false, reason: "wrong_value" };
  }
  if (!sameValue(sheet.get(step.targetCell), step.expectedValue)) {
    return { correct: false, reason: "wrong_value" };
  }

  const used = new Set(sheet.functionsUsed(step.targetCell).map((n) => n.toUpperCase()));
  if ((step.mustUse ?? []).some((n) => !used.has(n.toUpperCase()))) {
    return { correct: false, reason: "missing_function" };
  }
  if (step.disallowFunctions && used.size > 0) {
    return { correct: false, reason: "disallowed_function" };
  }

  if (step.mustReference?.length) {
    const refs = formulaReferences(input);
    const missing = step.mustReference.some((req) => !refs.has(normalizeRef(req)));
    if (missing) return { correct: false, reason: "missing_reference" };
  }

  return { correct: true };
}

function normalizeRef(ref: string): string {
  return ref.replace(/[\s$]/g, "").toUpperCase();
}

/** Standalone cell references and range references present in a formula, uppercased without $. */
function formulaReferences(formula: string): Set<string> {
  const out = new Set<string>();
  const toks = tokenize(formula);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    const next = toks[i + 1];
    const end = toks[i + 2];
    if (t.type === "REF" && next?.type === "COLON" && end?.type === "REF") {
      out.add(`${normalizeRef(t.value)}:${normalizeRef(end.value)}`);
      i += 2;
    } else if (t.type === "REF") {
      out.add(normalizeRef(t.value));
    }
  }
  return out;
}

/** Finds cells filled by a spill using only the frozen Sheet API and the original grid. */
function spillValues(before: Sheet, after: Sheet, target: string): Map<string, CellValue> {
  const anchor = parseCell(target);
  if (!anchor) return new Map([["", after.get(target)]]);
  const out = new Map<string, CellValue>([["0,0", after.get(target)]]);
  for (let row = anchor.row; row < anchor.row + SPILL_SCAN; row++) {
    for (let col = anchor.col; col < anchor.col + SPILL_SCAN; col++) {
      if (row === anchor.row && col === anchor.col) continue;
      const address = cellName(row, col);
      const previous = before.get(address);
      const current = after.get(address);
      if (previous === null && current !== null)
        out.set(`${row - anchor.row},${col - anchor.col}`, current);
    }
  }
  return out;
}

function sameSpill(actual: Map<string, CellValue>, expected: Map<string, CellValue>): boolean {
  if (actual.size !== expected.size) return false;
  for (const [cell, value] of expected) {
    if (!actual.has(cell) || !sameValue(actual.get(cell)!, value)) return false;
  }
  return true;
}

function parseCell(address: string): { row: number; col: number } | null {
  const match = /^([A-Z]+)([1-9]\d*)$/i.exec(address);
  if (!match) return null;
  let col = 0;
  for (const char of match[1]!.toUpperCase()) col = col * 26 + char.charCodeAt(0) - 64;
  return { row: Number(match[2]) - 1, col: col - 1 };
}

function cellName(row: number, col: number): string {
  let n = col + 1;
  let letters = "";
  while (n > 0) {
    const digit = (n - 1) % 26;
    letters = String.fromCharCode(65 + digit) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${row + 1}`;
}

/** Numbers within 1e-9; strings and booleans exact; errors by code; any type mismatch is wrong. */
function sameValue(actual: CellValue, expected: CellValue): boolean {
  if (actual === null || expected === null) return actual === expected;
  if (typeof actual === "number" && typeof expected === "number") {
    return Math.abs(actual - expected) <= TOLERANCE;
  }
  if (typeof actual === "object" && typeof expected === "object") {
    return actual.error === expected.error;
  }
  return typeof actual === typeof expected && actual === expected;
}
