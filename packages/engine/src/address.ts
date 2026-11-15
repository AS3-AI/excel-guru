/** 0-based position: grid[row][col], so A1 is { row: 0, col: 0 }. */
export type CellAddress = { row: number; col: number };

/** Inclusive, 0-based rectangle with top-left first. */
export type Area = { top: number; left: number; bottom: number; right: number };

export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384; // A..XFD

const CELL_RE = /^\$?([A-Z]{1,3})\$?(\d+)$/;
const COLUMN_RE = /^\$?([A-Z]{1,3})$/;
const ROW_RE = /^\$?(\d+)$/;

/** "A" → 0, "AA" → 26. Letters only; the caller checks the range. */
export function columnToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function indexToColumn(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

/** "$B$3" → { row: 2, col: 1 }. Null for malformed or off-sheet refs (A0, XFE1). */
export function parseAddress(ref: string): CellAddress | null {
  const m = CELL_RE.exec(ref.toUpperCase());
  if (!m) return null;
  const col = columnToIndex(m[1]!);
  const row = Number(m[2]) - 1;
  if (row < 0 || row >= MAX_ROWS || col >= MAX_COLS) return null;
  return { row, col };
}

export function formatAddress({ row, col }: CellAddress): string {
  return `${indexToColumn(col)}${row + 1}`;
}

/**
 * The area between two corners: two cells (A1:B3) or two whole columns (B:C), which
 * span every row — the evaluator clips them to the used rows. Null if a corner is off-sheet.
 */
export function parseArea(from: string, to: string): Area | null {
  const rowA = ROW_RE.exec(from);
  const rowB = ROW_RE.exec(to);
  if (rowA || rowB) {
    if (!rowA || !rowB) return null;
    const a = Number(rowA[1]) - 1, b = Number(rowB[1]) - 1;
    if (a < 0 || b < 0 || a >= MAX_ROWS || b >= MAX_ROWS) return null;
    return { top: Math.min(a, b), left: 0, bottom: Math.max(a, b), right: MAX_COLS - 1 };
  }
  const a = corner(from, 0);
  const b = corner(to, MAX_ROWS - 1);
  if (!a || !b) return null;
  return {
    top: Math.min(a.row, b.row),
    left: Math.min(a.col, b.col),
    bottom: Math.max(a.row, b.row),
    right: Math.max(a.col, b.col),
  };
}

function corner(ref: string, columnRow: number): CellAddress | null {
  const col = COLUMN_RE.exec(ref.toUpperCase());
  if (!col) return parseAddress(ref);
  const index = columnToIndex(col[1]!);
  return index < MAX_COLS ? { row: columnRow, col: index } : null;
}
