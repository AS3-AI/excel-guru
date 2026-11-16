import { tokenize } from "./tokenizer";
import { parse, type Ast } from "./parser";
import { formatAddress, MAX_COLS, MAX_ROWS, parseAddress, parseArea, type Area } from "./address";
import { evaluate, functionNames, type CellValue, type EvalContext } from "./evaluator";

type Literal = string | number | boolean | null;

type Cell = {
  value: CellValue;
  formula: string | null; // as typed, with its leading "="
  ast: Ast | null;
  refs: string[]; // single cells the formula reads, as "A1"
  areas: Area[]; // ranges the formula reads
  /**
   * For a formula whose last result was an array: the area it spills into (anchor included),
   * kept while the spill is blocked (#SPILL!) or caught in a cycle (#CIRC!), so the anchor is
   * recomputed when a blocker clears and its cycle stays visible. Null otherwise.
   */
  spill: Area | null;
};

/** A cell filled by another cell's spill: its value, and the anchor whose formula made it. */
type Spilled = { anchor: string; value: CellValue };

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export class Sheet {
  /** Cells that hold something of their own: a literal or a formula (spill anchors included). */
  private readonly cells = new Map<string, Cell>();
  /** Cells currently filled by a spill. A cell is never in both maps' visible view: `cells` wins. */
  private readonly spilled = new Map<string, Spilled>();
  /** Cell → formula cells that name it directly. Range readers live in `areaReaders`. */
  private readonly dependents = new Map<string, Set<string>>();
  /** Formula cell → the ranges it reads; checked by containment, since B:C has no fixed size. */
  private readonly areaReaders = new Map<string, Area[]>();
  /** During one recalc: anchors whose spills never settled, shown as #CIRC! (see recalc). */
  private readonly stuck = new Set<string>();

  private readonly todaySerial: number;
  private readonly ctx: EvalContext;

  private makeContext(): EvalContext { return {
    today: this.todaySerial,
    cell: (row, col) => this.valueAt(formatAddress({ row, col })),
    usedRows: () => {
      let rows = 0;
      for (const key of this.cells.keys()) rows = Math.max(rows, parseAddress(key)!.row + 1);
      for (const key of this.spilled.keys()) rows = Math.max(rows, parseAddress(key)!.row + 1);
      return rows;
    },
    usedCols: () => {
      let cols = 0;
      for (const key of this.cells.keys()) cols = Math.max(cols, parseAddress(key)!.col + 1);
      for (const key of this.spilled.keys()) cols = Math.max(cols, parseAddress(key)!.col + 1);
      return cols;
    },
  }; }

  /** grid[0][0] is A1. Values are literal, except strings starting with "=", which are formulas. */
  constructor(grid: Literal[][], options: { today?: string } = {}) {
    const today = options.today ?? new Date().toISOString().slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
    if (!match) throw new RangeError("today must be an ISO date");
    this.todaySerial = (Date.UTC(+match[1]!, +match[2]! - 1, +match[3]!) - Date.UTC(1899, 11, 30)) / 86400000;
    this.ctx = this.makeContext();
    const formulas: [string, string][] = [];
    grid.forEach((row, r) =>
      row.forEach((v, c) => {
        const key = formatAddress({ row: r, col: c });
        if (typeof v === "string" && v.startsWith("=")) formulas.push([key, v]);
        else if (v !== null) this.cells.set(key, literalCell(v));
      }),
    );
    for (const [key, formula] of formulas) this.set(key, formula);
  }


  /**
   * "=SUM(A1:A3)" stores a formula, anything else a literal ("42" → 42, "TRUE" → true,
   * "" → empty). A formula that fails to tokenize or parse throws its TokenizeError or
   * ParseError and leaves the cell as it was. Typing into a spilled cell makes it a normal
   * cell, which blocks the spill (#SPILL! at its anchor); clearing it lets the spill back.
   */
  set(addr: string, input: string): void {
    const key = keyOf(addr);
    const ast = input.startsWith("=") ? parse(tokenize(input)) : null;

    // If `key` was an anchor, its spilled cells empty now: whatever reads its spill area, or is
    // blocked by it, recomputes below (also when it was #SPILL! or #CIRC! with nothing spilled).
    const oldArea = this.cells.get(key)?.spill;
    const oldSpill = [...this.spillCells(key), ...(oldArea ? this.touching(oldArea) : [])].filter((k) => k !== key);
    this.clearSpill(key);
    this.unlink(key);
    if (ast) {
      const { refs, areas } = references(ast);
      this.cells.set(key, { value: null, formula: input, ast, refs, areas, spill: null });
      for (const ref of refs) {
        let set = this.dependents.get(ref);
        if (!set) this.dependents.set(ref, (set = new Set()));
        set.add(key);
      }
      if (areas.length > 0) this.areaReaders.set(key, areas);
    } else {
      const value = parseLiteral(input);
      if (value === null) this.cells.delete(key);
      else this.cells.set(key, literalCell(value));
    }
    this.recalc([key, ...oldSpill]);
  }

  /** A cell's own value, or the value spilled into it. */
  get(addr: string): CellValue {
    return this.valueAt(keyOf(addr));
  }

  /** Only a spill's anchor holds the formula; its spilled cells give null. */
  getFormula(addr: string): string | null {
    return this.cells.get(keyOf(addr))?.formula ?? null;
  }

  functionsUsed(addr: string): string[] {
    const ast = this.cells.get(keyOf(addr))?.ast;
    return ast ? functionNames(ast) : [];
  }

  isDate(addr: string): boolean { return this.dateAt(keyOf(addr), new Set()); }

  private dateAt(key: string, seen: Set<string>): boolean {
    if (seen.has(key)) return false;
    seen.add(key);
    const ast = this.cells.get(key)?.ast;
    if (!ast) return false;
    const dateExpr = (node: Ast): boolean => {
      if (node.type === "call") return ["DATE", "DATEVALUE", "TODAY", "NOW", "EDATE", "EOMONTH", "WORKDAY"].includes(node.name.toUpperCase());
      if (node.type === "ref") return this.dateAt(keyOf(node.ref), new Set(seen));
      if (node.type === "binary" && (node.op === "+" || node.op === "-")) {
        const leftDate = dateExpr(node.left), rightDate = dateExpr(node.right);
        if (leftDate && rightDate) return false;
        if (node.op === "-" && rightDate) return false;
        const other = leftDate ? node.right : node.left;
        const numeric = other.type === "num" || other.type === "ref" && typeof this.valueAt(keyOf(other.ref)) === "number" || other.type === "binary" || other.type === "call";
        return (leftDate || rightDate) && numeric;
      }
      return false;
    };
    return dateExpr(ast);
  }

  private valueAt(key: string): CellValue {
    const cell = this.cells.get(key);
    return cell ? cell.value : (this.spilled.get(key)?.value ?? null);
  }

  private unlink(key: string): void {
    const old = this.cells.get(key);
    for (const ref of old?.refs ?? []) this.dependents.get(ref)?.delete(key);
    this.areaReaders.delete(key);
  }

  /** The cells `anchor` currently spills into (not the anchor itself). */
  private spillCells(anchor: string): string[] {
    const out: string[] = [];
    for (const [key, s] of this.spilled) if (s.anchor === anchor) out.push(key);
    return out;
  }

  private clearSpill(anchor: string): void {
    for (const key of this.spillCells(anchor)) this.spilled.delete(key);
  }

  /**
   * Cells whose value may change when `key` does: formulas that read it (directly or through
   * a range), anchors whose spill area covers it (it may block or unblock them) and, when `key`
   * is itself an anchor, the same for every cell its spill covers.
   */
  private downstream(key: string): string[] {
    const { row, col } = parseAddress(key)!;
    const out = new Set(this.touching({ top: row, left: col, bottom: row, right: col }));
    const own = this.cells.get(key)?.spill;
    if (own) for (const k of this.touching(own)) out.add(k);
    out.delete(key);
    return [...out];
  }

  /** Formula cells that read any cell of `area`, and anchors whose spill area overlaps it. */
  private touching(area: Area): string[] {
    const out: string[] = [];
    for (const [ref, readers] of this.dependents) {
      const { row, col } = parseAddress(ref)!;
      if (contains(area, row, col)) out.push(...readers);
    }
    for (const [reader, areas] of this.areaReaders) {
      if (areas.some((a) => overlaps(a, area))) out.push(reader);
    }
    for (const [anchor, cell] of this.cells) {
      if (cell.spill && overlaps(cell.spill, area)) out.push(anchor);
    }
    return out;
  }

  /** Whether `reader`'s formula reads `key`, or reads a cell that `key` spills into. */
  private dependsOn(reader: string, key: string): boolean {
    const cell = this.cells.get(reader);
    if (!cell?.ast) return false;
    const { row, col } = parseAddress(key)!;
    const at: Area = { top: row, left: col, bottom: row, right: col };
    const spill = this.cells.get(key)?.spill;
    return [at, ...(spill ? [spill] : [])].some(
      (area) =>
        cell.refs.some((ref) => {
          const a = parseAddress(ref)!;
          return contains(area, a.row, a.col);
        }) || cell.areas.some((a) => overlaps(a, area)),
    );
  }

  /**
   * Recomputes `start` and everything downstream of it. A spill that changes shape changes
   * which cells hold values, so each pass returns the cells that gained or lost a spilled
   * value and the next pass recomputes what depends on them, until nothing moves.
   */
  private recalc(start: string[]): void {
    let dirty = start;
    while (dirty.length > 0) {
      // A change travels at most one spill level per pass, and each level is an anchor, so a
      // sheet that converges does so within (formula cells + 1) passes. Running past that means
      // spills that keep changing each other's shape: mark them #CIRC! (they stay so until an
      // edit reaches them) rather than leave stale values, and settle the rest.
      const limit = this.formulaCount() + 2;
      for (let pass = 0; pass < limit && dirty.length > 0; pass++) dirty = this.pass(dirty);
      if (dirty.length === 0) break;
      const restless = new Set(dirty.map((k) => this.spilled.get(k)?.anchor).filter((a) => a !== undefined));
      for (const k of dirty) for (const a of this.touching(cellArea(k))) if (this.cells.get(a)?.spill) restless.add(a);
      const fresh = [...restless].filter((a) => !this.stuck.has(a));
      // Always make progress: if the cells still moving name no new anchor, stop every spill.
      if (fresh.length === 0) for (const [k, c] of this.cells) if (c.spill && !this.stuck.has(k)) fresh.push(k);
      if (fresh.length === 0) break;
      for (const anchor of fresh) this.stuck.add(anchor);
      dirty = [...dirty, ...fresh];
    }
    this.stuck.clear();
  }

  private formulaCount(): number {
    let n = 0;
    for (const cell of this.cells.values()) if (cell.ast) n++;
    return n;
  }

  /**
   * One pass: strongly connected components (Tarjan) give the topological order; a component
   * with a cycle is all #CIRC!. A cell that reads a spilled cell depends on its anchor.
   */
  private pass(start: string[]): string[] {
    const affected = new Set(start);
    const queue = [...start];
    while (queue.length > 0) {
      for (const next of this.downstream(queue.shift()!)) {
        if (!affected.has(next)) {
          affected.add(next);
          queue.push(next);
        }
      }
    }
    const before = this.footprint(affected);

    // Edges run from a cell to the affected cells it depends on, so Tarjan emits
    // each component after everything it depends on.
    const precedents = (key: string) => [...affected].filter((p) => this.dependsOn(key, p));
    for (const component of stronglyConnected([...affected], precedents)) {
      const only = component[0]!;
      if (component.length > 1 || this.dependsOn(only, only)) {
        for (const key of component) {
          const cell = this.cells.get(key);
          if (!cell) continue;
          this.clearSpill(key); // its spill area is kept, so the cycle is still seen next time
          cell.value = { error: "#CIRC!" };
        }
        continue;
      }
      if (this.stuck.has(only)) {
        this.clearSpill(only); // keeps its spill area, like a cycle
        this.cells.get(only)!.value = { error: "#CIRC!" };
      } else if (this.cells.get(only)?.ast) this.compute(only);
    }

    const after = this.footprint(affected);
    const changed = [...before].filter((k) => !after.has(k));
    for (const k of after) if (!before.has(k)) changed.push(k);
    return changed;
  }

  /** Cells currently spilled by any of `anchors`. */
  private footprint(anchors: Set<string>): Set<string> {
    const out = new Set<string>();
    for (const [key, s] of this.spilled) if (anchors.has(s.anchor)) out.add(key);
    return out;
  }

  /**
   * Evaluates a formula cell. An array result is written into the anchor and the cells
   * right/below it, unless one of them holds a literal, a formula or another spill, or the
   * array would run off the sheet: then the anchor is #SPILL! and nothing spills.
   */
  private compute(key: string): void {
    const cell = this.cells.get(key)!;
    this.clearSpill(key);
    const result = evaluate(cell.ast!, this.ctx);
    if (!Array.isArray(result)) {
      cell.value = result;
      cell.spill = null;
      return;
    }
    const { row, col } = parseAddress(key)!;
    const bottom = row + result.length - 1;
    const right = col + result[0]!.length - 1;
    cell.spill = { top: row, left: col, bottom: Math.min(bottom, MAX_ROWS - 1), right: Math.min(right, MAX_COLS - 1) };
    const SPILL: CellValue = { error: "#SPILL!" };
    if (bottom >= MAX_ROWS || right >= MAX_COLS) {
      cell.value = SPILL;
      return;
    }

    const targets: [string, CellValue][] = [];
    for (let r = 0; r < result.length; r++) {
      for (let c = 0; c < result[r]!.length; c++) {
        if (r === 0 && c === 0) continue;
        const target = formatAddress({ row: row + r, col: col + c });
        if (this.cells.has(target) || this.spilled.has(target)) {
          cell.value = SPILL;
          return;
        }
        targets.push([target, result[r]![c]!]);
      }
    }
    for (const [target, value] of targets) this.spilled.set(target, { anchor: key, value });
    cell.value = result[0]![0]!;
  }
}


function keyOf(addr: string): string {
  const a = parseAddress(addr);
  if (!a) throw new RangeError(`Invalid cell address "${addr}"`);
  return formatAddress(a);
}

function literalCell(value: Literal): Cell {
  return { value, formula: null, ast: null, refs: [], areas: [], spill: null };
}

function parseLiteral(input: string): Literal {
  if (input === "") return null;
  const trimmed = input.trim();
  if (NUMBER_RE.test(trimmed)) return Number(trimmed);
  const upper = trimmed.toUpperCase();
  if (upper === "TRUE" || upper === "FALSE") return upper === "TRUE";
  return input;
}

const contains = (a: Area, row: number, col: number) =>
  row >= a.top && row <= a.bottom && col >= a.left && col <= a.right;

const cellArea = (key: string): Area => {
  const { row, col } = parseAddress(key)!;
  return { top: row, left: col, bottom: row, right: col };
};

const overlaps = (a: Area, b: Area) =>
  a.top <= b.bottom && b.top <= a.bottom && a.left <= b.right && b.left <= a.right;

/** Cells and ranges a formula reads. Off-sheet refs are left out; they evaluate to #REF!. */
function references(ast: Ast): { refs: string[]; areas: Area[] } {
  const refs = new Set<string>();
  const areas: Area[] = [];
  const walk = (node: Ast): void => {
    switch (node.type) {
      case "ref": {
        const a = parseAddress(node.ref);
        if (a) refs.add(formatAddress(a));
        break;
      }
      case "range": {
        const area = parseArea(node.from, node.to);
        if (area) areas.push(area);
        break;
      }
      case "unary":
      case "percent":
        walk(node.operand);
        break;
      case "binary":
        walk(node.left);
        walk(node.right);
        break;
      case "call":
        node.args.forEach(walk);
        break;
    }
  };
  walk(ast);
  return { refs: [...refs], areas };
}

/** Tarjan's algorithm: components in reverse topological order of `next` edges. */
function stronglyConnected(nodes: string[], next: (n: string) => string[]): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const out: string[][] = [];

  const visit = (n: string): void => {
    index.set(n, index.size);
    low.set(n, index.get(n)!);
    stack.push(n);
    onStack.add(n);
    for (const m of next(n)) {
      if (!index.has(m)) {
        visit(m);
        low.set(n, Math.min(low.get(n)!, low.get(m)!));
      } else if (onStack.has(m)) {
        low.set(n, Math.min(low.get(n)!, index.get(m)!));
      }
    }
    if (low.get(n) === index.get(n)) {
      const component: string[] = [];
      let m: string;
      do {
        m = stack.pop()!;
        onStack.delete(m);
        component.push(m);
      } while (m !== n);
      out.push(component);
    }
  };

  for (const n of nodes) if (!index.has(n)) visit(n);
  return out;
}
