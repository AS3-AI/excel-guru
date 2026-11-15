---
name: codex-card
description: Build a docs/tasks card with Codex CLI — Claude plans, prompts, verifies and reviews; Codex writes the code. Use whenever a card is to be built "with codex".
---
# Build a task card with Codex

Claude owns planning, the prompt, verification, review, commits and the build log. Codex only edits files.

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
