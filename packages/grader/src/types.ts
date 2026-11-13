// Lesson schema v2 (docs/SPEC.md, Product spec §5). Frozen: propose changes, don't make them.
import type { CellValue } from "@excel-guru/engine";

/** A literal cell in a lesson grid; grid[0][0] is A1. Strings starting with "=" are formulas. */
export type GridValue = string | number | boolean | null;
export type Grid = GridValue[][];

/** Grid or selection shown after a step is answered correctly. */
export type Postcondition = {
  grid?: Grid;
  selection?: string;
};

/** Fields every step may carry. */
export type StepBase = {
  /** Unique within the lesson; the API's stepId. */
  id: string;
  activeCell?: string;
  highlightCells?: string[];
  postcondition?: Postcondition;
  mobileButtons?: string[];
};

export type FormulaStep = StepBase & {
  type: "formula";
  prompt: string;
  grid: Grid;
  targetCell: string;
  expectedValue: CellValue;
  /** Function names the answer must call; compared case-insensitively. */
  mustUse?: string[];
  solution: string;
  explain?: string;
};

export type SelectStep = StepBase & {
  type: "select";
  prompt: string;
  grid: Grid;
  /** "B2", "B2:C4", "B:B" or "3:3". */
  target: string;
};

export type ShortcutChordStep = StepBase & {
  type: "shortcut";
  mode: "chord";
  prompt: string;
  /** e.g. "Ctrl+Shift+ArrowDown"; mac null shows the Mac skip bar. */
  keys: { win: string; mac: string | null };
  pics?: string[];
};

export type ShortcutSequenceStep = StepBase & {
  type: "shortcut";
  mode: "sequence";
  prompt: string;
  /** Key-tips pressed in order, e.g. ["Alt", "H", "1"]; mac null shows the Mac skip bar. */
  keys: { win: string[]; mac: string[] | null };
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
};

export type Step =
  | FormulaStep
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
  difficulty: 1 | 2 | 3;
  requiredCorrect: number;
  isIntro: boolean;
  video: string | null;
  steps: Step[];
};
