# Lesson style guide (Lane C)

Goal: a beginner finishes each lesson feeling it was easy, and can use the function on their own afterwards.
Every lesson is original (never copy wording, data or examples from docs/teardown.md) and follows schema v2
(docs/SPEC.md Product spec §5). `pnpm validate-content` must pass.

## Shape of a lesson (Product spec §6 pattern)
1. **Concept** — one `info` step: what the function does, in one or two short sentences, with one **bold** term.
2. **Smallest action** — a `select` step: click the cells the formula will use (builds the mental picture).
3. **Guided formula** — the prompt tells the learner exactly what to type, e.g. Type `=SUM(B2:B6)` in B7.
4. **Variations** — 2–3 `formula` steps on the same idea with one new twist each (different range, new data,
   a second range), with less hand-holding each time.
5. **Check understanding** — one `mcq` step about a common mistake.
6. **Apply it** — a final `formula` step phrased as a real question ("How much did the café earn this week?")
   with no formula given.
- requiredCorrect: 6 (at least 6 gradable steps; steps cycle from step 4 if they run out, so steps 4+ must make
  sense on their own).

## Writing rules
- Short sentences. One idea per step. Second person ("you"). No jargon before it is explained.
- Prompts: say WHERE to type (the target cell) and WHAT to find. Bold the key term once: **SUM**.
  Put formulas, cell references and ranges in backticks: `=SUM(B2:B6)`, `B2:B6`.
- `explain` (shown after a correct answer): one sentence on WHY it works, not a repeat of the prompt.
- MCQ: 3 options, one clearly right, wrong options are real beginner mistakes.
- Difficulty: 1 for the first lessons of a module, 2 for practice / skill summaries, 3 for combined.

## Grids
- Our own small, realistic datasets (a café, a book club, a gym, a school fundraiser, a delivery team…).
  Indian and international names and contexts both welcome; amounts in plain numbers (no currency symbols).
- Headers in row 1. At most 7 columns and 8 rows so it fits the grid on a phone.
- Keep numbers small and friendly so learners can sanity-check answers in their head.
- The target cell is empty and next to the data (usually below a column or to the right of a row).
- `highlightCells` marks the range the formula should use on guided steps; drop it on "apply it" steps.
- Make wrong-but-tempting answers give a different value (no coincidences: a wrong range must not sum to the
  same total).

## Grading
- `mustUse` lists the function the lesson teaches, so `=B2+B3+…` doesn't pass a SUM step.
- `solution` is the simplest correct formula; `expectedValue` must equal what it computes (validate-content checks).
- Avoid steps whose only answer depends on typing order or whitespace.
- `mobileButtons`: the symbols the formula needs, e.g. ["(", ")", ":"] or ["(", ")", ",", "\""].

## Files
- content/lessons/<module>/<id>.json, id = `<module>-<n>` (e.g. sum-1), module = the folder name from
  apps/web/lib/modules.ts.
- Add the id to content/order.json in curriculum order (Product spec §6).
