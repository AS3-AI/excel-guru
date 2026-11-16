// Wrong-formula audit for table/criteria lessons: numbers ±1, cell row ±1, quoted pieces, SUMIF↔COUNTIF/AVERAGEIF, >=↔>, <=↔<, a range end ±1.
// UPPER/LOWER/PROPER swaps, a quoted piece dropped or emptied (e.g. the " " separator), cell row ±1.
// Usage from a repo/worktree root: npx tsx .claude/skills/codex-card/text-audit.mts content/lessons/text-search
import { readFileSync, readdirSync } from "node:fs";
const { Sheet } = await import(`${process.cwd()}/packages/engine/src/index.ts`);
const root = (process.argv[2] ?? "content/lessons/tables").replace(/\/?$/, "/");
const swaps: [RegExp, string][] = [[/\bSUMIF\(/g, "AVERAGEIF("], [/\bAVERAGEIF\(/g, "SUMIF("], [/>=/g, ">"], [/<=/g, "<"], [/(?<![<>])>(?!=)/g, ">="], [/(?<![<>])<(?![=>])/g, "<="], [/\bLEFT\(/g, "RIGHT("], [/\bRIGHT\(/g, "LEFT("], [/\bFIND\(/g, "SEARCH("], [/\bSEARCH\(/g, "FIND("],
  [/\bTEXTBEFORE\(/g, "TEXTAFTER("], [/\bTEXTAFTER\(/g, "TEXTBEFORE("], [/\bUPPER\(/g, "PROPER("], [/\bPROPER\(/g, "UPPER("], [/\bLOWER\(/g, "PROPER("]];
let n = 0;
for (const file of readdirSync(root).filter((f) => f.endsWith(".json")).sort()) {
  const lesson = JSON.parse(readFileSync(root + file, "utf8"));
  for (const s of lesson.steps) {
    if (s.type !== "formula") continue;
    const f: string = s.solution; const v = new Set<string>();
    for (const [re, to] of swaps) if (re.test(f)) v.add(f.replace(re, to));
    // numbers (not inside quotes) ±1
    const parts = f.split(/("[^"]*")/);
    parts.forEach((p, i) => { if (i % 2) return; p.replace(/(?<![A-Z$\d.])(\d+)(?![\d:])/g, (m, d, off) => { for (const k of [-1, 1]) { const q = [...parts]; q[i] = p.slice(0, off) + (Number(d) + k) + p.slice(off + m.length); v.add(q.join("")); } return m; }); });
    // quoted pieces: dropped as an argument, or emptied
    f.replace(/,("[^"]*")/g, (m, q) => { v.add(f.replace(m, "")); v.add(f.replace(m, ',""')); return m; });
    f.replace(/&("[^"]*")&/g, (m) => { v.add(f.replace(m, "&")); return m; });
    // range ends ±1 (A2:A8 → A2:A7 / A2:A9)
    f.replace(/:(\$?[A-Z]\$?)(\d+)/g, (m, c, r, off) => { for (const k of [-1, 1]) v.add(f.slice(0, off) + ":" + c + (Number(r) + k) + f.slice(off + m.length)); return m; });
    // cell refs row ±1
    f.replace(/\b([A-Z])(\d+)\b(?![:(])/g, (m, c, r, off) => { for (const k of [-1, 1]) if (Number(r) + k > 0) v.add(f.slice(0, off) + c + (Number(r) + k) + f.slice(off + m.length)); return m; });
    const run = (x: string) => { try { const sh = new Sheet(s.grid); sh.set(s.targetCell, x); return JSON.stringify(sh.get(s.targetCell)); } catch { return "ERR"; } };
    const want = JSON.stringify(s.expectedValue);
    if (run(f) !== want) console.log(`${lesson.id} ${s.id} SOLUTION MISMATCH ${f} → ${run(f)} want ${want}`);
    for (const x of v) if (x !== f && run(x) === want) { n++; console.log(`${lesson.id} ${s.id} ${f}  ≈  ${x}  → ${want}`); }
  }
}
console.log("coincidences:", n);
