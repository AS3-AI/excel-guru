# Plan: Intro to Shortcuts (6) and Cell Selection (7)

Written 16 Nov 2026 for content cards C3 and C4 (docs/roadmap.md). Lessons are mostly `shortcut` steps (T17):
`mode: "chord"` (hold modifiers, press one key) or `"sequence"` (Alt key tips in order); keys for `win` and
`mac` (`null` → Mac skip bar); `activeCell`; `postcondition` (`selection` and/or `grid`) shown after success.
Grading is by the keys pressed; the sheet isn't simulated.

## Before any lesson: T54 — shortcut steps show a real grid
Today `ShortcutStep` shows a placeholder box ("A1 · Excel") and prints the postcondition as text. Cell
Selection is about seeing the selection move, so it needs the real grid.
- Render the step's `grid` read-only with the `Grid` component, the `activeCell` outlined, and the starting
  selection (`activeCell`) highlighted.
- After success: apply `postcondition.selection` as the highlighted range and `postcondition.grid` as the new
  cell values (e.g. filled-down formulas, pasted values, "45%" for a percent format).
- Keep T17's behaviour: focus, preventDefault only on the step's combo, repeat/IME/lone-modifier ignore,
  mobile banner, Mac skip bar, sequence pictures when `pics` exist.
- Formatting (bold, italic, fill) can't be shown by values. Proposal for the frozen schema (owner decides):
  `postcondition.format: { "B2": ["bold"] }`. Until then formatting lessons describe the result in the explain
  and show what values they can (number formats as text, e.g. "₹1,250.00", "45%").

## Browser check list (every combo is tried in Chrome and Safari on a Mac and in Chrome on Windows before merge)
Combos browsers may grab even with preventDefault: Ctrl+U (view source), Ctrl+D (bookmark), Ctrl+R / Cmd+R
(reload), Ctrl+L (address bar), Ctrl+- / Cmd+- (zoom), Cmd+Arrow (Mac back/forward outside inputs),
Ctrl+Space (Mac input-source switch), F-keys on Mac laptops (need fn). The content check already rejects
Ctrl/Cmd + W, T, N, Q, Tab and shifted symbols (write Ctrl+Shift+5, not Ctrl+%). Any combo that can't be
caught becomes `mac: null` / an mcq instead of a key step.

## Shared lesson shape for shortcut lessons
info (what the shortcuts do, a key table) → a select step on the practice grid → guided shortcut (prompt shows the
keys) → 3–4 shortcut variations (each a new key or a new situation) → mcq (a real mix-up, e.g. Ctrl+D vs Ctrl+R) →
apply-it shortcut (a task described in words: "copy the formula in D2 down to D6", keys not named).
requiredCorrect 6. Every shortcut step has `activeCell`, a `grid` (≤7×8) and a `postcondition`.

## Intro to Shortcuts (C3)
| id | Topic | Steps (win / mac) |
|---|---|---|
| intro-to-shortcuts-1 | Alt key tips | Windows-only lesson (`mac: null` on every key step; info explains that Mac Excel has no key tips). Sequences: Alt, H, 1 (bold) · Alt, H, A, C (centre) · Alt, H, B, A (all borders) · Alt, N, V (pivot table insert — mcq only) · Alt, H, O, I (autofit column). `pics` frames if we make them; otherwise the grid + explain. |
| intro-to-shortcuts-2 | Text formatting | Ctrl+B / Cmd+B · Ctrl+I / Cmd+I · Ctrl+U / Cmd+U (browser check: view source) · Ctrl+5 / Cmd+Shift+X (strikethrough) · Ctrl+1 / Cmd+1 (Format Cells, mcq-only if it can't be caught) |
| intro-to-shortcuts-3 | Number formatting | Ctrl+Shift+1 (number, 2 decimals) · Ctrl+Shift+4 (currency) · Ctrl+Shift+5 (percent) · Ctrl+Shift+3 (date) · Ctrl+Shift+` (general) — same keys on Mac with Ctrl. Postcondition grid shows the formatted text ("1,250.00", "45%"). |
| intro-to-shortcuts-4 | Fill right and down | Ctrl+D / Cmd+D (fill down) · Ctrl+R / Cmd+R (fill right) · Ctrl+Enter (fill selection with one entry — mcq if it clashes with the player's Enter) · Postcondition grid shows the filled formulas' values. Browser check: bookmark/reload. |
| intro-to-shortcuts-5 | Cut, copy, paste | Ctrl+C / Cmd+C · Ctrl+X / Cmd+X · Ctrl+V / Cmd+V · Ctrl+Alt+V / Cmd+Ctrl+V (paste special) · Ctrl+Z / Cmd+Z · Ctrl+Y / Cmd+Y. Steps are pairs (copy, then select target and paste) with postconditions. |
| intro-to-shortcuts-6 | Data shortcuts | Ctrl+Shift+L / Cmd+Shift+F (filter) · Alt+ArrowDown / Option+ArrowDown (open filter list) · Ctrl+; / Ctrl+; (today's date) · Ctrl+Shift+; / Cmd+; (time) · Alt+= / Cmd+Shift+T (AutoSum) · F2 (edit cell) · F4 (toggle $ in a reference; Mac Cmd+T is reserved → `mac: null`). |

## Cell Selection (C4) — needs T54
| id | Topic | Steps (win / mac) |
|---|---|---|
| cell-selection-1 | Arrow keys | Arrows (one cell) · Ctrl+Arrow / Cmd+Arrow (jump to the edge of data, with a gap in the data so the stop point is visible) · Ctrl+Home / Ctrl+Home (fn+Ctrl+Left on laptops — say so) · Ctrl+End / Ctrl+End. Postcondition `selection` = the new active cell. |
| cell-selection-2 | Selection shortcuts | Shift+Arrow (extend one cell) · Ctrl+Shift+Arrow / Cmd+Shift+Arrow (extend to the edge) · Shift+Home (to start of row) · mixes from cell-selection-1. |
| cell-selection-3 | Larger selections | Ctrl+A / Cmd+A (current region, then the whole sheet on a second press — two steps) · Ctrl+Shift+End / Cmd+Shift+End (to the last used cell) · Ctrl+Shift+Home. |
| cell-selection-4 | Rows and columns | Shift+Space (whole row) · Ctrl+Space (whole column; Mac: Ctrl+Space clashes with input switching → `mac: null` or Cmd+Space? no, Spotlight → `mac: null` and say why) · Ctrl+Shift+= / Cmd+Shift+= (insert) · Ctrl+- / Cmd+- (delete; browser zoom check). |
| cell-selection-5 | Selection 2 | Practice of 1–2 on new data: jump and extend in one go (Ctrl+Shift+ArrowDown then Ctrl+Shift+ArrowRight as two steps), Shift+PageDown, a gap in the data that stops Ctrl+Arrow early. |
| cell-selection-6 | Larger selections 2 | Ctrl+Shift+8 / Ctrl+Shift+8 (current region; written with 8, not *) · F8 extend mode (Windows; Mac fn+F8) · Ctrl+Shift+End after inserting a row. |
| cell-selection-7 | Skill summary | Mixed tasks in words, no keys named: "select the whole table", "jump to the last sale", "select the Price column", "extend to the end of the list". Last in the module order. |

## How the waves run
1. T54 by Codex (it touches the player; one slot).
2. Two gold lessons by Claude: intro-to-shortcuts-2 (text formatting, works today with value postconditions)
   and cell-selection-1 (after T54).
3. Antigravity, one lesson per run, from this table. Claude checks: validate-content (combo rules), digest lint,
   and a browser pass over every combo (the list above). No wrong-formula audit applies; instead a key audit:
   every step has win keys, mac keys or `mac: null` with the reason in the explain, an activeCell inside the
   grid, and a postcondition.
4. Global order: interleave the easy shortcut lessons between function modules (SPEC §6), e.g. text formatting
   after SUM, fill down after COUNT, selection lessons before Lookup. Claude edits content/order.json at merge.

## Open questions for the owner
- Formatting display: approve `postcondition.format` (schema change) or keep formatting lessons value-only?
- Alt key tips: Windows-only lesson is acceptable? (Mac learners see a skip bar for the whole lesson.)
- Pictures for key-tip sequences: make simple ribbon images ourselves, or go without?
