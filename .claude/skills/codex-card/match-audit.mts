// Wrong-formula audit for MATCH / INDEX lessons: header included or range shifted by one row/column,
// match type 0 dropped or changed to 1/-1, INDEX row/column ±1, swapped INDEX/MATCH ranges.
// Usage from a repo/worktree root: npx tsx .claude/skills/codex-card/match-audit.mts content/lessons/index-match
import { readFileSync, readdirSync } from "node:fs";
const { Sheet } = await import(`${process.cwd()}/packages/engine/src/index.ts`);
const root = (process.argv[2] ?? "content/lessons/index-match").replace(/\/?$/, "/");
const shiftRange = (r: string, dr: number, dc: number, which: "start" | "both") => r.replace(/^(\$?)([A-Z]+)(\$?)(\d+)(:(\$?)([A-Z]+)(\$?)(\d+))?$/, (_m, a, c1, b, r1, _rest, d, c2, e, r2) => {
  const col = (c: string, k: number) => String.fromCharCode(c.charCodeAt(0) + k);
  const start = `${a}${col(c1, dc)}${b}${Number(r1) + dr}`;
  if (!c2) return start;
  return `${start}:${d}${which === "both" ? col(c2, dc) : c2}${e}${which === "both" ? Number(r2) + dr : r2}`;
});
let n = 0;
for (const file of readdirSync(root).filter((f) => f.endsWith(".json")).sort()) {
  const lesson = JSON.parse(readFileSync(root + file, "utf8"));
  for (const s of lesson.steps) {
    if (s.type !== "formula") continue;
    const f: string = s.solution; const variants = new Set<string>();
    const ranges = [...new Set(f.match(/\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+/g) ?? [])];
    for (const r of ranges) for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      variants.add(f.split(r).join(shiftRange(r, dr, dc, "start")));   // header included / first cell dropped
      variants.add(f.split(r).join(shiftRange(r, dr, dc, "both")));    // whole range shifted
    }
    f.replace(/MATCH\(([^()]*?),0\)/gi, (m, inner) => { variants.add(f.replace(m, `MATCH(${inner})`)); variants.add(f.replace(m, `MATCH(${inner},1)`)); variants.add(f.replace(m, `MATCH(${inner},-1)`)); return m; });
    f.replace(/INDEX\(([^,]+),(\d+)(,(\d+))?\)/gi, (m, arr, r, _x, c) => { for (const d of [-1, 1]) { variants.add(f.replace(m, `INDEX(${arr},${Number(r) + d}${c ? "," + c : ""})`)); if (c) variants.add(f.replace(m, `INDEX(${arr},${r},${Number(c) + d})`)); } return m; });
    if (ranges.length >= 2) variants.add(f.replace(ranges[0], "\u0000").replace(ranges[1], ranges[0]).replace("\u0000", ranges[1]));
    const run = (x: string) => { try { const sh = new Sheet(s.grid); sh.set(s.targetCell, x); return JSON.stringify(sh.get(s.targetCell)); } catch { return "ERR"; } };
    const want = JSON.stringify(s.expectedValue);
    if (run(f) !== want) console.log(`${lesson.id} ${s.id} SOLUTION MISMATCH ${f} → ${run(f)} want ${want}`);
    for (const v of variants) if (v !== f && run(v) === want) { n++; console.log(`${lesson.id} ${s.id} ${f}  ≈  ${v}  → ${want}`); }
  }
}
console.log("coincidences:", n);
