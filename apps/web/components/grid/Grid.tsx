"use client";

import { useEffect, useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";
import {
  ParseError,
  Sheet,
  TokenizeError,
  type CellValue,
  type ExcelError,
} from "@excel-guru/engine";
import { FormulaBar, RefMirror, RefText, type ColouredRef } from "./FormulaBar";
import { arrowPoints, canPoint, findRefs, insertRef, refColours, wholeLineRef } from "./refs";
import { Icon } from "../icons";
import "./grid.css";

/** A starting cell: a literal, or a string starting with "=" for a formula (as Sheet takes it). */
export type GridLiteral = string | number | boolean | null;
export type Pos = { row: number; col: number };
/** 0-based inclusive rectangle; whole columns/rows run to Infinity. */
export type Rect = { r1: number; c1: number; r2: number; c2: number };

export type GridProps = {
  /**
   * grid[0][0] is A1. Compared by value on every render: an equal grid (even a new array) keeps the
   * learner's edits; a different one resets the sheet, selection, editor and error, and refreshes sheetRef.
   */
  grid: GridLiteral[][];
  today?: string;
  /** The cell the learner should answer in, e.g. "C2". */
  targetCell?: string;
  /** Cells or ranges to tint, e.g. ["B2:B6"]. */
  highlightCells?: string[];
  /** Cells or ranges to highlight in yellow, e.g. ["B2"]. */
  yellowCells?: string[];
  /** Column letters and 1-based row numbers to highlight in the headers. */
  highlightHeaders?: { cols?: string[]; rows?: number[] };
  /** Cells to flash with a yellow pop when flashKey changes. */
  flashCells?: string[];
  flashKey?: number;
  /** Called after each successful Sheet.set, with the address and the text as typed ("" when cleared). */
  onCommit?: (addr: string, input: string) => void;
  /** Called after undo, redo, or reset changes the applied edit history. */
  onHistoryChange?: (edits: readonly SheetEdit[]) => void;
  /** Called when the learner opens an editor (typing, F2, Backspace, double-click, the formula bar or fx). */
  onEditStart?: () => void;
  /** Disables sheet undo/redo/reset buttons (for example after a step is already graded correct). */
  disableSheetActions?: boolean;
  /** Receives the live Sheet so the caller can read or grade it. */
  sheetRef?: { current: Sheet | null };
  /** Read-only worksheet that reports cell or range selections instead of editing cells. */
  selectMode?: boolean;
  onSelectionChange?: (ref: string) => void;
  /** Static worksheet for demonstrations: no editing, focus, or keyboard handling. */
  displayOnly?: boolean;
  /** Show the Excel formula bar header (defaults to true). */
  showFormulaBar?: boolean;
  /** Animated/preview formula draft shown in previewCell (or activeCell) when displayOnly is true. */
  previewCell?: string;
  previewDraft?: string;
  /** Shows a blinking caret at the end of previewDraft. */
  previewCaret?: boolean;
  /** When false, previewCell displays its evaluated sheet value while the formula bar shows previewDraft. */
  previewInCell?: boolean;
  activeCell?: string;
  selection?: string;
  format?: Record<string, string[]>;
  onDisplayClick?: () => void;
  /** Called when a learner clicks a cell in displayOnly mode to inspect it. */
  onInspectCell?: (addr: string) => void;
  /** Optional status controls rendered on the right of the bottom Excel sheet bar. */
  sheetBarRight?: import("react").ReactNode;
};

const MIN_COLS = 7;
const MIN_ROWS = 8;

// ---------- pure helpers (unit-tested in Grid.test.ts) ----------

export function colLetter(col: number): string {
  let s = "";
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export const addressOf = ({ row, col }: Pos): string => `${colLetter(col)}${row + 1}`;

/** At least 7 columns × 8 rows, more if the lesson data needs it. */
export function gridSize(grid: GridLiteral[][]): { rows: number; cols: number } {
  const widest = grid.reduce((w, r) => Math.max(w, r.length), 0);
  return { rows: Math.max(MIN_ROWS, grid.length), cols: Math.max(MIN_COLS, widest) };
}

const DELTAS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/** The cell one step away in the arrow's direction, clamped to the grid. */
export function move(pos: Pos, key: string, size: { rows: number; cols: number }): Pos {
  const d = DELTAS[key];
  if (!d) return pos;
  return {
    row: Math.min(size.rows - 1, Math.max(0, pos.row + d[0])),
    col: Math.min(size.cols - 1, Math.max(0, pos.col + d[1])),
  };
}

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const CELL_RE = /^\$?([A-Za-z]{1,3})\$?([1-9]\d*)$/;
const COL_RE = /^\$?([A-Za-z]{1,3})$/;
const ROW_RE = /^\$?([1-9]\d*)$/;

/** "C2", "B2:B6", "B:C" or "3:3" as a rectangle, or null if it isn't a reference. */
export function parseRef(ref: string): Rect | null {
  const parts = ref.trim().split(":");
  if (parts.length > 2 || parts.some((p) => p === "")) return null;
  const [a, b = a] = parts as [string, string?];

  const ca = CELL_RE.exec(a),
    cb = CELL_RE.exec(b);
  if (ca && cb) {
    const r = [Number(ca[2]) - 1, Number(cb[2]) - 1],
      c = [colIndex(ca[1]!), colIndex(cb[1]!)];
    return {
      r1: Math.min(r[0]!, r[1]!),
      c1: Math.min(c[0]!, c[1]!),
      r2: Math.max(r[0]!, r[1]!),
      c2: Math.max(c[0]!, c[1]!),
    };
  }
  if (parts.length === 2) {
    const ka = COL_RE.exec(a),
      kb = COL_RE.exec(b);
    if (ka && kb) {
      const c = [colIndex(ka[1]!), colIndex(kb[1]!)];
      return { r1: 0, c1: Math.min(c[0]!, c[1]!), r2: Infinity, c2: Math.max(c[0]!, c[1]!) };
    }
    const ra = ROW_RE.exec(a),
      rb = ROW_RE.exec(b);
    if (ra && rb) {
      const r = [Number(ra[1]) - 1, Number(rb[1]) - 1];
      return { r1: Math.min(r[0]!, r[1]!), c1: 0, r2: Math.max(r[0]!, r[1]!), c2: Infinity };
    }
  }
  return null;
}

export const inRects = (rects: Rect[], row: number, col: number): boolean =>
  rects.some((r) => row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2);

const isErr = (v: CellValue): v is ExcelError => typeof v === "object" && v !== null;

/** What a cell shows: errors as their code, booleans as TRUE/FALSE, numbers to 10 significant digits. */
export function formatValue(v: CellValue, date = false): string {
  if (v === null) return "";
  if (isErr(v)) return v.error;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    if (date) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
      return `${d.getUTCDate()} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
    }
    return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(10)));
  }
  return v;
}

/** What the formula bar shows for a non-formula cell: the literal at full precision. */
export function rawInput(v: CellValue): string {
  if (v === null) return "";
  if (isErr(v)) return v.error;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

/** A key press that should start editing the cell with that character. */
export function isTypingKey(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): boolean {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey;
}

/** Same cells, by value: a parent re-rendering with an equal copy of `grid` must not wipe the learner's edits. */
export function sameGrid(a: GridLiteral[][], b: GridLiteral[][]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((row, r) => {
    const other = b[r]!;
    return row.length === other.length && row.every((v, c) => Object.is(v, other[c]));
  });
}

/** Where Tab (→) or Shift+Tab (←) goes, or null at the edge so the browser can move focus out of the grid. */
export function tabStep(
  pos: Pos,
  shift: boolean,
  size: { rows: number; cols: number },
): Pos | null {
  const next = move(pos, shift ? "ArrowLeft" : "ArrowRight", size);
  return next.col === pos.col ? null : next;
}

/** Where Enter goes: back to the column a Tab run started in, one row down (as Excel does), else down or up. */
export function enterStep(
  pos: Pos,
  tabStartCol: number | null,
  shift: boolean,
  size: { rows: number; cols: number },
): Pos {
  const next = move(pos, shift ? "ArrowUp" : "ArrowDown", size);
  return tabStartCol === null || shift ? next : { row: next.row, col: tabStartCol };
}

/** AutoSum: Alt+= (Option+= on a Mac types ≠, so match the physical key) or Excel for Mac's Cmd+Shift+T. */
export function isAutoSumKey(e: {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): boolean {
  if (e.altKey && !e.ctrlKey && !e.metaKey) return e.code === "Equal" || e.key === "=";
  return e.metaKey && e.shiftKey && !e.altKey && !e.ctrlKey && e.key.toLowerCase() === "t";
}

/** Excel's AutoSum draft: the run of numbers directly above the cell, else directly left, else "=SUM()". */
export function autoSumFormula(sheet: Sheet, pos: Pos): string {
  const isNum = (row: number, col: number) =>
    row >= 0 && col >= 0 && typeof sheet.get(addressOf({ row, col })) === "number";
  let row = pos.row - 1;
  while (isNum(row, pos.col)) row--;
  if (row < pos.row - 1)
    return `=SUM(${rangeRef({ row: row + 1, col: pos.col }, { row: pos.row - 1, col: pos.col })})`;
  let col = pos.col - 1;
  while (isNum(pos.row, col)) col--;
  if (col < pos.col - 1)
    return `=SUM(${rangeRef({ row: pos.row, col: col + 1 }, { row: pos.row, col: pos.col - 1 })})`;
  return "=SUM()";
}

/**
 * What ending an edit does. An unchanged draft just closes: re-setting it would re-parse the
 * cell (text "007" would become 7) and fire onCommit for a mere focus.
 */
export function editOutcome(draft: string, current: string): "close" | "commit" {
  return draft === current ? "close" : "commit";
}

/**
 * The longest text each column shows in the starting sheet (formatted, as the cell displays it),
 * capped so one long label can't take over the grid. 0 for an empty column.
 */
export function colMinChars(
  sheet: Sheet,
  { rows, cols }: { rows: number; cols: number },
  cap = 14,
): number[] {
  return Array.from({ length: cols }, (_, col) => {
    let longest = 0;
    for (let row = 0; row < rows; row++) {
      const addr = addressOf({ row, col });
      longest = Math.max(longest, formatValue(sheet.get(addr), sheet.isDate(addr)).length);
    }
    return Math.min(cap, longest);
  });
}

/**
 * grid-template-columns: every column shares the width equally (1fr), but a column that holds text
 * never shrinks below that text plus the cell padding (1ch, the width of "0", is wider than an
 * average letter, so this leaves slack). On a wide screen the equal share wins, so the look is
 * unchanged; on a phone empty columns give way to the text ones.
 */
export function gridColumns(minChars: number[]): string {
  const tracks = minChars.map((n) =>
    n > 0 ? `minmax(calc(${n}ch + 8px), 1fr)` : "minmax(0, 1fr)",
  );
  return ["var(--eg-rowhead)", ...tracks].join(" ");
}

// ---------- point mode and coloured references (T18) ----------

/** The reference point mode inserts for a selection from `anchor` to `cursor`: "A1" or "A1:B3". */
export function rangeRef(anchor: Pos, cursor: Pos): string {
  const from = addressOf({
    row: Math.min(anchor.row, cursor.row),
    col: Math.min(anchor.col, cursor.col),
  });
  const to = addressOf({
    row: Math.max(anchor.row, cursor.row),
    col: Math.max(anchor.col, cursor.col),
  });
  return from === to ? from : `${from}:${to}`;
}

/** Canonical reference from an anchor/cursor, optionally representing a whole row or column. */
export function selectionRef(anchor: Pos, cursor: Pos, whole?: "row" | "column"): string {
  if (whole === "column")
    return `${colLetter(Math.min(anchor.col, cursor.col))}:${colLetter(Math.max(anchor.col, cursor.col))}`;
  if (whole === "row")
    return `${Math.min(anchor.row, cursor.row) + 1}:${Math.max(anchor.row, cursor.row) + 1}`;
  return rangeRef(anchor, cursor);
}

/**
 * Where a reference's outline sits, as CSS grid lines (line 1 is the header row/column), clipped to
 * the grid so whole columns and rows stop at its edge. Null when it is entirely off the grid.
 */
export function refArea(
  r: Rect,
  size: { rows: number; cols: number },
): { gridRow: string; gridColumn: string } | null {
  if (r.r1 >= size.rows || r.c1 >= size.cols) return null;
  const r2 = Math.min(r.r2, size.rows - 1),
    c2 = Math.min(r.c2, size.cols - 1);
  return { gridRow: `${r.r1 + 2} / ${r2 + 3}`, gridColumn: `${r.c1 + 2} / ${c2 + 3}` };
}

// ---------- spills (T6) ----------

/** Rows and columns a spill may add past the lesson's own size, so a huge array can't hang the page. */
const MAX_SPILL_ROWS = 500;
const MAX_SPILL_COLS = 52;

/**
 * The grid's size grown to include any spill that runs past it (a spill is contiguous and starts
 * inside, so probing the row and column just past the edge finds it), and the active cell, so a
 * spill that shrinks doesn't strand the selection.
 */
export function sizeWithSpills(
  sheet: Sheet,
  base: { rows: number; cols: number },
  active: Pos,
): { rows: number; cols: number } {
  let rows = Math.max(base.rows, active.row + 1);
  let cols = Math.max(base.cols, active.col + 1);
  const rowUsed = (row: number) =>
    Array.from({ length: cols }, (_, col) => col).some(
      (col) => sheet.get(addressOf({ row, col })) !== null,
    );
  const colUsed = (col: number) =>
    Array.from({ length: rows }, (_, row) => row).some(
      (row) => sheet.get(addressOf({ row, col })) !== null,
    );
  for (let grew = true; grew;) {
    grew = false;
    while (rows < base.rows + MAX_SPILL_ROWS && rowUsed(rows)) {
      rows++;
      grew = true;
    }
    while (cols < base.cols + MAX_SPILL_COLS && colUsed(cols)) {
      cols++;
      grew = true;
    }
  }
  return { rows, cols };
}

/**
 * Which cells hold a spilled value, mapped to their anchor (the cell with the formula). The Sheet API
 * doesn't say, so it's derived: a cell that shows a value but holds no formula and no literal the
 * lesson or learner put there (`isLiteral`) was filled by a spill. Spills are rectangles anchored at
 * their top-left, so a spilled cell's anchor is its left or upper neighbour's (or that neighbour, if
 * it holds the formula). When both fit, which is ambiguous only where a formula sits right beside
 * another formula's spill, the reading that leaves every spill a whole rectangle wins.
 */
export function findSpills(
  sheet: Sheet,
  isLiteral: (addr: string) => boolean,
  size: { rows: number; cols: number },
): Map<string, string> {
  const attempt = (preferUp: boolean) => {
    const owner = new Map<string, string>();
    const ownerOf = (row: number, col: number): string | null => {
      if (row < 0 || col < 0) return null;
      const a = addressOf({ row, col });
      return sheet.getFormula(a) !== null ? a : (owner.get(a) ?? null);
    };
    let orphans = 0;
    for (let row = 0; row < size.rows; row++) {
      for (let col = 0; col < size.cols; col++) {
        const a = addressOf({ row, col });
        if (sheet.getFormula(a) !== null || isLiteral(a) || sheet.get(a) === null) continue;
        const fits = (anchor: string | null): anchor is string => {
          if (anchor === null) return false;
          const p = parseRef(anchor)!;
          return (
            (p.r1 === row || ownerOf(row - 1, col) === anchor) &&
            (p.c1 === col || ownerOf(row, col - 1) === anchor)
          );
        };
        const left = ownerOf(row, col - 1),
          up = ownerOf(row - 1, col);
        const anchor = [preferUp ? up : left, preferUp ? left : up].find(fits);
        if (anchor) owner.set(a, anchor);
        else orphans++;
      }
    }
    // Each anchor's cells must fill the rectangle from the anchor to its furthest cell.
    const boxes = new Map<string, { r2: number; c2: number; n: number }>();
    for (const [cell, anchor] of owner) {
      const p = parseRef(cell)!,
        b = boxes.get(anchor) ?? { r2: 0, c2: 0, n: 0 };
      boxes.set(anchor, { r2: Math.max(b.r2, p.r1), c2: Math.max(b.c2, p.c1), n: b.n + 1 });
    }
    let broken = orphans;
    for (const [anchor, b] of boxes) {
      const p = parseRef(anchor)!;
      if ((b.r2 - p.r1 + 1) * (b.c2 - p.c1 + 1) - 1 !== b.n) broken++;
    }
    return { owner, broken };
  };
  const up = attempt(true);
  if (up.broken === 0) return up.owner;
  const left = attempt(false);
  return left.broken < up.broken ? left.owner : up.owner;
}

/** Cells holding a literal in the starting grid (strings starting with "=" are formulas there). */
export function literalCells(grid: GridLiteral[][]): Set<string> {
  const out = new Set<string>();
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v !== null && !(typeof v === "string" && v.startsWith("=")))
        out.add(addressOf({ row: r, col: c }));
    }),
  );
  return out;
}

export type SheetEdit = { addr: string; pos: Pos; input: string };
export type EditHistory = { past: SheetEdit[]; future: SheetEdit[] };

export const EMPTY_HISTORY: EditHistory = { past: [], future: [] };

/** Records a new committed cell edit and clears any redo branch. */
export function pushEdit(history: EditHistory, edit: SheetEdit): EditHistory {
  return { past: [...history.past, edit], future: [] };
}

/** Steps back one committed edit if available. */
export function undoEdit(history: EditHistory): { history: EditHistory; undone: SheetEdit | null } {
  if (history.past.length === 0) return { history, undone: null };
  const undone = history.past[history.past.length - 1]!;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [undone, ...history.future],
    },
    undone,
  };
}

/** Re-applies the next undone edit if available. */
export function redoEdit(history: EditHistory): { history: EditHistory; redone: SheetEdit | null } {
  if (history.future.length === 0) return { history, redone: null };
  const [redone, ...future] = history.future;
  return {
    history: {
      past: [...history.past, redone!],
      future,
    },
    redone: redone!,
  };
}

const applySheetInput = (sheet: Sheet, literals: Set<string>, addr: string, input: string) => {
  sheet.set(addr, input);
  if (input === "" || input.startsWith("=")) literals.delete(addr);
  else literals.add(addr);
};

/** Rebuilds the worksheet from its starting grid plus the active edit log. */
export function rebuildLoaded(
  grid: GridLiteral[][],
  edits: readonly SheetEdit[],
  today?: string,
): Loaded {
  const next = load(grid, today);
  for (const edit of edits) {
    applySheetInput(next.sheet, next.literals, edit.addr, edit.input);
  }
  return next;
}

// ---------- component ----------

/**
 * The reference point mode last inserted: its span in the draft, and the selection it names
 * (anchor stays put under Shift; cursor is what the next arrow moves). Typing drops it.
 */
type Point = { start: number; end: number; anchor: Pos; cursor: Pos };
/**
 * `entering` is Excel's Enter mode: the last change was typed text or a pointed reference, so an
 * arrow at a trigger points. A click in the editor or a caret move clears it (Edit mode).
 */
type Editing = { draft: string; from: "cell" | "bar"; point?: Point; entering?: boolean };
type Loaded = {
  grid: GridLiteral[][];
  sheet: Sheet;
  size: { rows: number; cols: number };
  minChars: number[];
  /** Cells that hold a literal of their own, kept in step with every write, so spilled cells can be told apart. */
  literals: Set<string>;
};

const load = (grid: GridLiteral[][], today?: string): Loaded => {
  const sheet = new Sheet(grid, { today });
  const size = gridSize(grid);
  // Sized once from the lesson's data, so columns don't jump while the learner types.
  return { grid, sheet, size, minChars: colMinChars(sheet, size), literals: literalCells(grid) };
};
const ORIGIN: Pos = { row: 0, col: 0 };
const initialActive = (activeCell?: string): Pos => {
  const parsed = activeCell ? parseRef(activeCell) : null;
  return parsed ? { row: parsed.r1, col: parsed.c1 } : ORIGIN;
};

export function Grid({
  grid,
  today,
  targetCell,
  highlightCells,
  yellowCells,
  highlightHeaders,
  flashCells,
  flashKey,
  onCommit,
  onHistoryChange,
  onEditStart,
  disableSheetActions = false,
  sheetRef,
  selectMode = false,
  onSelectionChange,
  displayOnly = false,
  showFormulaBar = true,
  previewCell,
  previewDraft,
  previewCaret = false,
  previewInCell = true,
  activeCell,
  selection: selectionProp,
  format,
  onDisplayClick,
  onInspectCell,
  sheetBarRight,
}: GridProps) {
  const [loaded, setLoaded] = useState(() => load(grid, today));
  const [history, setHistory] = useState<EditHistory>(EMPTY_HISTORY);
  const historyRef = useRef<EditHistory>(EMPTY_HISTORY);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [active, setActive] = useState<Pos>(() => initialActive(activeCell));
  const [inspected, setInspected] = useState<Pos | null>(null);
  const [prevActiveProp, setPrevActiveProp] = useState(activeCell);
  if (activeCell !== prevActiveProp) {
    setPrevActiveProp(activeCell);
    setInspected(null);
  }
  const [selection, setSelection] = useState<{
    anchor: Pos;
    cursor: Pos;
    whole?: "row" | "column";
  } | null>(null);
  const touchHold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditingState] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sheetEl = useRef<HTMLDivElement>(null);
  const gridEl = useRef<HTMLDivElement>(null);
  const scrollEl = useRef<HTMLDivElement>(null);
  const cellInput = useRef<HTMLInputElement>(null);
  const barInput = useRef<HTMLInputElement>(null);
  const lastPointer = useRef<string>("mouse");
  // Mirrors `editing` synchronously, so a blur fired mid-commit sees the edit as already closed.
  const editingRef = useRef<Editing | null>(null);
  /** Where to put the caret after the next render (point mode rewrote the draft). */
  const pendingCaret = useRef<number | null>(null);
  /** A mouse button went down on a cell in point mode: entering other cells extends the range. */
  const dragging = useRef(false);
  /** A mouse button went down on a cell to drag-select a range outside of edit mode. */
  const draggingRange = useRef<Pos | null>(null);
  /** Column where the current run of Tabs began; Enter returns there (Excel). Arrows and clicks end the run. */
  const tabStartCol = useRef<number | null>(null);
  const idBase = useId();

  const setEditing = (ed: Editing | null) => {
    editingRef.current = ed;
    setEditingState(ed);
  };

  // A different `grid` (by value) is a new exercise: fresh Sheet, size, selection, editor and error.
  // Adjusting state during render is React's documented pattern for resetting on a prop change.
  if (!sameGrid(grid, loaded.grid)) {
    setLoaded(load(grid, today));
    historyRef.current = EMPTY_HISTORY;
    setHistory(EMPTY_HISTORY);
    setActive(initialActive(activeCell));
    setSelection(null);
    setInspected(null);
    editingRef.current = null;
    setEditingState(null);
    setError(null);
  }
  const { sheet, literals } = loaded;
  const displayPos =
    (activeCell ? parseRef(activeCell) : null) ?? (selectionProp ? parseRef(selectionProp) : null);
  const shownActive = displayOnly
    ? (inspected ?? (displayPos ? { row: displayPos.r1, col: displayPos.c1 } : active))
    : active;
  const headActive = displayOnly ? shownActive : active;
  // Grows past the lesson's size when a spill runs off the edge; new columns start flexible.
  const size = sizeWithSpills(sheet, loaded.size, active);
  const columns = gridColumns([
    ...loaded.minChars,
    ...Array<number>(size.cols - loaded.size.cols).fill(0),
  ]);
  const spills = findSpills(sheet, (a) => literals.has(a), size);
  const anchors = new Set(spills.values());

  useEffect(() => {
    if (sheetRef) sheetRef.current = sheet;
  }, [sheet, sheetRef]);
  useEffect(() => {
    if (selectMode && !selection) {
      setSelection({ anchor: ORIGIN, cursor: ORIGIN });
      onSelectionChange?.(addressOf(ORIGIN));
    }
  }, [selectMode, selection, onSelectionChange]);

  // Put the caret at the end of whichever editor just opened.
  const from = editing?.from;
  useLayoutEffect(() => {
    const el = from === "cell" ? cellInput.current : from === "bar" ? barInput.current : null;
    if (el && document.activeElement !== el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [from, active]);

  /** The editor the learner is typing in: the focused one, else the one the edit opened in. */
  const editorEl = (): HTMLInputElement | null => {
    const focused = document.activeElement;
    if (focused && (focused === cellInput.current || focused === barInput.current))
      return focused as HTMLInputElement;
    return editingRef.current?.from === "bar" ? barInput.current : cellInput.current;
  };

  // After point mode rewrites the draft, put the caret just after the inserted reference.
  useLayoutEffect(() => {
    const at = pendingCaret.current;
    if (at === null) return;
    pendingCaret.current = null;
    const el = editorEl();
    if (!el) return;
    el.setSelectionRange(at, at);
    // A value set from code doesn't scroll the input to its caret; at the end, scroll there (the
    // coloured mirror follows on the scroll event).
    if (at === el.value.length) el.scrollLeft = el.scrollWidth;
  });

  useEffect(() => {
    const up = () => {
      dragging.current = false;
      draggingRange.current = null;
      if (touchHold.current) clearTimeout(touchHold.current);
      touchHold.current = null;
    };
    window.addEventListener("mouseup", up);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  // When the grid is wider than its box (long text on a phone), keep the active cell in view.
  // Only the grid's own scroller moves: scrollIntoView could scroll the page too.
  useEffect(() => {
    const sc = scrollEl.current;
    const cell = sc && document.getElementById(`${idBase}-${addressOf(shownActive)}`);
    if (!sc || !cell || sc.scrollWidth <= sc.clientWidth) return;
    const box = sc.getBoundingClientRect(),
      c = cell.getBoundingClientRect();
    const rowhead =
      gridEl.current?.querySelector(".eg-rowhead")?.getBoundingClientRect().width ?? 0;
    if (c.left < box.left + rowhead) sc.scrollLeft -= box.left + rowhead - c.left;
    else if (c.right > box.right) sc.scrollLeft += c.right - box.right;
  }, [shownActive.row, shownActive.col, idBase]);

  const addr = addressOf(shownActive);
  const target = targetCell ? parseRef(targetCell) : null;
  const highlights = (highlightCells ?? []).map(parseRef).filter((r): r is Rect => r !== null);
  const yellows = (yellowCells ?? []).map(parseRef).filter((r): r is Rect => r !== null);
  const flashes = (flashCells ?? []).map(parseRef).filter((r): r is Rect => r !== null);
  const hlCols = new Set((highlightHeaders?.cols ?? []).map((c) => c.toUpperCase()));
  const hlRows = new Set(highlightHeaders?.rows ?? []);
  const formatRects = displayOnly
    ? Object.entries(format ?? {})
        .map(([ref, styles]) => ({ rect: parseRef(ref), styles }))
        .filter((x): x is { rect: Rect; styles: string[] } => x.rect !== null)
    : [];

  /** The formula, or the literal, the active cell holds. A spilled cell holds nothing of its own. */
  const contentOf = (a: string) =>
    spills.has(a) ? "" : (sheet.getFormula(a) ?? rawInput(sheet.get(a)));

  /** `entering`: the edit began by typing (Excel's Enter mode), so arrows may point; F2 and the like don't. */
  const startEdit = (draft: string, where: Editing["from"], entering = false) => {
    if (selectMode) return;
    setError(null);
    setEditing({ draft, from: where, entering });
    onEditStart?.();
  };

  /** A click in an editor or a caret-only move: arrows move the caret from now on (Excel's Edit mode). */
  const leaveEnterMode = () => {
    const ed = editingRef.current;
    if (ed?.entering) setEditing({ ...ed, entering: false });
  };

  /**
   * Point mode at the editor's caret: the reference it last inserted (if the caret sits right after
   * it), whether it may point at all (that, or right after "=", "(", "," or an operator), and the caret.
   */
  const pointState = (ed: Editing, el: HTMLInputElement | null) => {
    const caret =
      el && el.selectionStart !== null && el.selectionStart === el.selectionEnd
        ? el.selectionStart
        : null;
    if (caret === null) return null;
    const last = ed.point && ed.point.end === caret ? ed.point : null;
    return last || canPoint(ed.draft, caret) ? { last, caret } : null;
  };

  /** Insert (or replace the last pointed) reference to anchor…cursor and keep the caret after it. */
  const pointTo = (ed: Editing, last: Point | null, caret: number, anchor: Pos, cursor: Pos) => {
    const ins = insertRef(ed.draft, last, caret, rangeRef(anchor, cursor));
    pendingCaret.current = ins.end;
    setEditing({
      draft: ins.draft,
      from: ed.from,
      entering: true,
      point: { start: ins.start, end: ins.end, anchor, cursor },
    });
  };

  const cancel = () => {
    setEditing(null);
    setError(null);
    gridEl.current?.focus();
  };

  /** Writes `input` to the active cell. Returns the tokenize/parse message on failure (old value kept). */
  const write = (input: string): string | null => {
    try {
      applySheetInput(sheet, literals, addr, input);
    } catch (e) {
      if (e instanceof TokenizeError || e instanceof ParseError) {
        setError(e.message);
        return e.message;
      }
      throw e;
    }
    const nextHistory = pushEdit(historyRef.current, { addr, pos: active, input });
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    setError(null);
    rerender();
    onCommit?.(addr, input);
    return null;
  };

  const applyHistory = (nextHistory: EditHistory, focusPos?: Pos) => {
    const nextLoaded = rebuildLoaded(grid, nextHistory.past, today);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    setLoaded(nextLoaded);
    if (sheetRef) sheetRef.current = nextLoaded.sheet;
    if (focusPos) setActive(focusPos);
    setSelection(null);
    setError(null);
    onHistoryChange?.(nextHistory.past);
    gridEl.current?.focus({ preventScroll: true });
  };

  const undo = () => {
    const { history: nextHistory, undone } = undoEdit(historyRef.current);
    if (!undone) return;
    applyHistory(nextHistory, undone.pos);
  };

  const redo = () => {
    const { history: nextHistory, redone } = redoEdit(historyRef.current);
    if (!redone) return;
    applyHistory(nextHistory, redone.pos);
  };

  const reset = () => {
    editingRef.current = null;
    setEditingState(null);
    applyHistory(EMPTY_HISTORY, initialActive(activeCell));
  };

  const handleUndoClick = () => {
    const ed = editingRef.current;
    if (ed) {
      const hasDraftChange = editOutcome(ed.draft, contentOf(addr)) === "commit";
      cancel();
      if (hasDraftChange) {
        onHistoryChange?.(historyRef.current.past);
        return;
      }
    }
    undo();
  };

  const handleRedoClick = () => {
    if (editingRef.current) {
      editingRef.current = null;
      setEditingState(null);
    }
    redo();
  };

  /**
   * Commit the draft, then optionally step to a neighbour (an arrow key name: Enter ↓, Tab →).
   * On a parse error the editor stays open with the message and this returns false.
   */
  const commit = (step?: string | Pos, focusGrid = true): boolean => {
    const ed = editingRef.current;
    if (!ed) return true;
    if (editOutcome(ed.draft, contentOf(addr)) === "close") {
      setError(null);
      onCommit?.(addr, ed.draft);
    } else if (write(ed.draft) !== null) return false;
    setEditing(null); // before focusing the grid, so the editor's blur finds nothing to commit
    if (typeof step === "string") setActive((p) => move(p, step, size));
    else if (step) setActive(step);
    if (focusGrid) gridEl.current?.focus();
    return true;
  };

  /**
   * Focus left the editors (not to the other editor or a formula-bar button): commit in place.
   * If the draft doesn't parse, drop it and say so, so `editing` is never left set with focus elsewhere.
   */
  const onEditorBlur = (e: FocusEvent<HTMLInputElement>) => {
    const ed = editingRef.current;
    if (!ed) return;
    // Switching windows or tabs: keep the edit open; focus comes back to this input on return.
    if (!document.hasFocus()) return;
    const next = e.relatedTarget;
    const fbar = sheetEl.current?.querySelector(".eg-fbar");
    if (next instanceof Node && (next === cellInput.current || fbar?.contains(next))) return;
    const message = editOutcome(ed.draft, contentOf(addr)) === "close" ? null : write(ed.draft);
    setEditing(null);
    setError(message === null ? null : `${message}. Not saved: ${addr} kept its old value.`);
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== gridEl.current || editingRef.current) return; // keys inside the editors are handled there
    const { key } = e;
    if (selectMode) {
      if (key === " " && (e.ctrlKey || e.shiftKey)) {
        e.preventDefault();
        const whole = e.ctrlKey ? "column" : "row";
        const anchor = active;
        setSelection({ anchor, cursor: active, whole });
        onSelectionChange?.(selectionRef(anchor, active, whole));
      } else if (key in DELTAS) {
        e.preventDefault();
        const cursor = move(active, key, size);
        const anchor = e.shiftKey ? (selection?.anchor ?? active) : cursor;
        setActive(cursor);
        setSelection({ anchor, cursor });
        onSelectionChange?.(selectionRef(anchor, cursor));
      }
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && !e.altKey && key.toLowerCase() === "y" && !e.shiftKey) {
      e.preventDefault();
      redo();
      return;
    }
    if (isAutoSumKey(e)) {
      e.preventDefault();
      tabStartCol.current = null;
      setSelection(null);
      startEdit(autoSumFormula(sheet, active), "cell");
      return;
    }
    if (key in DELTAS) {
      e.preventDefault();
      tabStartCol.current = null;
      if (e.shiftKey) {
        const anchor = selection?.anchor ?? active;
        const cursor = move(selection?.cursor ?? active, key, size);
        setSelection({ anchor, cursor });
      } else {
        setActive((p) => move(p, key, size));
        setSelection(null);
      }
    } else if (key === " " && (e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      const whole = e.ctrlKey ? "column" : "row";
      setSelection({ anchor: active, cursor: active, whole });
    } else if (key === "Enter") {
      e.preventDefault();
      setActive(enterStep(active, tabStartCol.current, e.shiftKey, size));
      tabStartCol.current = null;
      setSelection(null);
    } else if (key === "Tab") {
      const next = tabStep(active, e.shiftKey, size);
      if (!next) return; // at the edge: let the browser move focus out of the grid
      e.preventDefault();
      tabStartCol.current ??= active.col;
      setActive(next);
      setSelection(null);
    } else if (key === "Delete") {
      e.preventDefault();
      if (contentOf(addr) !== "") write("");
    } else if (key === "Backspace") {
      e.preventDefault();
      startEdit("", "cell", true);
    } else if (key === "F2") {
      e.preventDefault();
      startEdit(contentOf(addr), "cell");
    } else if (isTypingKey(e)) {
      e.preventDefault();
      startEdit(key, "cell", true);
    }
  };

  /** Shared by the in-cell editor and the formula bar: Enter/Tab commit and step, Escape cancels. */
  const onEditorKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (commit(enterStep(active, tabStartCol.current, e.shiftKey, size)))
        tabStartCol.current = null;
    } else if (e.key === "Tab") {
      const ed = editingRef.current;
      if (!ed || editOutcome(ed.draft, contentOf(addr)) === "close") {
        // Nothing typed: close without writing. From the formula bar, let the browser move focus
        // (to fx, the grid, or out). From the in-cell editor (which unmounts), act like Tab on the grid.
        setEditing(null);
        setError(null);
        if (ed?.from === "cell") {
          gridEl.current?.focus();
          const next = tabStep(active, e.shiftKey, size);
          if (next) {
            e.preventDefault();
            tabStartCol.current ??= active.col;
            setActive(next);
          } // at the edge, the default Tab now leaves the grid
        }
        return;
      }
      e.preventDefault(); // on a parse error the editor keeps focus and shows the message
      const start = active.col;
      if (commit(e.shiftKey ? "ArrowLeft" : "ArrowRight")) tabStartCol.current ??= start;
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.nativeEvent.isComposing) {
      // An IME is composing: its arrows and spaces belong to it.
    } else if (e.key in DELTAS) {
      // Enter mode: the arrow moves a reference on the grid instead of the caret.
      const ed = editingRef.current;
      const el = e.currentTarget;
      const caret =
        el.selectionStart !== null && el.selectionStart === el.selectionEnd
          ? el.selectionStart
          : null;
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      if (
        !ed ||
        caret === null ||
        !plain ||
        !arrowPoints(ed.draft, caret, !!ed.entering, ed.point ?? null)
      ) {
        leaveEnterMode(); // the arrow moves the caret, so further arrows keep doing so
        return;
      }
      e.preventDefault();
      const last = ed.point && ed.point.end === caret ? ed.point : null;
      const cursor = move(last?.cursor ?? active, e.key, size);
      const anchor = e.shiftKey ? (last?.anchor ?? active) : cursor;
      pointTo(ed, last, caret, anchor, cursor);
    } else if (e.key === "Home" || e.key === "End") {
      leaveEnterMode();
    } else if (e.key === " ") {
      // Space right after a column letter typed in point mode: B:B.
      const ed = editingRef.current;
      const el = e.currentTarget;
      if (!ed || el.selectionStart === null || el.selectionStart !== el.selectionEnd) return;
      const line = wholeLineRef(ed.draft, el.selectionStart, size);
      if (!line) return;
      e.preventDefault();
      pendingCaret.current = line.end;
      setEditing({ draft: line.draft, from: ed.from, entering: true });
    }
  };

  const onCellMouseDown = (e: MouseEvent<HTMLDivElement>, pos: Pos) => {
    if (selectMode) return;
    const same = pos.row === active.row && pos.col === active.col;
    const ed = editingRef.current;
    if (ed) {
      if (same && ed.from === "cell") return; // clicking inside the open editor
      const pt = pointState(ed, editorEl());
      if (pt) {
        // Point mode: the click names this cell in the formula (Shift extends the last one into a
        // range), and the editor keeps focus and stays open. Dragging on extends it (onCellEnter).
        e.preventDefault();
        pointTo(ed, pt.last, pt.caret, e.shiftKey && pt.last ? pt.last.anchor : pos, pos);
        dragging.current = e.button === 0;
        return;
      }
      if (!commit()) {
        e.preventDefault(); // keep the editor open and focused so the error can be fixed
        return;
      }
    }
    tabStartCol.current = null; // a click (not a point-mode click) ends the Tab run
    if (e.shiftKey) {
      const anchor = selection?.anchor ?? active;
      setSelection({ anchor, cursor: pos });
      draggingRange.current = e.button === 0 ? anchor : null;
    } else {
      setActive(pos);
      setSelection(null);
      draggingRange.current = e.button === 0 ? pos : null;
    }
    // On touch there is no keyboard to type with: a second tap on the active cell edits it.
    if (same && !editing && !e.shiftKey && lastPointer.current === "touch") {
      e.preventDefault();
      startEdit(contentOf(addressOf(pos)), "cell");
    }
  };

  /** Dragging in point mode or range-select mode extends the range from where the button went down. */
  const onCellEnter = (e: MouseEvent<HTMLDivElement>, pos: Pos) => {
    if (!(e.buttons & 1)) return;
    const ed = editingRef.current;
    if (dragging.current && ed?.point) {
      const { point } = ed;
      if (point.cursor.row === pos.row && point.cursor.col === pos.col) return;
      pointTo(ed, point, point.end, point.anchor, pos);
      return;
    }
    if (draggingRange.current) {
      const anchor = draggingRange.current;
      if (anchor.row === pos.row && anchor.col === pos.col) {
        setSelection(null);
      } else {
        setSelection({ anchor, cursor: pos });
      }
    }
  };

  const onFx = () => {
    if (editing) {
      if (editing.draft === "") setEditing({ ...editing, draft: "=" });
      barInput.current?.focus();
      return;
    }
    const formula = sheet.getFormula(addr);
    startEdit(formula ?? "=", "bar", formula === null); // a fresh "=" is entering; an existing formula is editing
  };

  // A spilled cell shows its anchor's formula, greyed (as Excel does): it can't be edited there.
  const spillAnchor = spills.get(addr);
  const hasPreviewDraft = displayOnly && previewDraft !== undefined && inspected === null;
  const previewTarget = previewCell ?? addr;
  const hasRangeSelection =
    selection !== null &&
    (Boolean(selection.whole) ||
      selection.anchor.row !== selection.cursor.row ||
      selection.anchor.col !== selection.cursor.col);
  const nameBoxAddress = hasPreviewDraft
    ? previewTarget
    : selection && (selectMode || hasRangeSelection)
      ? selectionRef(selection.anchor, selection.cursor, selection.whole)
      : addr;
  const barValue = editing
    ? editing.draft
    : hasPreviewDraft
      ? previewDraft
      : spillAnchor
        ? (sheet.getFormula(spillAnchor) ?? "")
        : contentOf(addr);
  /** The anchor of the spill the active cell is part of, so that spill gets an outline. */
  const activeSpill = spillAnchor ?? (anchors.has(addr) ? addr : null);
  const cellId = (p: Pos) => `${idBase}-${addressOf(p)}`;

  // The formula being edited (or shown in a displayOnly cell/preview with Formula Bar):
  // each reference coloured in the formula bar/editor and outlined on the grid.
  const activeFormulaText =
    editing !== null && editing.draft.startsWith("=")
      ? editing.draft
      : displayOnly && showFormulaBar && barValue.startsWith("=")
        ? barValue
        : null;
  const refSpans = activeFormulaText !== null ? findRefs(activeFormulaText) : [];
  const colours = refColours(refSpans);
  const coloured: ColouredRef[] | null =
    activeFormulaText !== null
      ? refSpans.map((r, i) => ({ start: r.start, end: r.end, colour: colours[i]! }))
      : null;
  const outlines = refSpans.flatMap((r, i) => {
    const rect = parseRef(r.text.replace(/\s/g, ""));
    const area = rect && refArea(rect, size);
    return area ? [{ area, colour: colours[i]!, key: `${i}-${r.text}` }] : [];
  });
  const selectedRect =
    displayOnly && selectionProp && inspected === null
      ? parseRef(selectionProp)
      : selection
        ? parseRef(selectionRef(selection.anchor, selection.cursor, selection.whole))
        : null;
  const multiSelectionArea =
    selectedRect && (selectedRect.r1 !== selectedRect.r2 || selectedRect.c1 !== selectedRect.c2)
      ? refArea(selectedRect, size)
      : null;

  const modeLabel = editing
    ? editing.point
      ? "Point"
      : editing.entering
        ? "Enter"
        : "Edit"
    : selectMode
      ? "Select"
      : "Ready";

  const showSheetActions = !displayOnly && !selectMode;
  const hasUnsavedDraft =
    editing !== null && editOutcome(editing.draft, contentOf(addr)) === "commit";
  const canUndo = history.past.length > 0 || hasUnsavedDraft;
  const canRedo = history.future.length > 0;
  const canReset = history.past.length > 0 || hasUnsavedDraft;

  const cols = Array.from({ length: size.cols }, (_, c) => c);
  const rows = Array.from({ length: size.rows }, (_, r) => r);

  return (
    <div
      className={`eg-sheet${spillAnchor && !editing ? " is-spill-ref" : ""}${selectMode ? " is-select-mode" : ""}`}
      ref={sheetEl}
    >
      {showFormulaBar && (
        <FormulaBar
          address={nameBoxAddress}
          value={barValue}
          editing={editing !== null}
          error={error}
          inputRef={barInput}
          refs={coloured}
          readOnly={displayOnly || selectMode}
          previewCaret={hasPreviewDraft && previewCaret}
          onStartEdit={() => startEdit(contentOf(addr), "bar")}
          onChange={(draft) =>
            setEditing({ draft, from: editingRef.current?.from ?? "bar", entering: true })
          }
          onKeyDown={onEditorKeyDown}
          onBlur={onEditorBlur}
          onCaretPlace={leaveEnterMode}
          onConfirm={() => commit()}
          onCancel={cancel}
          onFx={onFx}
        />
      )}
      {/* If the lesson's text needs more width than a phone has, the grid scrolls here, never the page. */}
      <div className="eg-scroll" ref={scrollEl}>
        <div
          ref={gridEl}
          className={`eg-grid${selectMode ? " is-select-mode" : ""}${multiSelectionArea ? " has-range" : ""}`}
          role="grid"
          aria-label="Spreadsheet"
          aria-rowcount={size.rows + 1}
          aria-colcount={size.cols + 1}
          aria-activedescendant={displayOnly ? undefined : cellId(active)}
          tabIndex={displayOnly ? undefined : 0}
          aria-readonly={displayOnly || undefined}
          style={{ gridTemplateColumns: columns }}
          onKeyDown={displayOnly ? undefined : onGridKeyDown}
          onClick={displayOnly ? onDisplayClick : undefined}
          onMouseDown={displayOnly ? (e) => e.preventDefault() : undefined}
          onPointerDown={(e) => {
            lastPointer.current = e.pointerType;
            if (displayOnly) {
              e.preventDefault();
              return;
            }
            if (!selectMode) return;
            const el = e.target instanceof HTMLElement ? e.target : null;
            const cell = el?.closest<HTMLElement>("[role=gridcell]");
            const col = el?.closest<HTMLElement>("[role=columnheader]");
            const row = el?.closest<HTMLElement>("[role=rowheader]");
            let pos: Pos | null = null,
              whole: "row" | "column" | undefined;
            if (cell) {
              const m = /-([A-Z]{1,3})([1-9]\d*)$/.exec(cell.id);
              if (m) pos = { row: Number(m[2]) - 1, col: colIndex(m[1]!) };
            } else if (col) {
              const c = colIndex(col.textContent?.trim() ?? "A");
              pos = { row: active.row, col: c };
              whole = "column";
            } else if (row) {
              const r = Number(row.textContent?.trim() ?? "1") - 1;
              pos = { row: r, col: active.col };
              whole = "row";
            }
            if (!pos) return;
            gridEl.current?.focus({ preventScroll: true });
            const anchor = e.shiftKey ? (selection?.anchor ?? active) : pos;
            const cursor = pos;
            setActive(cursor);
            setSelection({ anchor, cursor, whole });
            onSelectionChange?.(selectionRef(anchor, cursor, whole));
            if (e.pointerType === "touch") {
              const target = e.currentTarget,
                pointerId = e.pointerId;
              touchHold.current = setTimeout(() => {
                if (target.isConnected) {
                  target.setPointerCapture(pointerId);
                  (gridEl.current as HTMLDivElement & { selectAnchor?: Pos }).selectAnchor = anchor;
                }
              }, 300);
            } else if (e.button === 0) {
              e.currentTarget.setPointerCapture(e.pointerId);
              (gridEl.current as HTMLDivElement & { selectAnchor?: Pos }).selectAnchor = anchor;
            }
          }}
          onPointerMove={(e) => {
            if (!selectMode || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
            const el = document
              .elementFromPoint(e.clientX, e.clientY)
              ?.closest<HTMLElement>("[role=gridcell]");
            const m = el && /-([A-Z]{1,3})([1-9]\d*)$/.exec(el.id);
            if (!m) return;
            const cursor = { row: Number(m[2]) - 1, col: colIndex(m[1]!) };
            const anchor =
              (gridEl.current as (HTMLDivElement & { selectAnchor?: Pos }) | null)?.selectAnchor ??
              active;
            setActive(cursor);
            setSelection({ anchor, cursor });
            onSelectionChange?.(selectionRef(anchor, cursor));
          }}
        >
          <div className="eg-row" role="row">
            <div className="eg-corner" aria-hidden="true" />
            {cols.map((c) => {
              const letter = colLetter(c);
              const colInRange =
                selectedRect !== null && c >= selectedRect.c1 && c <= selectedRect.c2;
              return (
                <div
                  key={c}
                  role="columnheader"
                  className={`eg-head${c === headActive.col || colInRange ? " is-on" : ""}${hlCols.has(letter) ? " is-hl-head" : ""}`}
                  onMouseDown={(e) => {
                    if (selectMode) return;
                    const ed = editingRef.current;
                    if (ed) {
                      const pt = pointState(ed, editorEl());
                      if (pt) {
                        e.preventDefault();
                        const text =
                          e.shiftKey && pt.last
                            ? `${colLetter(Math.min(pt.last.anchor.col, c))}:${colLetter(Math.max(pt.last.anchor.col, c))}`
                            : `${letter}:${letter}`;
                        const ins = insertRef(ed.draft, pt.last, pt.caret, text);
                        pendingCaret.current = ins.end;
                        setEditing({
                          draft: ins.draft,
                          from: ed.from,
                          entering: true,
                          point: {
                            start: ins.start,
                            end: ins.end,
                            anchor: { row: 0, col: e.shiftKey && pt.last ? pt.last.anchor.col : c },
                            cursor: { row: size.rows - 1, col: c },
                          },
                        });
                        return;
                      }
                      if (!commit()) {
                        e.preventDefault();
                        return;
                      }
                    }
                    const pos = { row: headActive.row, col: c };
                    const anchor =
                      e.shiftKey && selection?.whole === "column" ? selection.anchor : pos;
                    if (displayOnly) {
                      e.preventDefault();
                      setInspected(pos);
                      onDisplayClick?.();
                    } else {
                      setActive(pos);
                    }
                    tabStartCol.current = null;
                    setSelection({ anchor, cursor: pos, whole: "column" });
                  }}
                >
                  {letter}
                </div>
              );
            })}
          </div>
          {rows.map((r) => (
            <div key={r} className="eg-row" role="row">
              <div
                role="rowheader"
                className={`eg-head eg-rowhead${r === headActive.row || (selectedRect !== null && r >= selectedRect.r1 && r <= selectedRect.r2) ? " is-on" : ""}${hlRows.has(r + 1) ? " is-hl-head" : ""}`}
                onMouseDown={(e) => {
                  if (selectMode) return;
                  const ed = editingRef.current;
                  if (ed) {
                    const pt = pointState(ed, editorEl());
                    if (pt) {
                      e.preventDefault();
                      const text =
                        e.shiftKey && pt.last
                          ? `${Math.min(pt.last.anchor.row, r) + 1}:${Math.max(pt.last.anchor.row, r) + 1}`
                          : `${r + 1}:${r + 1}`;
                      const ins = insertRef(ed.draft, pt.last, pt.caret, text);
                      pendingCaret.current = ins.end;
                      setEditing({
                        draft: ins.draft,
                        from: ed.from,
                        entering: true,
                        point: {
                          start: ins.start,
                          end: ins.end,
                          anchor: { row: e.shiftKey && pt.last ? pt.last.anchor.row : r, col: 0 },
                          cursor: { row: r, col: size.cols - 1 },
                        },
                      });
                      return;
                    }
                    if (!commit()) {
                      e.preventDefault();
                      return;
                    }
                  }
                  const pos = { row: r, col: headActive.col };
                  const anchor = e.shiftKey && selection?.whole === "row" ? selection.anchor : pos;
                  if (displayOnly) {
                    e.preventDefault();
                    setInspected(pos);
                    onDisplayClick?.();
                  } else {
                    setActive(pos);
                  }
                  tabStartCol.current = null;
                  setSelection({ anchor, cursor: pos, whole: "row" });
                }}
              >
                {r + 1}
              </div>
              {cols.map((c) => {
                const pos = { row: r, col: c };
                const a = addressOf(pos);
                const isActive = r === shownActive.row && c === shownActive.col;
                const value = sheet.get(a);
                const cls = ["eg-cell"];
                if (typeof value === "number") cls.push("is-num");
                else if (typeof value === "boolean" || isErr(value)) cls.push("is-center");
                const spillOf = spills.get(a) ?? (anchors.has(a) ? a : null);
                if (spillOf) {
                  cls.push("is-spill");
                  if (spillOf === activeSpill) {
                    // Outline the selected spill's edges: sides whose neighbour isn't in the same spill.
                    const same = (row: number, col: number) => {
                      const n = addressOf({ row, col });
                      return n === spillOf || spills.get(n) === spillOf;
                    };
                    if (!same(r - 1, c)) cls.push("spill-t");
                    if (!same(r + 1, c)) cls.push("spill-b");
                    if (!same(r, c - 1)) cls.push("spill-l");
                    if (!same(r, c + 1)) cls.push("spill-r");
                  }
                }
                if (highlights.length && inRects(highlights, r, c)) cls.push("is-hl");
                if (yellows.length && inRects(yellows, r, c)) cls.push("is-yellow");
                const isFlashing = flashes.length > 0 && inRects(flashes, r, c);
                if (isFlashing) cls.push("is-flash");
                if (target && inRects([target], r, c)) cls.push("is-target");
                if (isActive) cls.push("is-active");
                const isSelected = selectedRect ? inRects([selectedRect], r, c) : isActive;
                if (
                  isSelected &&
                  (selectMode || (displayOnly && !isActive) || (selectedRect && !isActive))
                ) {
                  cls.push("is-selection");
                }
                const cellStyles = formatRects
                  .filter(({ rect }) => inRects([rect], r, c))
                  .flatMap(({ styles }) => styles);
                const cellStyle: React.CSSProperties = {};
                if (cellStyles.includes("bold")) cellStyle.fontWeight = 700;
                if (cellStyles.includes("italic")) cellStyle.fontStyle = "italic";
                if (cellStyles.includes("center")) cellStyle.textAlign = "center";
                const decorations = [
                  cellStyles.includes("underline") ? "underline" : "",
                  cellStyles.includes("strikethrough") ? "line-through" : "",
                ].filter(Boolean);
                if (decorations.length) cellStyle.textDecoration = decorations.join(" ");
                if (cellStyles.includes("border")) cellStyle.border = "1px solid var(--border)";
                return (
                  <div
                    key={isFlashing && flashKey !== undefined ? `${c}-${flashKey}` : c}
                    id={cellId(pos)}
                    role="gridcell"
                    aria-selected={selectMode || displayOnly ? isSelected : isActive}
                    className={cls.join(" ")}
                    style={cellStyle}
                    title={spills.has(a) ? `Spilled from ${spills.get(a)}` : undefined}
                    onPointerDown={displayOnly ? (e) => e.preventDefault() : undefined}
                    onMouseDown={(e) => {
                      if (displayOnly) {
                        e.preventDefault();
                        if (e.shiftKey) {
                          const anchor = selection?.anchor ?? shownActive;
                          setSelection({ anchor, cursor: pos });
                          draggingRange.current = e.button === 0 ? anchor : null;
                        } else {
                          setInspected(pos);
                          setSelection(null);
                          draggingRange.current = e.button === 0 ? pos : null;
                        }
                        onInspectCell?.(a);
                        onDisplayClick?.();
                      } else onCellMouseDown(e, pos);
                    }}
                    onMouseEnter={(e) => onCellEnter(e, pos)}
                    onDoubleClick={() => {
                      if (!displayOnly && !selectMode && !editing) startEdit(contentOf(a), "cell");
                    }}
                  >
                    {isActive && editing?.from === "cell" ? (
                      <>
                        <input
                          ref={cellInput}
                          className={`eg-cell-input${coloured ? " has-mirror" : ""}`}
                          aria-label={`Edit ${a}`}
                          value={editing.draft}
                          spellCheck={false}
                          autoComplete="off"
                          autoCapitalize="off"
                          autoCorrect="off"
                          onChange={(e) =>
                            setEditing({ draft: e.target.value, from: "cell", entering: true })
                          }
                          onKeyDown={onEditorKeyDown}
                          onBlur={onEditorBlur}
                          onMouseUp={leaveEnterMode}
                        />
                        {coloured && (
                          <RefMirror
                            text={editing.draft}
                            refs={coloured}
                            inputRef={cellInput}
                            className="eg-cell-mirror"
                          />
                        )}
                      </>
                    ) : (
                      <span
                        className="eg-val"
                        style={cellStyles.includes("center") ? { textAlign: "center" } : undefined}
                      >
                        {hasPreviewDraft && previewInCell && a === previewTarget ? (
                          coloured ? (
                            <RefText text={previewDraft} refs={coloured} caret={previewCaret} />
                          ) : (
                            <>
                              {previewDraft}
                              {previewCaret && <i className="eg-caret" aria-hidden="true" />}
                            </>
                          )
                        ) : isActive && editing ? (
                          coloured ? (
                            <RefText text={editing.draft} refs={coloured} />
                          ) : (
                            editing.draft
                          )
                        ) : (
                          formatValue(value, loaded.sheet.isDate(a))
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {/* Continuous green outline around a multi-cell selection range (Excel-style). */}
          {multiSelectionArea && (
            <div className="eg-selbox" style={multiSelectionArea} aria-hidden="true" />
          )}
          {/* Absolutely placed by grid lines, so they overlay the cells without taking part in the layout. */}
          {outlines.map(({ area, colour, key }) => (
            <div
              key={key}
              className={`eg-refbox eg-ref-${colour}`}
              style={area}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      {(showSheetActions || sheetBarRight || (editing && modeLabel !== "Ready")) && (
        <div className="eg-sheetbar">
          <span className="eg-sheet-tab">Sheet1</span>
          <span className="eg-sheet-status">
            {showSheetActions && (
              <span className="eg-sheet-actions" role="group" aria-label="Sheet actions">
                <button
                  type="button"
                  className="eg-sheet-btn"
                  aria-label="Undo"
                  title="Undo (Ctrl+Z)"
                  disabled={disableSheetActions || !canUndo}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleUndoClick}
                >
                  <Icon name="undo" size={13} />
                  Undo
                </button>
                <button
                  type="button"
                  className="eg-sheet-btn"
                  aria-label="Redo"
                  title="Redo (Ctrl+Y)"
                  disabled={disableSheetActions || !canRedo}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleRedoClick}
                >
                  <Icon name="redo" size={13} />
                  Redo
                </button>
                <button
                  type="button"
                  className="eg-sheet-btn"
                  aria-label="Reset sheet"
                  title="Reset sheet"
                  disabled={disableSheetActions || !canReset}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={reset}
                >
                  <Icon name="rotateCcw" size={13} />
                  Reset
                </button>
              </span>
            )}
            {sheetBarRight}
            {editing && <span>{modeLabel}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

export default Grid;
