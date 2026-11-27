// Lesson schema v2 (docs/SPEC.md, Product spec §5). Frozen: propose changes, don't make them.
import type { CellValue } from "@excel-guru/engine";

/** A literal cell in a lesson grid; grid[0][0] is A1. Strings starting with "=" are formulas. */
export type GridValue = string | number | boolean | null;
export type Grid = GridValue[][];
export type FormatStyle = "bold" | "italic" | "underline" | "strikethrough" | "center" | "border";

/** Grid or selection shown after a step is answered correctly. */
export type Postcondition = {
  grid?: Grid;
  selection?: string;
  format?: Record<string, FormatStyle[]>;
};

export type FormulaBuildFrame = {
  label: string;
  key?: string;
  draft: string;
  focusCell?: string;
  highlightCells?: string[];
  yellowCells?: string[];
  resultCell?: string;
};

export type LiveUpdateConfig = {
  watchCell: string;
  fromValue: GridValue;
  toValue: GridValue;
  resultCell: string;
  buttonLabel?: string;
  resetLabel?: string;
};

export type StepAnimation =
  | {
      kind: "cell-locate";
      col: string;
      row: number;
      cell: string;
    }
  | {
      kind: "formula-build";
      targetCell: string;
      frames: FormulaBuildFrame[];
      liveUpdate?: LiveUpdateConfig;
    }
  | {
      kind: "live-update";
      liveUpdate: LiveUpdateConfig;
    };

/** Fields every step may carry. */
export type StepBase = {
  /** Unique within the lesson; the API's stepId. */
  id: string;
  /** Short heading/topic for this step (e.g. "See a cell"). */
  topic?: string;
  activeCell?: string;
  highlightCells?: string[];
  yellowCells?: string[];
  /** Keycap badges shown on the step (e.g. ["=", "Click B2", "+", "Click B3", "Enter"]). */
  keycaps?: string[];
  /** Progressive clues shown before revealing the answer. */
  clues?: string[];
  /** Wrong attempts required before Show Answer unlocks (defaults to 1). */
  revealAfter?: number;
  postcondition?: Postcondition;
  mobileButtons?: string[];
};

export type FormulaWrongFeedback = {
  notFormula?: string;
  parseError?: string;
  wrongValue?: string;
  missingFunction?: string;
  disallowedFunction?: string;
  missingReference?: string;
};

export type FormulaStep = StepBase & {
  type: "formula";
  prompt: string;
  grid: Grid;
  targetCell: string;
  expectedValue: CellValue;
  /** Function names the answer must call; compared case-insensitively. */
  mustUse?: string[];
  /** Cell or range references the formula must include (e.g. ["B2", "B3"]). */
  mustReference?: string[];
  /** Rejects formulas that call any function (e.g. keep out SUM in Lesson 1). */
  disallowFunctions?: boolean;
  solution: string;
  explain?: string;
  wrongFeedback?: FormulaWrongFeedback;
};

export type SelectStep = StepBase & {
  type: "select";
  prompt: string;
  grid: Grid;
  /** "B2", "B2:C4", "B:B" or "3:3". */
  target: string;
  wrongFeedback?: string;
};

export type EntryWrongFeedback = {
  /** An expected cell is still blank. */
  empty?: string;
  /** A number was expected but the cell holds text (e.g. "1,200 rs"). */
  textNotNumber?: string;
  wrongValue?: string;
};

/**
 * Type values into cells (text, numbers, or anything that changes a formula's result).
 * Correct once every `expect` cell shows its value; text matches ignoring case and outer spaces.
 * The attempt input is a JSON object of cell → text as typed.
 */
export type EntryStep = StepBase & {
  type: "entry";
  prompt: string;
  grid: Grid;
  expect: Record<string, string | number | boolean>;
  explain?: string;
  wrongFeedback?: EntryWrongFeedback;
};

export type ShortcutChordStep = StepBase & {
  type: "shortcut";
  mode: "chord";
  prompt: string;
  /** e.g. "Ctrl+Shift+ArrowDown"; mac null shows the Mac skip bar. */
  keys: { win: string; mac: string | null };
  grid?: Grid;
  pics?: string[];
};

export type ShortcutSequenceStep = StepBase & {
  type: "shortcut";
  mode: "sequence";
  prompt: string;
  /** Key-tips pressed in order, e.g. ["Alt", "H", "1"]; mac null shows the Mac skip bar. */
  keys: { win: string[]; mac: string[] | null };
  grid?: Grid;
  /** One frame per correct key. */
  pics?: string[];
};

export type ShortcutStep = ShortcutChordStep | ShortcutSequenceStep;

export type McqStep = StepBase & {
  type: "mcq";
  prompt: string;
  options: string[];
  /** Index into options. */
  answer: number;
  explain?: string;
  /** Per-option feedback when a wrong option is chosen. */
  wrongFeedback?: (string | null)[];
  /** Optional read-only sheet shown above the question (uses activeCell, highlightCells, yellowCells). */
  grid?: Grid;
  showFormulaBar?: boolean;
};

export type PictureStep = StepBase & {
  type: "picture";
  prompt: string;
  image: string;
  accept: string[];
};

export type ProjectStep = StepBase & {
  type: "project";
  prompt: string;
  file: string;
  accept: string[];
};

export type InfoStep = StepBase & {
  type: "info";
  text: string;
  grid?: Grid;
  showFormulaBar?: boolean;
  selection?: string;
  animation?: StepAnimation;
};

export type Step =
  | FormulaStep
  | EntryStep
  | SelectStep
  | ShortcutStep
  | McqStep
  | PictureStep
  | ProjectStep
  | InfoStep;

export type StepType = Step["type"];

export type Lesson = {
  id: string;
  module: string;
  title: string;
  goal?: string;
  difficulty: 1 | 2 | 3;
  requiredCorrect: number;
  isIntro: boolean;
  video: string | null;
  steps: Step[];
};
