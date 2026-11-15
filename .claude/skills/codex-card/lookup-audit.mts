// Wrong-formula audit for lookup lessons (index ±1, FALSE/TRUE, XLOOKUP range swaps, wildcard loosening).
// Usage from a repo/worktree root: npx tsx .claude/skills/codex-card/lookup-audit.mts content/lessons/lookup
// Prints "<id> <step> <solution> ≈ <wrong variant>" for each wrong formula that still gives expectedValue.
import { readFileSync, readdirSync } from "node:fs";
const { Sheet } = await import(`${process.cwd()}/packages/engine/src/index.ts`);
const root = (process.argv[2] ?? "content/lessons/lookup").replace(/\/?$/, "/");
const shiftCol = (ref: string, d: number) => ref.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (_m, a, c, b, n) => a + String.fromCharCode(c.charCodeAt(0) + d) + b + n);
let n = 0;
for (const file of readdirSync(root).filter((f) => f.endsWith(".json")).sort()) { const i = Number(file.match(/(\d+)\.json$/)?.[1]);
  const lesson = JSON.parse(readFileSync(root + file, "utf8"));
  for (const s of lesson.steps) {
    if (s.type !== "formula") continue;
    const f: string = s.solution; const variants = new Set<string>();
    // index ±1 (3rd arg of V/HLOOKUP)
    f.replace(/([VH]LOOKUP\(([^,]+),([^,]+),)(\d+)/gi, (m, pre, _a, _b, k) => { for (const d of [-1, 1]) variants.add(f.replace(m, pre + (Number(k) + d))); return m; });
    // FALSE<->TRUE / omitted
    if (/,FALSE\)/i.test(f)) { variants.add(f.replace(/,FALSE\)/i, ",TRUE)")); if (i === 9) variants.add(f.replace(/,FALSE\)/i, ")")); }
    if (/,TRUE\)/i.test(f)) variants.add(f.replace(/,TRUE\)/i, ",FALSE)"));
    // XLOOKUP: swap lookup/return, shift return range
    f.replace(/XLOOKUP\(([^,]+),([^,]+),([^,)]+)/gi, (m, a, b, c) => { variants.add(f.replace(m, `XLOOKUP(${a},${c},${b}`)); for (const d of [-1, 1]) variants.add(f.replace(m, `XLOOKUP(${a},${b},${shiftCol(c, d)}`)); return m; });
    // wildcard: drop match mode 2, loosen pattern
    if (/,2\)/.test(f) && /XLOOKUP/i.test(f)) variants.add(f.replace(/,2\)$/, ")"));
    f.replace(/"([^"]*[*?][^"]*)"/g, (m, p) => { variants.add(f.replace(m, '"*"')); if (p.length > 2) variants.add(f.replace(m, `"${p.slice(1)}"`)); return m; });
    const run = (x: string) => { try { const sh = new Sheet(s.grid); sh.set(s.targetCell, x); return JSON.stringify(sh.get(s.targetCell)); } catch { return "ERR"; } };
    const want = JSON.stringify(s.expectedValue);
    if (run(f) !== want) console.log(`${lesson.id} ${s.id} SOLUTION MISMATCH ${f} → ${run(f)} want ${want}`);
    for (const v of variants) if (v !== f && run(v) === want) { n++; console.log(`${lesson.id} ${s.id} ${f}  ≈  ${v}  → ${want}`); }
  }
}
console.log("coincidences:", n);
