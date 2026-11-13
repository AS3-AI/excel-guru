"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { ParseError, Sheet, TokenizeError, type CellValue, type ExcelError } from "@excel-guru/engine";
import { FormulaBar } from "./FormulaBar";
import "./grid.css";

/** A starting cell: a literal, or a string starting with "=" for a formula (as Sheet takes it). */
export type GridLiteral = string | number | boolean | null;
export type Pos = { row: number; col: number };
/** 0-based inclusive rectangle; whole columns/rows run to Infinity. */
export type Rect = { r1: number; c1: number; r2: number; c2: number };

export type GridProps = {
  /** grid[0][0] is A1. Read once on mount: remount (e.g. with a `key`) to load another grid. */
  grid: GridLiteral[][];
  /** The cell the learner should answer in, e.g. "C2". */
  targetCell?: string;
  /** Cells or ranges to tint, e.g. ["B2:B6"]. */
  highlightCells?: string[];
  /** Called after each successful Sheet.set, with the address and the text as typed ("" when cleared). */
  onCommit?: (addr: string, input: string) => void;
  /** Receives the live Sheet so the caller can read or grade it. */
  sheetRef?: { current: Sheet | null };
};

const MIN_COLS = 7;
const MIN_ROWS = 8;

// ---------- pure helpers (unit-tested in Grid.test.ts) ----------

export function colLetter(col: number): string {
  let s = "";
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
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

  const ca = CELL_RE.exec(a), cb = CELL_RE.exec(b);
  if (ca && cb) {
    const r = [Number(ca[2]) - 1, Number(cb[2]) - 1], c = [colIndex(ca[1]!), colIndex(cb[1]!)];
    return { r1: Math.min(r[0]!, r[1]!), c1: Math.min(c[0]!, c[1]!), r2: Math.max(r[0]!, r[1]!), c2: Math.max(c[0]!, c[1]!) };
  }
  if (parts.length === 2) {
    const ka = COL_RE.exec(a), kb = COL_RE.exec(b);
    if (ka && kb) {
      const c = [colIndex(ka[1]!), colIndex(kb[1]!)];
      return { r1: 0, c1: Math.min(c[0]!, c[1]!), r2: Infinity, c2: Math.max(c[0]!, c[1]!) };
    }
    const ra = ROW_RE.exec(a), rb = ROW_RE.exec(b);
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
export function formatValue(v: CellValue): string {
  if (v === null) return "";
  if (isErr(v)) return v.error;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(10)));
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
export function isTypingKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey;
}

// ---------- component ----------

type Editing = { draft: string; from: "cell" | "bar" };

export function Grid({ grid, targetCell, highlightCells, onCommit, sheetRef }: GridProps) {
  const [sheet] = useState(() => new Sheet(grid));
  const [size] = useState(() => gridSize(grid));
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [active, setActive] = useState<Pos>({ row: 0, col: 0 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gridEl = useRef<HTMLDivElement>(null);
  const cellInput = useRef<HTMLInputElement>(null);
  const barInput = useRef<HTMLInputElement>(null);
  const lastPointer = useRef<string>("mouse");
  const idBase = useId();

  useEffect(() => {
    if (sheetRef) sheetRef.current = sheet;
  }, [sheet, sheetRef]);

  // Put the caret at the end of whichever editor just opened.
  const from = editing?.from;
  useLayoutEffect(() => {
    const el = from === "cell" ? cellInput.current : from === "bar" ? barInput.current : null;
    if (el && document.activeElement !== el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [from, active]);

  const addr = addressOf(active);
  const target = targetCell ? parseRef(targetCell) : null;
  const highlights = (highlightCells ?? []).map(parseRef).filter((r): r is Rect => r !== null);

  /** The formula, or the literal, the active cell holds. */
  const contentOf = useCallback((a: string) => sheet.getFormula(a) ?? rawInput(sheet.get(a)), [sheet]);

  const startEdit = (draft: string, where: Editing["from"]) => {
    setError(null);
    setEditing({ draft, from: where });
  };

  const cancel = () => {
    setEditing(null);
    setError(null);
    gridEl.current?.focus();
  };

  /** Writes `input` to the active cell. On a tokenize/parse error, shows it and keeps the old value. */
  const write = (input: string): boolean => {
    try {
      sheet.set(addr, input);
    } catch (e) {
      if (e instanceof TokenizeError || e instanceof ParseError) {
        setError(e.message);
        return false;
      }
      throw e;
    }
    setError(null);
    rerender();
    onCommit?.(addr, input);
    return true;
  };

  /** Commit the draft, then optionally step to a neighbour (Enter ↓, Tab →). */
  const commit = (step?: string): boolean => {
    if (!editing) return true;
    if (!write(editing.draft)) return false;
    setEditing(null);
    if (step) setActive((p) => move(p, step, size));
    gridEl.current?.focus();
    return true;
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== gridEl.current || editing) return; // keys inside the cell editor are handled there
    const { key } = e;
    if (key in DELTAS) {
      e.preventDefault();
      setActive((p) => move(p, key, size));
    } else if (key === "Enter" || key === "Tab") {
      e.preventDefault();
      const dir = key === "Enter" ? (e.shiftKey ? "ArrowUp" : "ArrowDown") : e.shiftKey ? "ArrowLeft" : "ArrowRight";
      setActive((p) => move(p, dir, size));
    } else if (key === "Delete") {
      e.preventDefault();
      write("");
    } else if (key === "Backspace") {
      e.preventDefault();
      startEdit("", "cell");
    } else if (key === "F2") {
      e.preventDefault();
      startEdit(contentOf(addr), "cell");
    } else if (isTypingKey(e)) {
      e.preventDefault();
      startEdit(key, "cell");
    }
  };

  const onCellKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(e.shiftKey ? "ArrowUp" : "ArrowDown");
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit(e.shiftKey ? "ArrowLeft" : "ArrowRight");
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const onCellMouseDown = (e: MouseEvent<HTMLDivElement>, pos: Pos) => {
    const same = pos.row === active.row && pos.col === active.col;
    if (editing) {
      if (same && editing.from === "cell") return; // clicking inside the open editor
      if (!commit()) {
        e.preventDefault(); // keep the editor open and focused so the error can be fixed
        return;
      }
    }
    setActive(pos);
    // On touch there is no keyboard to type with: a second tap on the active cell edits it.
    if (same && !editing && lastPointer.current === "touch") {
      e.preventDefault();
      startEdit(contentOf(addressOf(pos)), "cell");
    }
  };

  const onFx = () => {
    if (editing) {
      if (editing.draft === "") setEditing({ ...editing, draft: "=" });
      barInput.current?.focus();
      return;
    }
    startEdit(sheet.getFormula(addr) ?? "=", "bar");
  };

  const barValue = editing ? editing.draft : contentOf(addr);
  const cellId = (p: Pos) => `${idBase}-${addressOf(p)}`;

  const cols = Array.from({ length: size.cols }, (_, c) => c);
  const rows = Array.from({ length: size.rows }, (_, r) => r);

  return (
    <div className="eg-sheet">
      <FormulaBar
        address={addr}
        value={barValue}
        editing={editing !== null}
        error={error}
        inputRef={barInput}
        onStartEdit={() => startEdit(contentOf(addr), "bar")}
        onChange={(draft) => setEditing((ed) => ({ draft, from: ed?.from ?? "bar" }))}
        onCommit={(step) => commit(step ? "ArrowDown" : undefined)}
        onCancel={cancel}
        onFx={onFx}
      />
      <div
        ref={gridEl}
        className="eg-grid"
        role="grid"
        aria-label="Spreadsheet"
        aria-rowcount={size.rows + 1}
        aria-colcount={size.cols + 1}
        aria-activedescendant={cellId(active)}
        tabIndex={0}
        style={{ gridTemplateColumns: `var(--eg-rowhead) repeat(${size.cols}, minmax(0, 1fr))` }}
        onKeyDown={onGridKeyDown}
        onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
      >
        <div className="eg-row" role="row">
          <div className="eg-corner" aria-hidden="true" />
          {cols.map((c) => (
            <div key={c} role="columnheader" className={`eg-head${c === active.col ? " is-on" : ""}`}>
              {colLetter(c)}
            </div>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r} className="eg-row" role="row">
            <div role="rowheader" className={`eg-head eg-rowhead${r === active.row ? " is-on" : ""}`}>{r + 1}</div>
            {cols.map((c) => {
              const pos = { row: r, col: c };
              const a = addressOf(pos);
              const isActive = r === active.row && c === active.col;
              const value = sheet.get(a);
              const cls = ["eg-cell"];
              if (typeof value === "number") cls.push("is-num");
              else if (typeof value === "boolean" || isErr(value)) cls.push("is-center");
              if (highlights.length && inRects(highlights, r, c)) cls.push("is-hl");
              if (target && inRects([target], r, c)) cls.push("is-target");
              if (isActive) cls.push("is-active");
              return (
                <div
                  key={c}
                  id={cellId(pos)}
                  role="gridcell"
                  aria-selected={isActive}
                  className={cls.join(" ")}
                  onMouseDown={(e) => onCellMouseDown(e, pos)}
                  onDoubleClick={() => { if (!editing) startEdit(contentOf(a), "cell"); }}
                >
                  {isActive && editing?.from === "cell" ? (
                    <input
                      ref={cellInput}
                      className="eg-cell-input"
                      aria-label={`Edit ${a}`}
                      value={editing.draft}
                      spellCheck={false}
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      onChange={(e) => setEditing({ draft: e.target.value, from: "cell" })}
                      onKeyDown={onCellKeyDown}
                    />
                  ) : (
                    <span className="eg-val">{isActive && editing ? editing.draft : formatValue(value)}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Grid;
