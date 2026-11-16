import { ParseError, Sheet, TokenizeError, type CellValue } from "@excel-guru/engine";
import type { FormulaStep } from "./types";

export type GradeResult = {
  correct: boolean;
  reason?: "not_formula" | "parse_error" | "wrong_value" | "missing_function";
};

const TOLERANCE = 1e-9;
export const LESSON_TODAY = "2026-01-15";

/**
 * Grades a learner's formula on a fresh sheet built from the step's grid.
 * Order: not_formula → parse_error → wrong_value → missing_function.
 */
export function gradeFormulaStep(step: FormulaStep, input: string): GradeResult {
  if (!input.startsWith("=")) return { correct: false, reason: "not_formula" };

  const sheet = new Sheet(step.grid, { today: LESSON_TODAY });
  try {
    sheet.set(step.targetCell, input);
  } catch (e) {
    if (e instanceof TokenizeError || e instanceof ParseError) {
      return { correct: false, reason: "parse_error" };
    }
    throw e;
  }

  if (!sameValue(sheet.get(step.targetCell), step.expectedValue)) {
    return { correct: false, reason: "wrong_value" };
  }

  const used = new Set(sheet.functionsUsed(step.targetCell).map((n) => n.toUpperCase()));
  if ((step.mustUse ?? []).some((n) => !used.has(n.toUpperCase()))) {
    return { correct: false, reason: "missing_function" };
  }

  return { correct: true };
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
