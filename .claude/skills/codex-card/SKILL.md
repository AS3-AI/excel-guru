---
name: codex-card
description: Build docs/tasks cards and lessons with Codex CLI and Antigravity CLI (agy), alone or side by side — Claude plans, prompts, verifies, reviews and integrates; the builders write the files. Use whenever work is to be built with codex or antigravity.
---
# Build cards and lessons with Codex and Antigravity

Claude owns planning, prompts, verification, review, commits, integration and the build log. The builders
(Codex, Antigravity) only edit files. Sections 1–5 are the single-slot flow; §6 runs both builders in parallel.

## 1. Prepare (Claude)
1. Read the card and every spec section it cites. Check its dependencies are merged **and pushed**.
2. Before prompting, list for yourself: the exact files allowed; frozen interfaces it touches; and every
   earlier-reviewed behaviour in those files (grep docs/tasks/*.md for cards that touched the same files).
   Missing this list is what caused T16's regressions.
3. If the card obviously needs a file outside its list (e.g. a component prop), extend the card first.
   Never let Codex reach into another component's DOM (ids, roles, querySelector) instead.
4. Worktree + deps (Codex has no network):
   ```bash
   git worktree add -q -b <card-branch> .claude/worktrees/<card> main
   (cd .claude/worktrees/<card> && pnpm install)
   ```

## 2. Prompt (write to $CLAUDE_JOB_DIR/tmp/codex/<card>-prompt.md)
Use this skeleton; fill every bracket. Be concrete — Codex follows lists, not intentions.
```
You are implementing task card <Tn> (<title>) in the Excel Guru monorepo. Your working directory is a git
worktree with dependencies installed. Network is off.
Read in order: CLAUDE.md (binding); apps/web/AGENTS.md and node_modules/next/dist/docs if touching Next;
docs/tasks/<Tn>.md (your card); docs/SPEC.md <sections>; existing code: <files>; earlier cards whose
behaviour you must keep: <cards>.
Hard rules:
- Touch only the card's Files. If something outside them is needed, STOP that part and describe it.
- Never read another component's DOM (ids, roles, querySelector, closest); use props.
- Must keep (each was reviewed before): <numbered list of concrete behaviours, with scenarios>.
- Edge cases to handle: <numbered list — focus after each action, Enter vs modified Enter, keyboard AND
  mouse AND touch, empty input, repeat/IME keys, revisits/cycling, after-completion, double counting>.
- Pure logic in <file> with tests written first (see them fail). At least <N> tests covering: <list>.
- Colours only from apps/web/lib/tokens.css; no alert(); works at 375 px. Never read .env*.
- Do NOT commit. Ignore apps/web/AGENTS.md.
Done = all pass from the worktree root; paste the last lines of each:
  pnpm typecheck / pnpm test / node --import tsx scripts/validate-content.ts content / pnpm --filter web build
  (pnpm validate-content fails in your sandbox: tsx can't open its IPC pipe.)
Final message: concise; per rule/item: what changed; tests added; anything not done and why.
```

## 3. Run (background)
```bash
cd .claude/worktrees/<card> && codex exec -C "$PWD" -s workspace-write \
  -o $CLAUDE_JOB_DIR/tmp/codex/<card>-result.md "$(cat $CLAUDE_JOB_DIR/tmp/codex/<card>-prompt.md)" \
  > $CLAUDE_JOB_DIR/tmp/codex/<card>-log.txt 2>&1
```
Always run it with `run_in_background` and `< /dev/null`: in a foreground shell `codex exec` waits on stdin
("Reading additional input from stdin…") and hangs with no session log. Never use --dangerously-bypass-approvals-and-sandbox. Codex can't commit (the worktree's git dir is outside its sandbox).

## 4. Verify (Claude, outside the sandbox)
1. Read the result file; `git status --short` — only card files changed?
2. Run all four checks yourself (real `pnpm validate-content`).
3. Spot-check: test count vs card; grep for DOM reaching, alert(, hex colours; each "must keep" item still wired.
4. Browser-check the card's Done-when in Chrome (dev server: `cd apps/web && npx next dev -p <port>`).
5. Reviewer subagent on the diff; give it the must-keep list and the edge-case list. Keep it cheap (below).
6. Fix rounds: write a numbered fix prompt from the review, run Codex again in the same worktree, repeat 4.
   When review advice conflicts (e.g. "focus the drawer" vs "keep focus on the grid"), decide yourself before prompting.

## 4a. Review with few tokens
The reviewer's job is judgement. Run every mechanical check first and fix what it finds, so the reviewer
never spends tokens finding a grid that's too wide or a test that fails.
- **Code cards:** save the diff to a file (`git diff main > $CLAUDE_JOB_DIR/tmp/<card>.diff`, plus new files),
  pass its path, and say "typecheck/test/validate/build already pass: don't rerun them unless you change your
  mind about a failure". Name the 3–6 files and spec sections that matter instead of "read the spec". Ask for
  "numbered real problems with file:line + fix, then a one-line verdict; no praise, no restating the diff".
- **Content (lessons):** run from the worktree root and fix every LINT line before the review:
  ```bash
  npx tsx .claude/skills/codex-card/lesson-digest.ts content/lessons/<module> > $CLAUDE_JOB_DIR/tmp/<module>-digest.txt
  npx tsx .claude/skills/codex-card/lookup-audit.mts content/lessons/<module>   # lookup modules; write a sibling for others
  ```
  Then give the reviewer the digest path (not the JSON files): "Review from this digest; open a lesson's JSON
  only to confirm a suspected problem. LINT, validate-content and the wrong-formula audit already ran — accepted
  audit exceptions: <list>. Don't read docs/content-style.md in full; the checklist is: <the 6–8 items that
  matter for this module>. Spot-check docs/teardown.md with grep for 3–4 distinctive names only."
- **Re-reviews:** a fresh reviewer gets only the changed steps (digest with ids:
  `lesson-digest.ts <dir> lookup-3 lookup-7`) and the numbered list of what was asked; "report only what is
  still wrong". Don't resume a long-context reviewer just to re-check a few items.
- One reviewer per module (not per lesson); never two reviewers on the same files.
- In Codex prompts write `node --import tsx <script>`, never `npx tsx` (its IPC pipe is blocked in the sandbox).

## 5. Finish (Claude)
Commit on the card branch with attribution and "Built with Codex CLI from a Claude-written prompt";
update the card's line in docs/build-log.md; merge and push only when the user says so; remove the worktree.

## Lessons so far
- T16: first pass lost focus handling, Enter-to-grade, and wrong-answer reasons; rebuilt state in fewer lines
  and dropped tests. Always list must-keep behaviours explicitly and demand a test count.
- T16: "no farming" collided with cycling — spell out how rules interact (cycling counts again; Previous doesn't).
- Codex works around sandbox limits (validate-content IPC) — always rerun checks yourself.
- T20: a route that turned dynamic read content/ at request time; it worked locally but 500'd on Vercel because
  content/ wasn't traced. After every push, curl each changed route on production, not just `/`; before merging,
  check `.next/server/app/**/page.js.nft.json` includes any file read at runtime.
- T25: offline Codex replaced the worktree's node_modules/.pnpm with a symlink to the main store and ran tools
  directly; Turbopack then refused to build ("Could not find next/package.json"). Pre-install every dependency
  the card needs before running Codex, tell it never to touch node_modules or symlink stores, and after Codex
  run `ls -la node_modules/.pnpm` in the worktree — reinstall cleanly if it's a link.
- Lookup content: asked for 9 lessons in one run, Codex generated three with a template script (one formula
  step repeated 5×, generic prompts, "" for empty cells) and stopped a rewrite round half done. For content,
  run ONE lesson per Codex run (parallel runs are fine — disjoint files), give a step plan per lesson, hand it
  an audit script with a pass condition (`coincidences: 0` for its lesson), and grep for `""` cells afterwards.

## 6. Two builders side by side: Codex and Antigravity (owner approved 16 Nov)
Goal: run Codex and Antigravity (`agy`) at the same time without their work colliding, so every finished
piece merges into main with no more than a mechanical conflict in a Claude-owned file.

**Slots.** One slot = one card or one lesson → one branch → one worktree → one builder. Name the branch
`<card>-<builder>` (`t37-codex`, `c1-agy-tsearch3`) and the worktree `.claude/worktrees/<branch>`; give each
worktree its own `pnpm install`. Never two builders, or two runs, in the same worktree.

**Ownership.** Each slot's prompt lists the exact files it may touch, as the card's Files list does. Before
launching parallel slots, write the lists side by side: two slots run together only if their lists share no
file. Anything both need waits, or goes to one slot.

**Claude-owned files.** These are never in a builder's list; Claude edits them before launch or at merge time:
`content/order.json`, `docs/build-log.md`, `docs/roadmap.md`, `docs/tasks/*`, `package.json` and the lockfile
(install dependencies before launch), `.env.example` (add names in the card), `apps/web/lib/tokens.css`,
`apps/web/lib/modules.ts`, frozen interfaces (lesson schema, API contracts, PaymentProvider), and migration
numbers: the card reserves `00NN_name.sql` and the slot writes only that file.

**Seams.** When two slots meet (a page and its API, a helper used by both), Claude commits the contract on main
first: types and function signatures in a stub file, or in the card, with the agreed error shapes. Both slots
branch after that commit, build against it, and test the other side with fakes. Neither slot edits the
contract; a needed change stops both and goes through Claude.

**Which builder.**
- Codex: code. It runs typecheck, tests and the build in its sandbox. Command in §3.
- Antigravity: lesson JSON, banks, articles and other files that don't need a command run; or a pure helper
  whose tests Claude runs. It can edit files but can't run shell commands when unattended (auto-denied; never
  use `--dangerously-skip-permissions`). Command, from the slot's worktree, in the background:
  `agy -p "$(cat <prompt>)" --mode accept-edits --print-timeout 900s < /dev/null > <log> 2>&1`
  Its prompt is the same as Codex's minus the "Done = run …" lines. Claude runs every check afterwards and sends
  a numbered fix prompt with the exact LINT, audit or test lines.
- A slot never switches builders mid-way. If one stalls twice on the same fix, Claude finishes it by hand.

**Running.** At most 9 slots at once (owner, 16 Nov). Each run's prompt, result and log go in
`$CLAUDE_JOB_DIR/tmp/<builder>/<branch>-{prompt,result,log}`. Check each slot from its own worktree, so audits use
that worktree's engine.

**Integration.** When slots finish and pass review, Claude commits each on its own branch (crediting the builder:
"Built with Codex CLI / Antigravity from a Claude-written prompt"), then merges them one at a time onto
`integrate/<batch>`, running all four checks after each merge. Claude resolves conflicts in Claude-owned files:
append ids to `order.json` in curriculum order, add build-log lines. If code slots touched neighbouring areas,
review the combined diff once. Merge `integrate/<batch>` into main and push only on the owner's word, then remove
the worktrees and branches.
- Codex usage limit (16 Nov, until Dec 13): code cards moved to Antigravity. Loop: agy edits → Claude runs
  typecheck, test, validate-content, build (and TZ engine tests) in the slot → numbered fix prompt with the exact
  failing test names and error lines → repeat. Prompts for agy code work list every file, every rule as a
  numbered checklist, the must-keep behaviours, and ask for a per-item "already correct / changed" reply.
- Owner rule (16 Nov): after every merge, push or status change, update docs/roadmap.md (status column, the
  "Last updated" line) and docs/build-log.md in the same commit.
