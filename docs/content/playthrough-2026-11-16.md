# Learner playthrough — 16 Nov 2026 (62 live lessons, reviewer agent)

Status keys: ⬜ to fix · 🟢 fixed · ❓ needs the owner's decision.

## A. Marks a correct answer wrong / blocks the learner (fix first)
- 🟢 intro s3/s4: grid is A:B but the steps type in C2 → widen to 3 columns, header "Total" in C1.
- 🟢 intro s5: lesson ends on an mcq → move the mcq before the last formula step.
- 🟢 logical-7 s5: mustUse IFS but a nested IF is equally right and the prompt doesn't name IFS → say "use IFS".
- 🟢 combined-1 s5: mustUse INDEX/MATCH rejects XLOOKUP/VLOOKUP → mustUse [] (graded by value).
- 🟢 combined-2 s5: mustUse XLOOKUP+MIN rejects INDEX/MATCH → mustUse ["MIN"].
- 🟢 combined-1 s7: mustUse CONCAT rejects `&` → drop CONCAT.
- 🟢 text-manipulation-1 s6: requires CONCAT right after `&` was taught, unnamed → say "use CONCAT".
- 🟢 lookup-6 s7, lookup-7 s6/s8, index-match-3 s8, index-match-5 s10, index-match-4 s8: apply-it requires one lookup function while others also work → name the function in the prompt.
- 🟢 count-6 s4: COUNTIF(B2:B6,"") also works → say "use COUNTBLANK".

## B. Explains/prompts that don't match what the learner sees
- 🟢 logical-4 s8: text "42" looks like the number 42 → prompt says "(typed as text)".
- 🟢 sum-9 s5: debug step's broken formula isn't in C6 → pre-fill `=SUMIFS(A2:A5,"North",C2:C5)`.
- 🟢 combined-1 s4: says quantities are in C2:C7 (they're in D) → fix the columns named.
- 🟢 text-manipulation-3 s1: PROPER explained twice → one sentence.
- 🟢 count-2: "units"/"stock"/"entries" mixed → "units".
- 🟢 statistical-5 s7: 4.2 visitors → a measurable quantity (kg, metres).
- 🟢 logical-5 s1: "Without it" unclear → "Without the final TRUE, default pair".
- 🟢 text-search-7 s7: "skipping commas" unclear → "leave arguments 3–5 empty by typing just commas".

## C. Untaught or a jump without a bridge
- 🟢 logical-7: add an info step for IFERROR (and make s6 hit the error case) and a one-line bridge for nested IF.
- 🟢 lookup-3 s6: `$` and copying down appear unexplained → add an info step on `$`.
- 🟢 sum-2 s1/s3: AutoSum keys never named → Alt+= (Mac ⌘⇧T).
- 🟢 index-match-3 s6: jump to two-way INDEX/MATCH/MATCH → a bridge step or info.
- 🟢 lookup-7 s1: define "spill" before #SPILL! is used.
- 🟢 Version note (Excel 2021/365 needed) in s1 of: XLOOKUP, TEXTJOIN, TEXTBEFORE/TEXTAFTER, UNIQUE, FILTER, SORT, IFS, SWITCH, XOR lessons.
- 🟢 text-search-5 s8: hint "find the space" (and a space button).

## D. Structure (❓ owner decides — bigger edits)
- ❓ text-search-4 repeats count-7 wildcards → refocus on SEARCH/XLOOKUP wildcards.
- ❓ index-match order → 1, 2, 6, 3, 5, 4; trim repeated basics in index-match-4.
- ❓ lookup module: merge lookup-5 and lookup-8; HLOOKUP after the VLOOKUP lessons.
- ❓ sum-2 (AutoSum) mostly retypes SUM → more real AutoSum steps or shorter.
- ❓ "type exactly this formula again" steps right before apply-it (sum-6/7/8 s8, logical-2 s6) → unprompted practice.
- ❓ logical-4 s6 and s10 identical → s10 uses ISERR/ISNA.
- ❓ "Statistical" holds FLOOR/CEILING/EVEN/ODD → rename or split a "Rounding" lesson.
- ❓ one term for SUMIF's argument ("condition"); explain VLOOKUP "without headers" vs HLOOKUP "with header row".
- ❓ statistical-7: mention MODE.SNGL.

## Flow summary (reviewer)
Smooth: SUM → SUMIF/S, COUNT, Logical basics, Text Search 1–3. Drags: Lookup (VLOOKUP four times), sum-2, retype steps,
wildcards taught three times. Jumps: logical-7 (IFERROR, nested IF), lookup-3 ($), two-way lookups, version-only
functions, case-study grading that rejects valid alternatives.
