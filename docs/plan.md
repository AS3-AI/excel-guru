# Excel Guru (working name) — 5-Day Build Plan

Nov 11, 2026 · @Sukaran

Goal: a working parity clone of ExcelExercises.com live by Nov 16, 2026.

## Verdict: possible, with three conditions

A full parity clone in 5 days (Thu 12 – Mon 16 Nov) is **not possible if built the normal way** — the original took years of lesson writing. It **is possible** if you change how the work is done:

1. **Don't build a spreadsheet engine — borrow one.** Use an existing formula engine (HyperFormula or formula.js) and a tiny custom grid. Building Excel's calculator yourself is a months-long job; wiring one in is a day.
2. **Content is data, not code.** Every lesson is a JSON file following one schema, rendered by one generic lesson player. Then 68 lessons = 68 JSON files, drafted by an LLM and reviewed by a human, not 68 pages coded by hand.
3. **Three parallel lanes from hour one.** Work runs in three lanes: Lane A (simulator + lesson player), Lane B (platform: auth, progress, payments, leaderboards, certificates), Lane C (content). Decided: you + a coding agent. Lanes A and B run as two parallel agent sessions; you own Lane C review and every merge. The agent types fast — your review time is the real bottleneck.

Definition of done on Mon 16 Nov: a stranger can land on the site, finish 3 free lessons without signing up, sign up, pay, finish all lessons, earn a verifiable certificate and see themselves on today's leaderboard.

## Decision log

Every major choice, what it beat, and the first-principles reason. Rows 1–4 are yours (answered 12 Nov); 5–11 are mine — push back on any.

| # | Decision | Chosen | Rejected | Why |
| --- | --- | --- | --- | --- |
| 1 | Who builds | You + coding agent | 3-person team | The agent writes code fast; the price is a spec explicit enough that it never has to guess |
| 2 | Formula engine | Own parser + formula.js (MIT) | HyperFormula (GPLv3) | GPL is "viral": using it forces your code open. MIT doesn't. Cost: \~1 day to write a parser |
| 3 | Payments | Razorpay + Stripe behind one interface | A single provider | India needs UPI, the world needs cards; an interface means the rest of the app never knows which one ran |
| 4 | Backend | Supabase | Own Node + Postgres | Auth, DB and row-level security in an afternoon; 5 days can't afford building plumbing |
| 5 | Answer checking | Compare computed values | Compare formula text | `=SUM(B2:B4)` and `=B2+B3+B4` are both right; text match fails correct learners |
| 6 | Where grading runs | Same TS package in browser and server; server re-grades before awarding points | Trust the browser | Anything in the browser can be edited; the leaderboard is only fair if the server checks |
| 7 | Where lessons live | JSON files in git | Database / CMS | Versioned, reviewable in a PR, and an LLM can generate them |
| 8 | Who is premium | `subscriptions` table is the truth | A single `is_premium` flag | Two providers, renewals, cancellations and lifetime plans don't fit in one boolean |
| 9 | Webhooks | Idempotent (store each event id once) | Process every call | Providers retry webhooks; without this a retry can double-grant or flip state |
| 10 | AI hints | Server builds the prompt from the lesson file | Client sends the prompt | Stops prompt injection and keeps LLM cost predictable |
| 11 | Recalculation | Recompute in dependency order on a small grid | Excel-grade incremental engine | Lesson sheets are ≤ 300 cells; simple is fast enough |

Decided 12 Nov (rows 12–15):

| # | Decision | Chosen | Open point |
| --- | --- | --- | --- |
| 12 | Monthly price | ₹499 (India, Razorpay) · $20 (global, Stripe) | — |
| 13 | Annual and lifetime | Annual confirmed: ₹1,499 / $60 a year. Lifetime proposed: ₹4,999 / $200 (10x monthly) | Lifetime: keep or drop? |
| 14 | AI hints | Gemini, key in `GEMINI_API_KEY` (server only) | — |
| 15 | Name and domain | "Excel Guru" as a working name; domain read from `NEXT_PUBLIC_BASE_URL` so it can change without code edits | "Excelguru" is already an established Excel training brand ([excelguru.ca](https://excelguru.ca/about-us), Ken Puls) — check the trademark before buying a domain |

```ts
// apps/web/lib/plans.ts — the only place prices live
export const PLANS = {
  INR: { monthly: 499, annual: 1499, lifetime: 4999 },   // annual confirmed 12 Nov; lifetime pending
  USD: { monthly: 20,  annual: 60,   lifetime: 200 },
} as const;
```

Decision 16 (12 Nov): **landing page first**, time-boxed to 3 hours, with a waitlist. Why: it starts collecting emails and gets the site indexed 4 days before launch, and forces the positioning to be written down. Guardrail: the formula engine is still the critical path, so T3 (tokenizer) starts in a second agent session the moment T1 is merged.

## Scope: what ships by Mon 16 Nov

Every feature of the original is listed; "Full" ships complete, "Lite" ships a simpler version, "Later" is out of the 5 days.

| Feature | Parity level | Notes |
| --- | --- | --- |
| Landing page, SEO meta, sign up / log in | Full | Google + email login |
| Dashboard: module cards, progress, Low Accuracy / Needs Practice / Good tags | Full | 14-day rule, same as original |
| Next Recommended Lesson, Reset Progress | Full | Points and streak survive reset |
| Browser spreadsheet simulator | Full | Small grids (≤ 30×10), formula bar, cell selection |
| Formula answer checking | Full | Compare computed value + required function |
| Keyboard shortcut drills | Full | Windows + Mac key maps; mobile shows "Skip section" |
| Lesson video | Lite | YouTube embed per lesson; record later |
| Show answer, skip, previous, first-try accuracy, last completed | Full |  |
| AI Formula Assistant (hints) + thumbs up/down | Full | One LLM call per hint request |
| Points, daily streak, today's high scores and high streaks | Full | Daily reset at midnight UTC |
| Daily challenge + worldwide leaderboard + 7-day accuracy trend | Full | 5 random questions from learned skills |
| 68 lessons across 15 modules | Full | Drafted with an LLM, human-checked |
| 4 projects (Trout free; UFO, Wine, Interview premium) | Lite | Guided steps on a downloadable .xlsx + checks in simulator |
| Free lesson limit + paywall | Full | 3 free lessons, then sign-in, then paywall |
| Premium: monthly / annual / lifetime | Full | Stripe (USD) + Razorpay (INR) |
| Certificate generation, PDF, LinkedIn add, public verify page | Full | Unique credential ID |
| Group admin portal | Lite | Admin sees members' progress table |
| Social share (+500 points for LinkedIn share) | Full | Honour system, once per user |
| Function reference blog | Lite | 10 articles generated from lesson content |
| SQL track | Later | Same engine pattern, Phase 7 |

## Architecture

The heavy work (formula calculation, shortcut detection) runs in the learner's browser, so answer checking is instant and the server stays tiny.

&#91;embedded content: system architecture · browser, API, three services\]

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js + TypeScript + Tailwind | One codebase for pages, SEO and API routes |
| Formula engine | Own parser + dependency graph; functions from formula.js (MIT) | MIT keeps the code closed; formula.js supplies the Excel functions |
| Grid UI | Custom React grid (lesson sheets are tiny) | Avoids heavy, licensed spreadsheet widgets |
| Database + auth | Supabase (Postgres, row-level security, Google login) | Auth and DB in one afternoon |
| Payments | Stripe (USD) + Razorpay (INR) | Both behind one PaymentProvider interface: UPI in India, cards globally |
| AI hints | Gemini API via a server route (model name in env var GEMINI\_MODEL) | Key stays secret; rate-limited per user |
| Certificates | @react-pdf/renderer + `/verify/[id]` page | PDF and public verification |
| Hosting | Vercel | Deploy on every push |

## System design (the agent's spec)

This section is the contract the coding agent builds against: each part says what it is, its exact interface, and when it counts as done. If the agent wants to change an interface, it updates this doc first.

### 1. Repo layout

```text
excel-clone/
  apps/web/                      Next.js app
    app/(marketing)/             landing, pricing, /verify/[id], blog
    app/(app)/                   dashboard, lesson/[id], project/[id], daily, admin
    app/api/                     route handlers (§5)
  packages/engine/               tokenizer, parser, evaluator, dependency graph — pure TS, no DOM
  packages/grader/               formula + shortcut grading — pure TS
  packages/payments/             PaymentProvider interface, razorpay.ts, stripe.ts
  content/lessons/<module>/<id>.json
  content/projects/<id>/         project.json + dataset.xlsx
  content/daily-bank.json
  scripts/validate-content.ts    runs every solution through the engine
  supabase/migrations/*.sql
  CLAUDE.md                      agent rules (§8)
```

Why `engine` and `grader` are separate pure packages: the same code runs in the browser (instant feedback) and on the server (trusted grading). Write once, trust twice.

### 2. Core flow: a learner completes a lesson

1. Learner types `=SUMIF(...)` in a cell → `engine` recalculates in the browser → `grader` compares → "Correct! +10" shows instantly.
2. On the last step, the browser sends `POST /api/progress` with `{ lessonId, answers: [{ stepId, input }] }`.
3. The server loads the lesson JSON, re-runs `grader` on every answer, and only then writes `lesson_progress`, `points_log` and `streaks`.
4. Response `{ points, streak, completed, nextLessonId }` updates the dashboard.
5. Signed-out learners: answers go to `localStorage` key `ee_progress`; on first sign-in the browser posts them to `POST /api/progress/merge`, where the server re-grades and saves them.

### 3. Formula engine (`packages/engine`)

Pipeline: **tokenize → parse (Pratt parser) → AST → evaluate**, with function calls dispatched to formula.js.

| Must support | Detail |
| --- | --- |
| Literals | numbers, "strings", TRUE/FALSE |
| References | `A1`, `$A$1`, `A1:B10`, whole columns `B:C` (clipped to the grid) |
| Operators (Excel precedence) | `:` range, unary `-`, `%`, `^`, `* /`, `+ -`, `&`, `= <> < > <= >=` — note `=-2^2` is 4 in Excel, because unary minus binds tighter than `^` |
| Functions | every function in the curriculum; name lookup is case-insensitive |
| Criteria strings | `">100"`, `"E*"`, `"?ast"` for SUMIF/COUNTIF/SUMIFS/COUNTIFS |
| Dynamic arrays | UNIQUE, FILTER, SORT spill down/right; `#SPILL!` if blocked |
| Dates | Excel serial numbers (1900 system) |
| Errors | `#DIV/0!` `#N/A` `#VALUE!` `#REF!` `#NAME?` `#NUM!` `#SPILL!`, plus `#CIRC!` for cycles |

Recalculation: keep `dependents: Map<cell, Set<cell>>`; on an edit, collect affected cells, sort them topologically, evaluate in that order; a cycle marks its cells `#CIRC!`.

```ts
type ExcelError = { error: '#DIV/0!' | '#N/A' | '#VALUE!' | '#REF!' | '#NAME?' | '#NUM!' | '#SPILL!' | '#CIRC!' };
type CellValue = number | string | boolean | null | ExcelError;

export class Sheet {
  constructor(grid: (string | number | boolean | null)[][]);
  set(addr: string, input: string): void;      // "=SUM(A1:A3)" or "42"
  get(addr: string): CellValue;
  getFormula(addr: string): string | null;
  functionsUsed(addr: string): string[];        // ["SUMIF"]
}
```

Done when: unit tests cover every operator and error, and `validate-content` passes for every lesson solution.

### 4. Grader (`packages/grader`)

```ts
type GradeResult = { correct: boolean; reason?: 'not_formula' | 'parse_error' | 'wrong_value' | 'missing_function' };
export function gradeFormulaStep(step: FormulaStep, input: string): GradeResult;
export function normaliseKeys(e: KeyboardEvent): string;          // "Ctrl+Shift+ArrowDown"
export function gradeShortcutStep(step: ShortcutStep, pressed: string, os: 'win' | 'mac'): boolean;
```

- Formula: input must start with `=`; build `Sheet(step.grid)`, set `targetCell`, compare to `expectedValue` (numbers within 1e-9, strings exact, errors by code); every name in `mustUse` must appear in `functionsUsed`.
- Shortcut: modifier order is always Ctrl, Alt, Shift, Cmd, then the key; `preventDefault()` on any combo a lesson uses.
- Browser-reserved combos (Ctrl/Cmd + W, T, N, Q, Tab) can't be captured — `validate-content` rejects lessons that use them.

### 5. API contracts

| Method | Route | Auth | Body → response |
| --- | --- | --- | --- |
| POST | /api/progress | user | `{lessonId, answers}` → `{points, streak, completed, nextLessonId}` |
| POST | /api/progress/merge | user | `{lessons: [{lessonId, answers}]}` → `{merged}` |
| GET | /api/dashboard | user | → `{modules: [{id, done, total, tag}], nextLessonId, points, streak, dailyTrend}` |
| POST | /api/progress/reset | user | → `{ok}` (keeps points and streak) |
| POST | /api/hint | user, 20/day | `{lessonId, stepId, input}` → `{hint}` |
| POST | /api/hint/feedback | user | `{hintId, helpful}` → `{ok}` |
| GET | /api/leaderboard?type=points or streak | public | → top 10 for today (UTC) |
| GET | /api/daily | public | → today's 5 questions, picked by a seed from the date |
| POST | /api/daily | user, once/day | `{answers, timeMs}` → `{accuracy, rank}` |
| POST | /api/share-bonus | user, once ever | → `{points}` (+500) |
| POST | /api/checkout | user | `{plan, currency}` → `{provider, payload}` for the provider's checkout |
| POST | /api/webhooks/razorpay | signature | provider event → 200 |
| POST | /api/webhooks/stripe | signature | provider event → 200 |
| POST | /api/certificate | premium + all lessons done | `{name}` → `{credentialId, pdfUrl}` |
| GET | /verify/\[credentialId\] | public page | name, issue date, credential ID |
| GET | /api/admin/groups/\[id\] | group admin | → members with lessons done and accuracy |

### 6. Payments (`packages/payments`)

```ts
type Plan = 'monthly' | 'annual' | 'lifetime';
type EntitlementEvent = {
  eventId: string; userId: string; provider: 'razorpay' | 'stripe'; providerRef: string;
  plan: Plan; status: 'active' | 'cancelled' | 'past_due'; periodEnd: Date | null;
};
export interface PaymentProvider {
  createCheckout(i: { userId: string; email: string; plan: Plan }): Promise<{ payload: unknown }>;
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  toEntitlementEvent(rawBody: string): EntitlementEvent | null;
}
export function providerFor(currency: 'INR' | 'USD'): PaymentProvider; // INR → Razorpay, else Stripe
```

- Default currency from the `x-vercel-ip-country` header (IN → INR); the pricing page has a toggle.
- Prices live in one file, `plans.ts`, per currency.
- Webhook handler: verify signature → insert `eventId` into `webhook_events` (unique; a duplicate means "already done", return 200) → upsert `subscriptions` → recompute the cached `users.is_premium`.
- Premium = any subscription with `status = 'active'` and (`periodEnd` is null or in the future).

### 7. Database and security

Adds two tables to the data model below:

```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  provider text not null, provider_ref text not null,
  plan text not null, status text not null, period_end timestamptz,
  unique (provider, provider_ref)
);
create table webhook_events (event_id text primary key, received_at timestamptz default now());
```

- Row-level security on every table: learners may **read** only their own rows; all **writes** go through API routes using the service key, so points can't be forged from the browser.
- Leaderboards are SQL views over `points_log` and `streaks` filtered to today (UTC).
- Secrets (`SUPABASE_SERVICE_KEY`, provider keys, LLM key) only in server env vars; nothing secret ships to the browser.

### 8. Agent rules (`CLAUDE.md`) and task cards

- One task card per session. Never touch files outside the card's list.
- Engine and grader: write the tests first, then the code.
- Lesson schema (Data model section), API contracts (§5) and the PaymentProvider interface (§6) are frozen; change this doc first, then the code.
- Before saying "done": `pnpm typecheck && pnpm test && pnpm validate-content` all pass.
- Never call the LLM or a payment API from client code.

A task card looks like this:

```markdown
## Task: Formula tokenizer
Goal: turn a formula string into tokens for the parser.
Files: packages/engine/src/tokenizer.ts, packages/engine/test/tokenizer.test.ts
Interface: tokenize(src: string): Token[]
Done when:
- "=SUM(A1:A3)*2" → [FUNC SUM, LPAREN, REF A1, COLON, REF A3, RPAREN, OP *, NUM 2]
- strings with escaped quotes and $A$1 refs tokenize correctly
- all tests pass; no other files changed
```

### 9. Day 1 task cards (run in this order)

Give the agent one card per session. Cards T3 and T4 can run in a second session in parallel once T1 is merged.

```markdown
## T0: Set up the Claude Code workspace (before any app code)
Prerequisites — done by you, not the agent:
- accounts and keys from "Claude Code setup" §1; Claude Code installed and signed in; `gh auth login` done
- this build plan exported as Markdown and saved as docs/plan.md in an empty git repo
Goal: the repo holds every file in Setup §3, so each later session starts with the same rules and guardrails.
Steps:
1. git init if needed; .gitignore covers node_modules, .next, .env.local, .claude/settings.local.json
2. docs/SPEC.md = the "System design" and "Data model and lesson schema" sections of docs/plan.md, copied verbatim
3. docs/tasks/T1.md … T4.md = the task cards in docs/plan.md, copied verbatim
4. CLAUDE.md, .claude/settings.json, .claude/agents/reviewer.md, .claude/skills/new-lesson/SKILL.md exactly as in Setup §4, §5, §7
5. .env.example with names only: NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GEMINI_API_KEY, GEMINI_MODEL
6. Print the `claude mcp add` commands from Setup §6 for me to run — don't run them, they need my sign-in
Files: only those listed above
Done when:
- `git status` shows every file above, and `git check-ignore .env.local` confirms it is ignored
- CLAUDE.md is under 60 lines; .claude/settings.json parses as valid JSON
- one commit: "chore: Claude Code workspace setup"
- after a restart, `/memory` lists CLAUDE.md and `/agents` lists reviewer
```

```markdown
## T1: Scaffold + landing page with waitlist (first deploy)
Goal: a live Excel Guru landing page that collects emails, on the repo every later card builds on.
Time-box: 3 hours. Copy can be rough; ship, then polish on Day 5.
Files: repo root (pnpm workspaces), apps/web/app/(marketing)/page.tsx, apps/web/app/api/waitlist/route.ts,
       supabase/migrations/0000_waitlist.sql, packages/* (empty, one placeholder test each), (CLAUDE.md and .claude/ already exist from T0)
Page sections, in order:
1. Hero: headline + one-line promise + email field and "Join the waitlist" button
2. How it works: 3 steps (pick a lesson → type real formulas → get instant feedback)
3. What you'll learn: the 15 module names from the curriculum
4. Pricing: monthly + annual, INR or USD by visitor country (values from lib/plans.ts)
5. FAQ: 5 questions; footer with privacy + terms links
Waitlist: POST /api/waitlist {email, source} → insert into `waitlist` (email unique, created_at, country);
          invalid email → 400; duplicate → 200 with "already on the list"
Also: page title, meta description, OG image, analytics page-view + waitlist-submit events
Done when:
- preview URL loads on desktop and a phone, Lighthouse performance ≥ 90
- a real email submitted from the phone appears in the Supabase `waitlist` table
- `pnpm typecheck && pnpm test` pass; no secret committed
```

```markdown
## T2: Supabase schema + auth
Goal: users can sign in with Google or email.
Files: supabase/migrations/0001_init.sql, apps/web/lib/supabase/*, apps/web/app/(auth)/*
Done when:
- migration creates all tables in Data model + §7, with row-level security (read own rows only)
- sign in / sign out works on the preview URL
- .env.example lists every key; no secret is committed
```

```markdown
## T3: Formula tokenizer
Goal: turn a formula string into tokens for the parser.
Files: packages/engine/src/tokenizer.ts, packages/engine/test/tokenizer.test.ts
Interface: tokenize(src: string): Token[]
Done when:
- "=SUM(A1:A3)*2" → [FUNC SUM, LPAREN, REF A1, COLON, REF A3, RPAREN, OP *, NUM 2]
- handles strings with doubled quotes, $A$1, B:C, TRUE/FALSE, %, <>, <=, >=, &
- ≥ 25 tests pass; no other files changed
```

```markdown
## T4: Pratt parser
Goal: tokens → AST with Excel precedence.
Files: packages/engine/src/parser.ts, packages/engine/test/parser.test.ts
Interface: parse(tokens: Token[]): Ast
Done when:
- precedence matches §3 ("=-2^2" parses as (-2)^2; "=1+2*3" as 1+(2*3); "=A1&B1=C1" as (A1&B1)=C1)
- nested functions and empty arguments ("=IF(A1,,0)") parse
- clear error for unbalanced parentheses
- ≥ 25 tests pass
```

## Claude Code setup (do this before T1, about 45 minutes)

Claude Code only knows what the repo and its config tell it. This section is that config: the accounts it needs, the files it reads every session, the guardrails it can't skip, and the loop you run for each task card.

**Who does what.** You do steps 1–2 by hand: creating accounts, copying keys and installing Claude Code are things the agent can't do for itself. Claude Code then builds steps 3–7 as task card **T0**, the first card of the build, before any app code. The Stop hook skips its checks until `package.json` exists, so T0 isn't blocked by tests that can't run yet.

### 1. Accounts and keys

| Service | Why | What to get | Where it goes |
| --- | --- | --- | --- |
| Claude (Pro/Max plan or Console) | Runs Claude Code | Sign in on first `claude` run | — |
| GitHub | Repo, PRs, history | `gh` CLI, then `gh auth login` | Your machine |
| Vercel | Hosting, preview per PR | Account linked to the repo | Env vars in the Vercel dashboard |
| Supabase — two projects, `dev` and `prod` | Database + auth | Project URL, anon key, service-role key per project | `dev` in `.env.local`; `prod` only in Vercel |
| Razorpay (test mode) | INR payments | Key ID, key secret, webhook secret | `.env.local` |
| Stripe (test mode) | USD payments | Secret key, webhook secret; Stripe CLI for local webhooks | `.env.local` |
| Gemini | AI hints | API key | `.env.local` as `GEMINI_API_KEY` |

### 2. Machine setup

```bash
# Node 20+ (LTS) and pnpm
corepack enable && corepack prepare pnpm@latest --activate

# Claude Code — macOS / Linux / WSL
curl -fsSL https://claude.ai/install.sh | bash
# Windows PowerShell instead:  irm https://claude.ai/install.ps1 | iex
claude --version

# CLIs the agent will drive (cheaper on context than MCP for the same job)
gh auth login
npm i -g vercel
npx supabase --version
# Stripe CLI: see Stripe's install docs for your OS
```

### 3. Files Claude Code reads

```text
CLAUDE.md                          short rules, loaded every session (keep under ~60 lines)
docs/SPEC.md                       the System design section of this plan, copied in
docs/tasks/T1.md … T4.md           one task card per file
.claude/settings.json              permissions + hooks (committed)
.claude/settings.local.json        your personal overrides (git-ignored)
.claude/agents/reviewer.md         fresh-eyes reviewer subagent
.claude/skills/new-lesson/SKILL.md how to write and validate a lesson file
.mcp.json                          shared MCP servers — no secrets in it
.env.example                       every env var name, no values (committed)
.env.local                         real dev secrets (git-ignored)
```

Why split it this way: CLAUDE.md is loaded into every session, so a long file crowds out the actual task and rules get ignored. The full spec lives in `docs/SPEC.md` and is read only when a card points to it; the lesson skill loads only when lessons are being written.

### 4. CLAUDE.md (paste as is)

```markdown
# Excel Guru
Interactive Excel lessons. Full spec: docs/SPEC.md — read the section your task card names before coding.

## Commands
- pnpm dev                run the app
- pnpm test               unit tests (vitest)
- pnpm typecheck          tsc across all workspaces
- pnpm validate-content   runs every lesson solution through the engine

## Rules
- Work only on the task card you were given (docs/tasks/). Touch only the files it lists.
- packages/engine and packages/grader: write tests first; pure TypeScript, no DOM or Node APIs.
- Lesson schema, API contracts and the PaymentProvider interface are frozen. Propose a change; don't make it.
- Never call Gemini, Razorpay or Stripe from client code. Secrets only via process.env on the server.
- Never read or print .env.local. Env var names are in .env.example.
- Prices come only from apps/web/lib/plans.ts.
- Done = typecheck, test and validate-content all pass. Paste the output as evidence.
```

### 5. Permissions and hooks (`.claude/settings.json`)

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(gh pr create *)"
    ],
    "deny": [
      "Read(./.env.local)",
      "Bash(git push --force *)",
      "Bash(npx supabase db reset *)"
    ]
  },
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "[ ! -f package.json ] || (pnpm -s typecheck 1>&2 && pnpm -s test 1>&2) || exit 2" }
        ]
      }
    ]
  }
}
```

- **allow** removes approval prompts for safe, routine commands; **deny** blocks the few actions that could leak a secret or destroy data.
- The **Stop hook** runs typecheck and tests every time the agent tries to finish. If they fail, it exits with code 2, the agent sees the errors and must keep fixing. A rule in CLAUDE.md is a request; a hook is enforced.

### 6. MCP servers (add only these)

| Server | Why | Scope | How |
| --- | --- | --- | --- |
| Supabase, **dev project only, read-only** | Inspect schema, check rows while debugging | local (your auth stays off git) | `claude mcp add --transport http supabase "<URL from Supabase's MCP docs, with your dev project ref and read-only on>"` |
| Stripe (test mode) | Create test products and prices for USD plans | local | `claude mcp add --transport http stripe https://mcp.stripe.com` then `/mcp` to sign in |
| GitHub, Vercel | — | — | Use the `gh` and `vercel` CLIs instead |

Never connect the `prod` database to the agent. Check connections with `/mcp`.

### 7. Reviewer subagent and lesson skill

```markdown
<!-- .claude/agents/reviewer.md -->
---
name: reviewer
description: Fresh-eyes review of the current diff against its task card and docs/SPEC.md
tools: Read, Grep, Glob, Bash
---
Review only the diff (git diff main...HEAD) against the task card named in the request.
Check: every "Done when" item is met with evidence; no files outside the card changed;
no secret and no client-side call to Gemini or a payment API; edge cases in the card have tests.
Report only gaps that affect correctness or the card. No style nits.
```

```markdown
<!-- .claude/skills/new-lesson/SKILL.md -->
---
name: new-lesson
description: Write or fix a lesson JSON file in content/lessons following the schema in docs/SPEC.md
---
1. Read the "Data model and lesson schema" section of docs/SPEC.md and one gold lesson in content/lessons/sum/.
2. Write content/lessons/<module>/<id>.json.
3. Every formula step needs grid, targetCell, expectedValue, mustUse, solution and explain.
4. Avoid browser-reserved shortcuts (Ctrl/Cmd + W, T, N, Q, Tab).
5. Run pnpm validate-content and fix until it passes.
```

### 8. The loop for every task card

1. Fresh session per card: run `claude` in the right folder; `/clear` before the next card.
2. Plan mode (`Shift+Tab` until it shows plan mode): *"Read docs/tasks/T3.md and docs/SPEC.md §3. Make a plan."* Read the plan; correct it before any code is written.
3. Approve the plan. The agent builds; the Stop hook keeps it going until typecheck and tests are green.
4. *"Use the reviewer subagent on this diff for T3."* Fix only real gaps.
5. You read the diff, then *"commit and open a PR"*. Merge; Vercel builds a preview.
6. If you've corrected the same mistake twice, `/clear` and restart the card with a sharper prompt.

Parallel sessions (engine and platform at once): give each its own git worktree so edits never collide.

```bash
git worktree add ../excel-guru-engine -b engine
cd ../excel-guru-engine && claude
```

Sources: [Quickstart](https://code.claude.com/docs/en/quickstart.md) · [Best practices](https://code.claude.com/docs/en/best-practices.md) · [MCP](https://code.claude.com/docs/en/mcp.md) · [Memory / CLAUDE.md](https://code.claude.com/docs/en/memory.md) · [Hooks](https://code.claude.com/docs/en/hooks-guide.md) · [Worktrees](https://code.claude.com/docs/en/worktrees.md)

## Data model and lesson schema

Seven tables carry the whole product; lessons live as JSON in the repo, not in the database, so content changes ship with a git push.

| Table | Key columns | Used by |
| --- | --- | --- |
| users | id, email, name, is\_premium, plan, created\_at | Auth, paywall |
| lesson\_progress | user\_id, lesson\_id, completed\_at, first\_try\_correct, attempts | Dashboard tags, accuracy, next lesson |
| points\_log | user\_id, points, reason, created\_at | Today's high scores, share bonus |
| streaks | user\_id, current, longest, last\_active\_date | Today's high streaks |
| daily\_challenge\_scores | user\_id, date, accuracy, time\_ms | Global rank, 7-day trend |
| certificates | credential\_id, user\_id, name, issued\_at | PDF, verify page |
| groups / group\_members | group\_id, admin\_id, user\_id | Admin portal |

One lesson file, the contract between Lane A and Lane C:

```json
{
  "id": "sumif-1",
  "module": "sum",
  "title": "SUMIF Function",
  "free": false,
  "video": "https://youtu.be/...",
  "steps": [
    {
      "type": "formula",
      "prompt": "In D2, total the sales for the East region.",
      "grid": [["Region","Sales"],["East",120],["West",80],["East",50]],
      "targetCell": "D2",
      "expectedValue": 170,
      "mustUse": ["SUMIF"],
      "solution": "=SUMIF(A2:A4,\"East\",B2:B4)",
      "explain": "SUMIF(range, criteria, sum_range) adds B only where A matches."
    },
    {
      "type": "shortcut",
      "prompt": "Select to the bottom of the column.",
      "keys": { "win": "Ctrl+Shift+ArrowDown", "mac": "Cmd+Shift+ArrowDown" }
    },
    { "type": "info", "text": "Tip: criteria can use wildcards like \"E*\"." }
  ]
}
```

Three step types (`formula`, `shortcut`, `info`) plus a fourth, `mcq`, for daily-challenge questions, cover every lesson on the original site.

## Day-by-day plan

Each day ends with a working deploy, so Monday is a launch, not a gamble. Lanes: **A** = simulator and lesson player, **B** = platform, **C** = content.

With one person + a coding agent: A and B are two agent sessions in separate git worktrees, each given one task card at a time (System design §8); C is you, reviewing lessons while the agents build. Day 1 is today afternoon: first the Claude Code setup (about 45 minutes), then T1 (landing page), then the parser.

### Phase 1 · Thu 12 Nov — Foundations and the simulator

- [ ] First T0: Claude Code builds its own workspace setup (about 30 minutes, after your human-only steps). Then, time-boxed to 3 hours: landing page live on Vercel with a waitlist form (task card T1)
- [ ] B: Auth (Google + email), `users` table, protected routes
- [ ] A: Grid component (cells, formula bar, selection) + formula engine wired; type `=SUM(A1:A3)` and see 6
- [ ] A: Lesson player reads a JSON file and renders `info` and `formula` steps
- [ ] C: 3 gold lessons + lesson schema frozen; Sum, Count, Logical modules generated
- [ ] End of day: one lesson playable end to end on the live URL

### Phase 2 · Fri 13 Nov — The learning loop

- [ ] A: Answer checker (value match + `mustUse`), Check / Show Answer / Skip / Previous, Enter-to-submit
- [ ] A: `shortcut` steps: keydown normaliser, Win/Mac maps, mobile and Mac warnings with Skip section
- [ ] B: `lesson_progress` writes; first-try accuracy; last completed; module completion counts
- [ ] B: Dashboard: module cards, Low Accuracy / Needs Practice / Good tags, Next Recommended Lesson, Reset Progress
- [ ] C: Lookup, Index Match, Text Search, Text Manipulation; validation script in CI
- [ ] End of day: a learner can do all Sum–Text lessons and see progress

### Phase 3 · Sat 14 Nov — Engagement and money

- [ ] B: Points, streaks, today's high scores and streaks leaderboards; +500 LinkedIn share bonus
- [ ] B: Free-lesson limit (3 anonymous, then sign-in, then paywall); Stripe + Razorpay checkout for monthly / annual / lifetime; webhooks set `is_premium`; cancel via customer portal
- [ ] A: AI Formula Assistant (hint endpoint with the step's prompt, grid and the learner's wrong answer) + thumbs up/down
- [ ] A: Video embed per lesson; downloadable .xlsx fallback per lesson
- [ ] C: Remaining 29 lessons + 4 project datasets and steps
- [ ] End of day: payment works in test mode; all 68 lessons in the repo

### Phase 4 · Sun 15 Nov — Certificates, daily challenge, projects

- [ ] B: Certificate flow (name confirm, credential ID, PDF, Add to LinkedIn link, public `/verify` search page)
- [ ] B: Group admin portal (admin sees members' progress table); invite link
- [ ] A: Daily challenge page (5 seeded questions per date, timer, accuracy, global rank, worldwide leaderboard, 7-day trend on dashboard)
- [ ] A: Projects page with premium lock modals; project player reuses lesson player
- [ ] C: Daily-challenge bank (150 items), 10 function articles, landing page copy, pricing page FAQ
- [ ] End of day: feature-complete on staging

### Phase 5 · Mon 16 Nov — Harden and launch

- [ ] All: Full playthrough of every lesson by someone who didn't write it; fix list triaged by 2 pm
- [ ] A: Cross-browser pass (Chrome, Safari, Edge, Firefox, one phone); loading and error states
- [ ] B: Payments to live mode, refunds tested, row-level security on all tables, rate limit on AI hints
- [ ] B: SEO (meta, sitemap, OG images), privacy + terms pages, analytics events
- [ ] C: Launch posts (LinkedIn, X, Product Hunt draft), 10 beta users invited
- [ ] End of day: public launch

## Content pipeline: 68 lessons in 3 days

The math: 68 lessons ÷ 3 days ≈ 23 lessons a day ≈ 3 an hour. That only works as an assembly line.

1. **Day 1, first 3 hours:** write 3 "gold" lessons by hand (SUM, VLOOKUP, a shortcut lesson). They become the style guide and the few-shot examples.
2. **Generate:** one LLM prompt per module, fed the schema, the gold lessons and the function list; output = JSON files for that module.
3. **Auto-validate:** a script loads each file, runs every `solution` through the same formula engine the simulator uses and checks it equals `expectedValue`. Broken files fail CI. This catches most LLM mistakes for free.
4. **Human review (≈8 min/lesson):** play the lesson in the real player; fix wording, difficulty and the explanation.
5. **Projects:** build each of the 4 datasets as an .xlsx (public datasets for UFO sightings, wine consumption, trout counts; a synthetic sales file for the interview test), then 8–12 checked steps each.

| Day | Modules | Lessons |
| --- | --- | --- |
| Thu 12 | Gold lessons, Sum, Count, Logical | 17 |
| Fri 13 | Lookup, Index Match, Text Search, Text Manipulation | 22 |
| Sat 14 | Dates, Statistical, Shortcuts (both), Tables, Other, Array, Combined | 29 + 4 projects |
| Sun 15 | Daily-challenge question bank (150 MCQ/formula items), 10 blog articles | — |

## Later phases (after Mon 16 Nov)

Phases 1–5 are the 5-day parity build above. Everything below is optional; items tagged **\[10x\]** come from the teardown's 10x ideas and are picked only once real users show where the product is weak.

| Phase | Window | Theme | Items | Category |
| --- | --- | --- | --- | --- |
| 6 | Week 2 | Stabilise | Bug fixes from first users, analytics (PostHog), real lesson videos, remaining blog articles | Parity |
| 7 | Weeks 3–4 | Second track | SQL Exercises on the same player (SQLite in the browser via sql.js) | Parity |
| 8 | Month 2 | Learning engine | AI Socratic tutor with error diagnosis; per-skill spaced repetition; 10-min placement test | **\[10x\]** optional |
| 9 | Month 2–3 | Platform parity | Mac/Google Sheets shortcut sets, mobile "read the formula" mode, INR purchasing-power pricing | **\[10x\]** optional |
| 10 | Months 3–5 | Real jobs | Graded job simulations on messy data, role tracks (finance, FP&A, analyst), modern Excel (Power Query, LET/LAMBDA, Copilot, Python in Excel) | **\[10x\]** optional |
| 11 | Months 4–6 | Credential | Proctored skill-scored assessment, public skill profile, Indeed / MO-200 mock tests | **\[10x\]** optional |
| 12 | Months 6–9 | B2B | Self-serve team seats + SSO, manager skill heatmaps, hiring assessments, custom company content, SCORM export | **\[10x\]** optional |
| 13 | Months 9+ | Distribution | Excel add-in coach, leagues and duels, cohorts, community solutions, multi-language | **\[10x\]** optional |

## Risks and what to cut first

If a day slips, cut from the top of this list; never cut the simulator, answer checking or payments.

| Risk | Mitigation | Cut if late |
| --- | --- | --- |
| Simulator takes longer than Day 1 | Read-only grid + single formula input box first; full cell editing Day 2 | Multi-cell drag selection |
| Shortcut detection breaks on Mac / browsers | Block browser defaults with `preventDefault`; test Chrome, Safari, Edge Day 3 | Shortcuts that the browser itself steals (Ctrl+W, Ctrl+N) |
| LLM lessons have wrong answers | Auto-validation script + human review | Combined Skills module |
| Payment approval delays (Stripe/Razorpay KYC) | Start account setup tonight (Wed 11) | Launch with "Lifetime" only |
| Formula engine license | Decided: own parser + formula.js; budget +1 day, paid for by cutting the blog first | — |
| Scope creep from 10x ideas | Hard rule: nothing from Phase 6+ before Mon 16 | — |

Cut order if badly late: blog → admin portal → projects UFO/Wine → videos → daily challenge trend chart.

## Concepts to understand before building

Four ideas do most of the work in this product. Understand them and the code mostly writes itself.

1. **A spreadsheet is a dependency graph.** Each cell is a node; `=A1+B1` draws arrows from A1 and B1 into C1. When A1 changes, the engine walks the arrows and recomputes only what depends on it (a topological sort). That's why you borrow an engine: the graph, the parser and 400 Excel functions are the hard part.
2. **Grade the result, not the spelling.** `=SUM(B2:B4)` and `=B2+B3+B4` are both right. If you compare strings you'll fail correct learners. So compute the learner's formula, compare the *value* to `expectedValue`, and use `mustUse` only to insist on the function being taught.
3. **A keyboard shortcut is just a set of keys pressed together.** The browser fires a `keydown` event with flags `ctrlKey`, `shiftKey`, `metaKey`, `altKey` and a `key`. Normalise that into a string like "Ctrl+Shift+ArrowDown", compare with the lesson's string for the user's OS, and call `preventDefault()` so the browser doesn't act on it first.
4. **Content as data.** One player + many JSON files means a non-programmer can add lessons, and the LLM can generate them. This separation is the single decision that makes 5 days possible.

Test yourself, Feynman style: explain to a friend why comparing values beats comparing formula text. If you can do it with one example, you're ready to build the checker.
