// Lint + compact digest for lesson JSON, so reviewers read one short text instead of raw JSON.
// Usage (repo or worktree root): npx tsx .claude/skills/codex-card/lesson-digest.ts content/lessons/lookup [ids...]
// Prints LINT lines (mechanical problems) then a digest per lesson; grids are printed once and
// referenced as "grid = sN" when a later step reuses them.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type Step = Record<string, any>;
const dir = process.argv[2];
const only = new Set(process.argv.slice(3));
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const lint: string[] = [];
const out: string[] = [];
const mcqSeen = new Map<string, string>();
const cell = (v: unknown) => (v === null ? "·" : typeof v === "string" ? v : JSON.stringify(v));
const colIndex = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const SYMBOLS = ['"', "$", "*", "?", ",", ":", "<", ">", "&", "/", "-", "+"];

for (const f of files) {
  const lesson = JSON.parse(readFileSync(join(dir, f), "utf8"));
  if (only.size && !only.has(lesson.id)) continue;
  const id = lesson.id;
  const steps: Step[] = lesson.steps;
  const L = (sid: string, msg: string) => lint.push(`LINT ${id} ${sid}: ${msg}`);
  out.push(`\n## ${id} — ${lesson.title} (d${lesson.difficulty}, req ${lesson.requiredCorrect}, ${steps.length} steps)`);
  const gridOwner = new Map<string, string>();
  const formulas = new Map<string, string>();
  const firstGuided = steps.find((s) => s.type === "formula");
  const last = steps[steps.length - 1];
  if (last?.type !== "formula") L(last?.id, "last step is not an apply-it formula step");
  if (steps[steps.length - 2]?.type !== "mcq") L(steps[steps.length - 2]?.id, "mcq is not right before the apply-it step");
  if (last?.highlightCells?.length) L(last.id, "apply-it step has highlightCells (gives the answer away)");
  const fnNames = (last?.solution ?? "").match(/[A-Z][A-Z.]+(?=\()/g) ?? [];
  for (const fn of fnNames) if (new RegExp(`\\b${fn}\\b`).test(last.prompt)) L(last.id, `apply-it prompt names ${fn}`);

  for (const s of steps) {
    const head = `${s.id} ${s.type}`;
    if (s.type === "info") { out.push(`${head}: ${s.text}`); continue; }
    if (s.type === "mcq") {
      out.push(`${head}: ${s.prompt}\n   options: ${s.options.map((o: string, i: number) => (i === s.answer ? `[✓ ${o}]` : o)).join(" | ")}`);
      const prev = mcqSeen.get(s.prompt); if (prev) L(s.id, `mcq prompt duplicates ${prev}`); mcqSeen.set(s.prompt, `${id} ${s.id}`);
      continue;
    }
    const grid: unknown[][] | undefined = s.grid;
    let gridNote = "";
    if (grid) {
      const key = JSON.stringify(grid);
      const owner = gridOwner.get(key);
      if (owner) gridNote = `grid = ${owner}`;
      else {
        gridOwner.set(key, s.id);
        gridNote = "grid:\n" + grid.map((r, i) => `     ${i + 1}| ${r.map(cell).join(" | ")}`).join("\n");
      }
      const widths = new Set(grid.map((r) => r.length));
      if (widths.size > 1) L(s.id, "rows have different lengths");
      if (grid[0].length > 7) L(s.id, `grid is ${grid[0].length} columns wide (max 7)`);
      if (grid.length > 8) L(s.id, `grid is ${grid.length} rows (max 8)`);
      if (grid.some((r) => r.some((c) => c === ""))) L(s.id, 'grid has "" cells (use null)');
      const text = `${s.prompt ?? ""} ${s.solution ?? ""} ${s.targetCell ?? ""} ${s.target ?? ""}`;
      for (const [, c, r] of text.matchAll(/\$?\b([A-Z]{1,2})\$?(\d{1,3})\b/g)) {
        if (colIndex(c) > grid[0].length || Number(r) > grid.length) L(s.id, `reference ${c}${r} is outside the ${grid.length}×${grid[0].length} grid`);
      }
      if (s.targetCell) {
        const m = /^([A-Z]+)(\d+)$/.exec(s.targetCell);
        if (m && grid[Number(m[2]) - 1]?.[colIndex(m[1]) - 1] !== null) L(s.id, `target ${s.targetCell} is not empty`);
      }
    }
    if (s.type === "select") {
      out.push(`${head}: ${s.prompt}\n   target ${s.target}\n   ${gridNote}`);
      if (firstGuided && JSON.stringify(s.grid) !== JSON.stringify(firstGuided.grid)) L(s.id, `select grid differs from first guided step ${firstGuided.id}`);
      if (firstGuided?.solution && !firstGuided.solution.replace(/\$/g, "").includes(String(s.target).replace(/\$/g, ""))) L(s.id, `select target ${s.target} is not used in ${firstGuided.id}'s formula`);
      continue;
    }
    if (s.type === "formula") {
      out.push(`${head}: ${s.prompt}\n   ${s.targetCell} ${s.solution} → ${JSON.stringify(s.expectedValue)}  mustUse ${JSON.stringify(s.mustUse)}  buttons ${(s.mobileButtons ?? []).join("")}${s.highlightCells ? `  hl ${s.highlightCells.join(",")}` : ""}\n   explain: ${s.explain}\n   ${gridNote}`);
      const norm = `${s.solution}|${JSON.stringify(s.grid)}`;
      const dup = formulas.get(norm); if (dup) L(s.id, `same formula and grid as ${dup}`); formulas.set(norm, s.id);
      const body = String(s.solution).slice(1).replace(/"[^"]*"/g, (q) => (q.length > 2 ? `"${q.slice(1, -1).replace(/[^*?]/g, "")}"` : q));
      for (const sym of SYMBOLS) if (body.includes(sym) && !(s.mobileButtons ?? []).includes(sym)) L(s.id, `mobileButtons missing ${sym}`);
      continue;
    }
    out.push(`${head}: ${s.prompt ?? ""}`);
  }
}
console.log(lint.length ? lint.join("\n") : "LINT: none");
console.log(out.join("\n"));
