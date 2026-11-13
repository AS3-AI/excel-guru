import { tokenize } from "./tokenizer";
import { parse, type Ast } from "./parser";
import { formatAddress, parseAddress, parseArea, type Area } from "./address";
import { evaluate, functionNames, type CellValue, type EvalContext } from "./evaluator";

type Literal = string | number | boolean | null;

type Cell = {
  value: CellValue;
  formula: string | null; // as typed, with its leading "="
  ast: Ast | null;
  refs: string[]; // single cells the formula reads, as "A1"
  areas: Area[]; // ranges the formula reads
};

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export class Sheet {
  private readonly cells = new Map<string, Cell>();
  /** Cell → formula cells that name it directly. Range readers live in `areaReaders`. */
  private readonly dependents = new Map<string, Set<string>>();
  /** Formula cell → the ranges it reads; checked by containment, since B:C has no fixed size. */
  private readonly areaReaders = new Map<string, Area[]>();

  private readonly ctx: EvalContext = {
    cell: (row, col) => this.cells.get(formatAddress({ row, col }))?.value ?? null,
    usedRows: () => {
      let rows = 0;
      for (const key of this.cells.keys()) rows = Math.max(rows, parseAddress(key)!.row + 1);
      return rows;
    },
  };

  /** grid[0][0] is A1. Values are literal, except strings starting with "=", which are formulas. */
  constructor(grid: Literal[][]) {
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
   * ParseError and leaves the cell as it was.
   */
  set(addr: string, input: string): void {
    const key = keyOf(addr);
    const ast = input.startsWith("=") ? parse(tokenize(input)) : null;

    this.unlink(key);
    if (ast) {
      const { refs, areas } = references(ast);
      this.cells.set(key, { value: null, formula: input, ast, refs, areas });
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
    this.recalc(key);
  }

  get(addr: string): CellValue {
    return this.cells.get(keyOf(addr))?.value ?? null;
  }

  getFormula(addr: string): string | null {
    return this.cells.get(keyOf(addr))?.formula ?? null;
  }

  functionsUsed(addr: string): string[] {
    const ast = this.cells.get(keyOf(addr))?.ast;
    return ast ? functionNames(ast) : [];
  }

  private unlink(key: string): void {
    const old = this.cells.get(key);
    for (const ref of old?.refs ?? []) this.dependents.get(ref)?.delete(key);
    this.areaReaders.delete(key);
  }

  /** Formula cells that read `key`, directly or through a range. */
  private readersOf(key: string): string[] {
    const out = [...(this.dependents.get(key) ?? [])];
    const { row, col } = parseAddress(key)!;
    for (const [reader, areas] of this.areaReaders) {
      if (areas.some((a) => contains(a, row, col))) out.push(reader);
    }
    return out;
  }

  private reads(reader: string, key: string): boolean {
    const cell = this.cells.get(reader);
    if (!cell?.ast) return false;
    if (cell.refs.includes(key)) return true;
    const { row, col } = parseAddress(key)!;
    return cell.areas.some((a) => contains(a, row, col));
  }

  /**
   * Recomputes `start` and everything downstream of it. Strongly connected components
   * (Tarjan) give the topological order; a component with a cycle is all #CIRC!.
   */
  private recalc(start: string): void {
    const affected = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      for (const reader of this.readersOf(queue.shift()!)) {
        if (!affected.has(reader)) {
          affected.add(reader);
          queue.push(reader);
        }
      }
    }

    // Edges run from a cell to the affected cells it reads, so Tarjan emits
    // each component after everything it depends on.
    const precedents = (key: string) => [...affected].filter((p) => this.reads(key, p));
    for (const component of stronglyConnected([...affected], precedents)) {
      const only = component[0]!;
      if (component.length > 1 || this.reads(only, only)) {
        for (const key of component) this.cells.get(key)!.value = { error: "#CIRC!" };
        continue;
      }
      const cell = this.cells.get(only);
      if (cell?.ast) cell.value = evaluate(cell.ast, this.ctx);
    }
  }
}

function keyOf(addr: string): string {
  const a = parseAddress(addr);
  if (!a) throw new RangeError(`Invalid cell address "${addr}"`);
  return formatAddress(a);
}

function literalCell(value: Literal): Cell {
  return { value, formula: null, ast: null, refs: [], areas: [] };
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
