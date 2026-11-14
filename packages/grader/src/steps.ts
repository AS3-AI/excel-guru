// Graders for the non-formula step types (docs/SPEC.md §4, Product spec §5).
import { canonicalCombo } from "./keys";
import type { McqStep, PictureStep, ProjectStep, SelectStep, ShortcutStep } from "./types";

export type Os = "win" | "mac";

const sameCombo = (pressed: string, expected: string): boolean => {
  const p = canonicalCombo(pressed);
  return p !== null && p === canonicalCombo(expected);
};

/** Chord mode: one combo for the learner's OS. A sequence step or keys.mac null on a Mac is false. */
export function gradeShortcutStep(step: ShortcutStep, pressed: string, os: Os): boolean {
  if (step.mode !== "chord") return false;
  const expected = step.keys[os];
  if (expected === null) return false;
  return sameCombo(pressed, expected);
}

/** Sequence mode: the whole pressed list must equal the step's list for the OS, entry by entry. */
export function gradeSequenceStep(step: ShortcutStep, pressed: string[], os: Os): boolean {
  if (step.mode !== "sequence") return false;
  const expected = step.keys[os];
  if (expected === null || pressed.length !== expected.length) return false;
  return expected.every((combo, i) => sameCombo(pressed[i]!, combo));
}

/** Selection "B2", "B2:C4", "B:B" or "3:3", compared in canonical form (any case, either corner first). */
export function gradeSelectStep(step: SelectStep, selection: string): boolean {
  const got = canonicalSelection(selection);
  return got !== null && got === canonicalSelection(step.target);
}

export function gradeMcqStep(step: McqStep, choice: number): boolean {
  return Number.isInteger(choice) && choice === step.answer;
}

/** Free-text answer matched against any of step.accept after normalising both sides. */
export function gradeAcceptStep(step: PictureStep | ProjectStep, input: string): boolean {
  const got = normaliseAnswer(input);
  return got !== "" && step.accept.some((a) => normaliseAnswer(a) === got);
}

/** Smart quotes → straight, all whitespace removed, lower-cased. */
function normaliseAnswer(s: string): string {
  return s
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/\s+/g, "")
    .toLowerCase();
}

// --- selections --------------------------------------------------------------

type Part = { kind: "cell"; row: number; col: number } | { kind: "col"; col: number } | { kind: "row"; row: number };

function parsePart(s: string): Part | null {
  let m = /^([A-Z]{1,3})([1-9]\d*)$/.exec(s);
  if (m) return { kind: "cell", col: columnIndex(m[1]!), row: Number(m[2]) - 1 };
  m = /^([A-Z]{1,3})$/.exec(s);
  if (m) return { kind: "col", col: columnIndex(m[1]!) };
  m = /^([1-9]\d*)$/.exec(s);
  if (m) return { kind: "row", row: Number(m[1]) - 1 };
  return null;
}

/** "A" → 0, "AA" → 26. */
function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function columnLetters(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * Canonical spelling of a selection: uppercase, top-left corner first, a one-cell range
 * as the cell ("b2:b2" → "B2", "C4:A2" → "A2:C4", "C:A" → "A:C"); null if malformed.
 */
function canonicalSelection(selection: string): string | null {
  const pieces = selection.trim().toUpperCase().split(":");
  if (pieces.length === 1) {
    const p = parsePart(pieces[0]!);
    return p?.kind === "cell" ? pieces[0]! : null;
  }
  if (pieces.length !== 2) return null;
  const a = parsePart(pieces[0]!);
  const b = parsePart(pieces[1]!);
  if (!a || !b) return null;
  if (a.kind === "cell" && b.kind === "cell") {
    const tl = `${columnLetters(Math.min(a.col, b.col))}${Math.min(a.row, b.row) + 1}`;
    const br = `${columnLetters(Math.max(a.col, b.col))}${Math.max(a.row, b.row) + 1}`;
    return tl === br ? tl : `${tl}:${br}`;
  }
  if (a.kind === "col" && b.kind === "col") {
    return `${columnLetters(Math.min(a.col, b.col))}:${columnLetters(Math.max(a.col, b.col))}`;
  }
  if (a.kind === "row" && b.kind === "row") {
    return `${Math.min(a.row, b.row) + 1}:${Math.max(a.row, b.row) + 1}`;
  }
  return null;
}
