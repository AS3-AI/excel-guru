import { ParseError, Sheet, TokenizeError, type CellValue } from "@excel-guru/engine";
import { LESSON_TODAY } from "./formula";
import type { EntryStep } from "./types";

export type EntryResult = {
  correct: boolean;
  /** The first expected cell that is off. */
  cell?: string;
  reason?: "empty" | "text_not_number" | "wrong_value";
};

const CELL = /^[A-Z]{1,3}[1-9]\d{0,6}$/;
const MAX_EDITS = 200;

/**
 * Grades an entry step on a fresh sheet built from the step's grid plus the learner's edits
 * (cell → text as typed). Edits to unchecked cells are allowed; a formula that doesn't parse is skipped.
 */
export function gradeEntryStep(step: EntryStep, edits: Record<string, string>): EntryResult {
  const sheet = new Sheet(step.grid, { today: LESSON_TODAY });
  for (const [addr, text] of Object.entries(edits)) {
    if (!CELL.test(addr)) continue;
    try {
      sheet.set(addr, text);
    } catch (e) {
      if (!(e instanceof TokenizeError || e instanceof ParseError)) throw e;
    }
  }
  for (const [cell, want] of Object.entries(step.expect)) {
    const got = sheet.get(cell);
    if (same(got, want)) continue;
    if (got === null || got === "") return { correct: false, cell, reason: "empty" };
    if (typeof want === "number" && typeof got === "string")
      return { correct: false, cell, reason: "text_not_number" };
    return { correct: false, cell, reason: "wrong_value" };
  }
  return { correct: true };
}

/** Grades the attempt input the player sends: a JSON object of cell → string. Anything else counts as no edits. */
export function gradeEntryInput(step: EntryStep, input: string): EntryResult {
  return gradeEntryStep(step, parseEntryInput(input) ?? {});
}

export function parseEntryInput(input: string): Record<string, string> | null {
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const entries = Object.entries(data);
  if (entries.length > MAX_EDITS || entries.some(([, v]) => typeof v !== "string")) return null;
  return Object.fromEntries(entries) as Record<string, string>;
}

function same(got: CellValue, want: string | number | boolean): boolean {
  if (typeof want === "number") return typeof got === "number" && Math.abs(got - want) <= 1e-9;
  if (typeof want === "string")
    return typeof got === "string" && got.trim().toLowerCase() === want.trim().toLowerCase();
  return got === want;
}
