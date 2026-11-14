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
Never use --dangerously-bypass-approvals-and-sandbox. Codex can't commit (the worktree's git dir is outside its sandbox).

## 4. Verify (Claude, outside the sandbox)
1. Read the result file; `git status --short` — only card files changed?
2. Run all four checks yourself (real `pnpm validate-content`).
3. Spot-check: test count vs card; grep for DOM reaching, alert(, hex colours; each "must keep" item still wired.
4. Browser-check the card's Done-when in Chrome (dev server: `cd apps/web && npx next dev -p <port>`).
5. Reviewer subagent on the diff; give it the must-keep list and the edge-case list.
6. Fix rounds: write a numbered fix prompt from the review, run Codex again in the same worktree, repeat 4.
   When review advice conflicts (e.g. "focus the drawer" vs "keep focus on the grid"), decide yourself before prompting.

## 5. Finish (Claude)
Commit on the card branch with attribution and "Built with Codex CLI from a Claude-written prompt";
update the card's line in docs/build-log.md; merge and push only when the user says so; remove the worktree.

## Lessons so far
- T16: first pass lost focus handling, Enter-to-grade, and wrong-answer reasons; rebuilt state in fewer lines
  and dropped tests. Always list must-keep behaviours explicitly and demand a test count.
- T16: "no farming" collided with cycling — spell out how rules interact (cycling counts again; Previous doesn't).
- Codex works around sandbox limits (validate-content IPC) — always rerun checks yourself.
