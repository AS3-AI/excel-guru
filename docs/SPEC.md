# Excel Guru — SPEC

Copied verbatim from docs/plan.md ("System design" and "Data model and lesson schema"). Change the plan first, then this file.

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
