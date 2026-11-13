# Excel Guru — SPEC

Copied verbatim from docs/plan.md ("System design", "Data model and lesson schema" and "Product spec from the full teardown"). Change the plan first, then this file.

## System design (the agent's spec)

This section is the contract the coding agent builds against: each part says what it is, its exact interface, and when it counts as done. If the agent wants to change an interface, it updates this doc first.

### 1. Repo layout

```text
excel-guru/
  apps/web/                      Next.js app
    app/(marketing)/             landing, pricing, verify, learn/[function], help, terms, privacy
    app/(auth)/                  signup, login, onboarding
    app/(app)/                   dashboard, modules/[slug], lesson/[id], review, daily,
                                 projects/[slug], profile, admin
    app/api/                     route handlers (System design §5 + Product spec §15)
    lib/plans.ts                 the only place prices live
    lib/tokens.css               design tokens (Product spec §14)
  packages/engine/               tokenizer, parser, evaluator, dependency graph — pure TS, no DOM
  packages/grader/               formula, select, shortcut, accept and mcq grading — pure TS
  packages/payments/             PaymentProvider interface, razorpay.ts, stripe.ts
  content/lessons/<module>/<id>.json   86 files, schema v2
  content/order.json             global recommended order (the only place order lives)
  content/review-bank.json       review-mode items
  content/daily-bank.json        daily-challenge items
  content/daily/YYYY-MM-DD.json  optional override for one date
  content/projects/<slug>/       project.json + dataset.xlsx + finished.xlsx
  content/learn/<function>.mdx   SEO articles
  scripts/validate-content.ts    runs every solution through the engine
  supabase/migrations/*.sql
  docs/SPEC.md, docs/teardown.md, docs/tasks/
  CLAUDE.md                      agent rules (§8)
```

Why `engine` and `grader` are separate pure packages: the same code runs in the browser (instant feedback) and on the server (trusted grading). Write once, trust twice.

### 2. Core flow: a learner completes a lesson

1. Learner types `=SUMIF(...)` in a cell → `engine` recalculates in the browser → `grader` compares → "Correct! +10 pts" shows instantly.
2. Every attempt, right or wrong, is kept in order: `{ stepId, input, showedAnswer }`.
3. When the learner reaches `requiredCorrect` correct answers, the browser sends `POST /api/progress` with `{ lessonId, attempts }`.
4. The server loads the lesson JSON, re-runs `grader` on every attempt, works out first-try accuracy and points from them, and only then writes `step_attempts`, `lesson_progress`, `lesson_completions`, `points_log` and `streaks`.
5. Response `{ points, streak, firstTryAccuracy, nextLessonId }` feeds the celebration screen and the dashboard.
6. Signed-out learners: attempts go to `localStorage` key `eg_progress`; on first sign-in the browser posts them to `POST /api/progress/merge`, where the server re-grades and saves them.

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

Added for schema v2:

```ts
export function gradeSelectStep(step: SelectStep, selection: string): boolean;   // "B2", "B2:C4", "B:B", "3:3"
export function gradeSequenceStep(step: ShortcutStep, pressed: string[], os: 'win' | 'mac'): boolean;
export function gradeMcqStep(step: McqStep, choice: number): boolean;
export function gradeAcceptStep(step: PictureStep | ProjectStep, input: string): boolean; // normalised match against accept[]
```

### 5. API contracts

| Method | Route | Auth | Body → response |
| --- | --- | --- | --- |
| POST | /api/progress | user | `{lessonId, attempts}` → `{points, streak, firstTryAccuracy, nextLessonId}` |
| POST | /api/progress/merge | user | `{lessons: [{lessonId, attempts}]}` → `{merged}` |
| GET | /api/dashboard | user | → `{modules: [{id, done, total, tag}], nextLessonId, points, streak, dailyTrend}` |
| POST | /api/progress/reset | user | → `{ok}` (keeps points and streak) |
| POST | /api/explain | any; 20 uncached a day per user or IP | `{lessonId, stepId, input}` → `{id, text, cached}` |
| POST | /api/explain/\[id\]/rate | user | `{helpful}` → `{ok}` |
| GET | /api/leaderboard?type=points or streak | public | → top 3 for today (IST) |
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
- Webhook handler: verify signature → insert `eventId` into `webhook_events` (unique; a duplicate means "already done", return 200) → upsert `subscriptions` → recompute the cached `profiles.is_premium`.
- Premium = any subscription with `status = 'active'` and (`periodEnd` is null or in the future), or membership of a group with has\_paid\_access.

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
- Leaderboards are SQL views over `points_log` and `streaks` filtered to today in IST (Asia/Kolkata).
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, provider keys, LLM key) only in server env vars; nothing secret ships to the browser.

### 8. Agent rules (`CLAUDE.md`) and task cards

- One task card per session. Never touch files outside the card's list.
- Engine and grader: write the tests first, then the code.
- Lesson schema v2 (Product spec §5), API contracts (§5 here plus Product spec §15) and the PaymentProvider interface (§6) are frozen; change this doc first, then the code.
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
- this build plan exported as Markdown and saved as docs/plan.md, and excelexercises-teardown.md saved as docs/teardown.md, in an empty git repo
Goal: the repo holds every file in Setup §3, so each later session starts with the same rules and guardrails.
Steps:
1. git init if needed; .gitignore covers node_modules, .next, .env.local, .claude/settings.local.json
2. docs/SPEC.md = the "System design" and "Data model and lesson schema" and "Product spec from the full teardown" sections of docs/plan.md, copied verbatim
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
- migration creates all tables in Data model, System design §7 and Product spec §15, with row-level security (read own rows only)
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

### 10. Phase 1 completion cards (added 13 Nov)

Phase 1 ends with one lesson playable end to end on the live URL. Lane A runs T5 → T7 → T8 → T9 → T10 in order (T9 can start right after T5); Lane B runs T2 in parallel. T6 is reserved for dynamic-array spilling (UNIQUE, FILTER, SORT, #SPILL!) and lands before the Array formulas lessons. T7 pulls formula grading forward from Phase 2 because a lesson can only be played end to end if its answers are checked; the Check / Show Answer / Skip / Previous UI stays in Phase 2.

```markdown
## T5: Evaluator + Sheet
Goal: AST → value on a small grid, so `=SUM(A1:A3)` on [[1],[2],[3]] gives 6. Read docs/SPEC.md §3 first.
Time-box: 4 hours. Dynamic arrays (UNIQUE/FILTER/SORT spill, #SPILL!) are out of scope → T6.
Files: packages/engine/src/address.ts, packages/engine/src/evaluator.ts, packages/engine/src/functions.ts,
       packages/engine/src/sheet.ts, packages/engine/src/index.ts, packages/engine/package.json (add @formulajs/formulajs),
       packages/engine/test/address.test.ts, packages/engine/test/evaluator.test.ts, packages/engine/test/sheet.test.ts
Interface (frozen, SPEC §3):
  type ExcelError = { error: '#DIV/0!' | '#N/A' | '#VALUE!' | '#REF!' | '#NAME?' | '#NUM!' | '#SPILL!' | '#CIRC!' };
  type CellValue = number | string | boolean | null | ExcelError;
  class Sheet { constructor(grid); set(addr, input); get(addr): CellValue; getFormula(addr): string | null; functionsUsed(addr): string[] }
  index.ts exports Sheet, tokenize, parse and the types above.
Rules:
- address.ts: "A1" ↔ {row, col} (0-based); strip `$` (the AST keeps it, e.g. "$A$1"); grid[0][0] is A1.
  Off-sheet refs (A0, XFE1) → #REF!. Whole columns B:C are clipped to the grid's used rows.
- Operators: + - * / ^ with Excel coercion ("3"+1 = 4, TRUE+1 = 2, "abc"+1 = #VALUE!, empty cell = 0);
  & joins as text (TRUE&"" = "TRUE", 1.5&"" = "1.5"); % divides by 100; comparisons are case-insensitive for text,
  and number < text < boolean when types differ. An error operand propagates (left one first).
- Functions: name lookup case-insensitive; dispatch to formula.js; map its Error results to ExcelError;
  unknown function or NAME → #NAME?. Ranges reach functions as 2-D arrays; empty cells as null.
  Empty arguments (Ast "empty") are passed as undefined — IF(A1,,0) returns 0 when A1 is FALSE.
- IF, IFERROR, AND, OR are lazy (only evaluate the branch taken), so IF(TRUE,1,1/0) = 1.
- A formula whose result is a range (=A1:A3) returns #VALUE! until T6 adds spilling.
- Formula input that fails tokenize/parse: set() throws the TokenizeError/ParseError (the lesson UI shows its
  message and the grader maps it to 'parse_error'); the cell keeps its previous content.
- Literal input: "42" → 42, "TRUE" → true, "" → null, anything else → string. A leading "=" means formula.
- Recalc: dependents: Map<cell, Set<cell>>; on set(), recompute affected cells in topological order.
  A cycle marks every cell in it #CIRC!; breaking the cycle recomputes them.
- functionsUsed returns unique uppercase names in first-use order, nested calls included.
- Pure TypeScript: no DOM, no Node APIs. Write tests first.
Done when:
- new Sheet([[1],[2],[3]]) then set("B1","=SUM(A1:A3)") → get("B1") === 6; set("A1","10") → get("B1") === 15
- =SUMIF(A2:A4,"East",B2:B4) on [["Region","Sales"],["East",120],["West",80],["East",50]] = 170;
  the SPEC §5 (schema v2) example =COUNT(B2:B6) = 4; COUNTIF with ">100", "E*", "?ast" criteria
- =-2^2 = 4, =2^3^2 = 64, =1+2*3 = 7, ="a"&"b"="AB" is TRUE, =50% = 0.5
- every ExcelError except #SPILL! has a test that produces it (#DIV/0! from =1/0, #N/A from VLOOKUP miss,
  #VALUE! from ="a"+1, #REF! from =A0, #NAME? from =NOPE(1), #NUM! from =SQRT(-1), #CIRC! from A1=B1, B1=A1)
- functionsUsed("=IF(SUM(A1:A2)>1,ROUND(A1,0),0)") → ["IF","SUM","ROUND"]
- ≥ 40 tests across the three test files pass; typecheck passes; no other files changed
```

```markdown
## T7: Lesson types + formula grading
Goal: schema v2 as TypeScript types, and gradeFormulaStep so a lesson's formula steps can be checked. Read docs/SPEC.md §4 and Product spec §5 first.
Files: packages/grader/src/types.ts, packages/grader/src/formula.ts, packages/grader/src/index.ts,
       packages/grader/package.json (add "@excel-guru/engine": "workspace:*"), packages/grader/test/formula.test.ts,
       packages/grader/test/placeholder.test.ts (delete)
Interface (frozen, SPEC §4):
  type GradeResult = { correct: boolean; reason?: 'not_formula' | 'parse_error' | 'wrong_value' | 'missing_function' };
  export function gradeFormulaStep(step: FormulaStep, input: string): GradeResult;
  index.ts exports gradeFormulaStep, GradeResult and every type in types.ts.
Rules:
- types.ts: Lesson {id, module, title, difficulty: 1|2|3, requiredCorrect, isIntro, video: string|null, steps: Step[]};
  Step = FormulaStep | SelectStep | ShortcutStep | McqStep | PictureStep | ProjectStep | InfoStep, discriminated on `type`,
  with every field in the Product spec §5 example; optional activeCell, highlightCells, postcondition, mobileButtons on every step.
- Grading order: input not starting with "=" → not_formula; TokenizeError/ParseError from Sheet.set → parse_error;
  value differs → wrong_value; a mustUse name missing from functionsUsed(targetCell) → missing_function.
- Value compare: numbers within 1e-9; strings exact; booleans exact; errors by code; any type mismatch is wrong.
- mustUse comparison is case-insensitive. Pure TypeScript, no DOM or Node APIs. Write tests first.
Done when:
- =SUM(B2:B4) and =B2+B3+B4 both pass a step with no mustUse; =B2+B3+B4 fails with missing_function when mustUse is ["SUM"]
- the Product spec §5 COUNT step (=COUNT(B2:B6) = 4) passes; "SUM(B2:B6)" → not_formula; "=SUM(" → parse_error
- 0.1+0.2 matches expectedValue 0.3; "=1/0" matches expectedValue {"error":"#DIV/0!"}
- ≥ 20 tests pass; typecheck passes; no other files changed
```

```markdown
## T8: validate-content
Goal: `pnpm validate-content` checks every lesson file, so LLM-drafted lessons with wrong answers fail CI. Read Product spec §5 first.
Files: scripts/validate-content.ts, scripts/validate-content.test.ts, scripts/fixtures/** (bad lessons for tests),
       package.json (root: validate-content script + tsx devDependency + @excel-guru/grader workspace dep), content/order.json
Interface: validateContent(dir: string): { file: string; errors: string[] }[]; the CLI prints them and exits 1 if any.
Rules (every check in Product spec §5):
- each file in content/lessons/<module>/<id>.json has id = file name and module = folder name
- every formula step: gradeFormulaStep(step, step.solution) is correct (so solution = expectedValue and uses mustUse)
- every select target ("B2", "B2:C4", "B:B", "3:3") lies inside the step's grid
- no shortcut key uses a browser-reserved combo (Ctrl/Cmd + W, T, N, Q, Tab), win or mac
- step ids are unique within a lesson; at least requiredCorrect gradable steps (anything but info)
- every lesson id appears exactly once in content/order.json, and order.json names no missing lesson
- content/order.json starts as ["intro"] (the Intro lesson lands with Lane C)
Done when:
- one failing fixture per rule above, each reporting a clear message with file and step id
- `pnpm validate-content` exits 0 once content/lessons/intro/intro.json exists and is valid
- tests run under `pnpm test`; typecheck passes; no other files changed
```

```markdown
## T9: Grid component
Goal: an Excel-like grid in the browser wired to the engine, so typing =SUM(A1:A3) over 1, 2, 3 shows 6. Read Product spec §4 first.
Files: apps/web/components/grid/Grid.tsx, apps/web/components/grid/FormulaBar.tsx, apps/web/components/grid/grid.css,
       apps/web/app/(app)/sandbox/page.tsx, apps/web/next.config.ts (transpilePackages for @excel-guru/engine and @excel-guru/grader),
       apps/web/package.json (workspace deps)
Interface: <Grid grid={...} targetCell?="C2" highlightCells?={["B2:B6"]} onCommit?={(addr, input) => void} sheetRef? />
Scope (Phase 1 only; point mode, coloured references and mobileButtons are Phase 2):
- name box with the active cell, ✕ ✓ fx buttons, formula bar; columns A.. and rows 1..8 headers; 7–8 columns × 8 rows from `grid`
- click or arrow keys move a thick selection border; typing starts editing; Enter commits via Sheet.set, Escape cancels, Delete clears
- cells show Sheet.get (errors as their code, e.g. #DIV/0!); the formula bar shows getFormula for the active cell
- targetCell and highlightCells are visibly marked
- a Tokenize/ParseError shows its message inline under the formula bar; never alert()
- colours from apps/web/lib/tokens.css only; works at 375 px wide
Done when:
- on /sandbox, typing 1, 2, 3 in A1:A3 and =SUM(A1:A3) in B1 shows 6; changing A1 to 10 shows 15
- =1/0 shows #DIV/0!; "=SUM(" shows a parse message and keeps the old value
- `pnpm typecheck && pnpm test` pass; `pnpm build` succeeds; no other files changed
```

```markdown
## T10: Lesson player v0
Goal: open /lesson/intro and play it start to finish with no account. Read Product spec §3 and §5 first.
Files: apps/web/lib/lessons.ts, apps/web/lib/lessons.test.ts, apps/web/app/(app)/lesson/[id]/page.tsx,
       apps/web/app/(app)/lesson/[id]/Player.tsx, apps/web/app/(app)/lesson/[id]/player.css
Interface: lessons.ts → getLesson(id): Lesson | null; getOrder(): string[]; nextLessonId(id): string | null
Scope (Phase 1 only; Show Answer, Skip/Previous rules, AI drawer, celebration screen and saving progress are Phase 2+):
- server page loads content/lessons/**/<id>.json and content/order.json at build time; unknown id → notFound()
- centre column: title, % bar (correct ÷ requiredCorrect), question card, then the step
- info step: text + Continue; formula step: prompt + <Grid> with targetCell and highlightCells;
  Check (or Enter) → gradeFormulaStep; correct → "Correct!", the explain text, result written into the cell, Continue;
  wrong → "Not quite" with the reason, try again
- other step types render "Coming soon" + Continue
- lesson completes after requiredCorrect correct answers; when steps run out, cycle from step 4 (decision 19);
  then "Lesson complete" with a link to nextLessonId
- the grid takes keyboard focus on every new step
Done when:
- lessons.ts tests: getLesson("intro") loads; unknown id → null; nextLessonId follows order.json; cycling picks step 4 after the last
- /lesson/intro plays to "Lesson complete" locally and on the Vercel preview, on desktop and a phone
- `pnpm typecheck && pnpm test && pnpm validate-content` pass; no other files changed
```

## Data model and lesson schema

These core tables, plus the ones in Product spec §15, carry the whole product; lessons live as JSON in the repo, not in the database, so content changes ship with a git push.

| Table | Key columns | Used by |
| --- | --- | --- |
| profiles | user\_id (= auth.users.id), email, first\_name, username (unique), is\_premium (cache), plan, linkedin\_url, shared\_on\_linkedin, last\_active\_at, group\_id, cohort, created\_at | Auth, paywall, onboarding, profile, leaderboards, admin |
| lesson\_progress | user\_id, lesson\_id, completed\_at, first\_try\_accuracy, times\_completed — one row per learner and lesson; cleared by Reset Progress | Dashboard tags, accuracy, next lesson |
| points\_log | user\_id, points, reason, created\_at | Today's high scores, share bonus |
| streaks | user\_id, current, longest, last\_active\_date | Today's high streaks |
| daily\_challenge\_scores | user\_id, date, accuracy, time\_ms | Global rank, 7-day trend |
| certificates | credential\_id, user\_id, name, issued\_at | PDF, verify page |
| groups | id, name, admin\_id, has\_paid\_access — membership is profiles.group\_id | Admin portal, institutional premium |

The lesson file is the contract between Lane A and Lane C. Its schema is **v2, in Product spec §5**. The v1 example that stood here is removed so the agent only ever sees one schema.

## Product spec from the full teardown (13 Nov)

The second teardown captured signed-in screens, exact rules from the code, and the paywall triggered live. Everything in this section is new compared with the plan before 13 Nov. Keep the teardown file in the repo as `docs/teardown.md`; this section says what we build, the teardown shows what it looked like.

### 0. Clone boundary

Copy mechanics, flows, page structure and the gamification model. Never copy their lesson prose, question text, datasets, testimonials, logo, name, founder story or colour palette. Every lesson is written fresh by us. The curriculum topics in §6 are generic Excel knowledge.

### 1. Pages and navigation

| Route | Purpose | Access | Lands |
| --- | --- | --- | --- |
| `/` | Landing (hero with one highlighted word, stats bar, logo strip, testimonials, benefit sections, repeated CTAs, footer) | public | T1 |
| `/dashboard` | Progress, next lesson, today's scores and streaks, projects, module grid (§2.4) | public; signed out shows 0 / 85 | Fri A+B |
| `/modules/[slug]` ×15 | Breadcrumb, "x/N Lessons Completed", numbered list; incomplete lessons greyed | public | Fri B |
| `/lesson/[id]` | The player (§3) | Intro free signed out; others need account, then premium | Thu–Fri A |
| `/signup?completed=[id]`, `/login`, `/onboarding` | Sign-up after the first win; onboarding fills the profile when an auth user has no profile row | — | Fri B |
| `/pricing` | Paywall (§2.3) | — | Sat B |
| `/review` | Endless review cards + Suggested Practice (§8) | signed in | Sun A |
| `/profile` | Eight account cards (§10) | signed in | Sun B |
| `/daily` | Daily challenge (§9) | public; scores need sign-in | Sun A |
| `/admin` | Group admin grid + invites (§12) | group admin | Sun B |
| `/verify` and `/verify/[id]` | Certificate search by name or ID; certificate page | public | Sun B |
| `/projects/[slug]` ×4 | Project page (§11) | premium (one free) | Sun A |
| `/learn/[function]`, `/shortcuts/[slug]`, exam-prep pages | SEO articles with a sticky "Continue to X practice →" CTA deep-linking into the matching lesson | public | 10 on Sun C; \~45 more in Phase 6 |
| `/help`, `/terms`, `/privacy`, `/sitemap.xml` | Support and legal | public | Mon B |
| SQL track (`/sql/...`) | Same player, own accent, 23 lessons in 6 modules | same model | Phase 7 |

**Navigation.** Top nav: logo, Dashboard, Review, Blog, an Excel ▾ track switcher (SQL shown as "coming soon"), then Log in / Sign up — or, when signed in, Account ▾ (Profile, Get help, Log out). Player and module pages drop the top nav for a breadcrumb bar: Dashboard › Module › Lesson.

### 2. User flows and exact rules

**2.1 First visit.** Landing CTA "Start free — no sign-up" opens `/lesson/intro` directly. Progress lives in `localStorage`; the sidebar says "Log in to appear on the leaderboard".

**2.2 Sign-up after the first win.** Finishing Intro signed out redirects to `/signup?completed=intro`. Copy angle: create a free profile to save progress and unlock more lessons. Fields: first name, username, email, confirm email, password, plus Google. Testimonials sit beside the form. Signing up merges the local progress (`/api/progress/merge`).

**2.3 Free tier and paywall.**

- A free account gets 2 lessons in total, and Intro counts. Replaying a completed lesson is always allowed.
- Opening any 3rd lesson without premium redirects to `/pricing`, decided on the server before the lesson renders.
- Premium = active subscription, lifetime purchase (if kept), or membership of a group with paid access. Institutional email domains live in a `group_domains` table, never hard-coded.
- Pricing page: headline, 3 benefit bullets, proof images, sticky plan card with radio options (annual first, badge "Most popular"), Upgrade button, "Cancel any time · full refund if unhappy". Prices only from `plans.ts`.

**2.4 Returning learner and dashboard.**

- Dashboard order: headline; **Total Lessons Completed** card with a bar stacked in three colours (Low Accuracy, Needs Practice, Good) and "certificate when all lessons are done"; a row of three cards (Next Recommended Lesson · Today's High Scores top 3 + my points · Today's High Streaks top 3 + my streak); Projects row (4 cards with "PREMIUM" badges); Lessons grid of module cards, each with a thin progress bar.
- Shown only when relevant: "Go to Admin Portal" (group admins), "Generate Certificate" (replaces Next Lesson when all done), Reset Progress link + confirm modal, the one-time share bonus card, and a 7-day daily-challenge accuracy line chart with an empty state.
- Next recommended = first incomplete lesson in the global order. After the last lesson the learner goes to `/review`.

**2.5 Daily loop.** Points reset at midnight IST. Streak: active yesterday → +1; same day → unchanged; older → back to 1. Streak card copy has three states: "Complete a lesson today to start your streak!", "…to reach N days!", "Complete a lesson tomorrow to increase your streak!"

**2.6 Certificate.** Name entered twice with the warning that it can't change; server renders the PDF; the learner lands on `/verify/[id]`; if a certificate exists, the button goes straight there. Share to LinkedIn (Licenses & certifications), social, email; download PDF.

### 3. Lesson player

**Layout (three columns).** Left: every lesson in recommended order, numbered, with an "IN PROGRESS" pill on the current one and "COMPLETE" on finished ones; clicking jumps. Centre: lesson title, % label + progress bar, question card (rich text: bold terms, inline code chips, a bold call to action), then the grid. Right: Today's High Scores, Today's High Streaks, share buttons (LinkedIn, Facebook, X, email), and a ▶ video button that opens a modal when the lesson has a video.

| Footer state | What it shows |
| --- | --- |
| Idle | "Skip question" outline pill; "Previous" when allowed |
| Ready (formula typed) | "Check Answer" + "or press Enter" |
| Correct | Footer turns dark; "Correct!"; "+N pts" count-up; big "Continue →" + "or press Enter"; the step's explanation appears; My Points Today updates live |
| Incorrect | Drawer slides in from the right: header "Incorrect (n)" and ×; "Show Answer" (reveals the solution); AI explanation with typing dots, then 👍 / 👎, a thanks state, and the disclaimer that AI can be wrong |

**Rules.**

- Lesson completes after `requiredCorrect` correct answers; the % bar shows correct ÷ required. Skip adds nothing; Previous goes back one step; when steps run out, cycle from step 4.
- Show Answer becomes available after the first wrong answer.
- On completion: celebration screen for 2.5 seconds (points, streak, first-try accuracy) with a Continue button, then auto-advance to the next recommended lesson.
- The grid takes keyboard focus on every new step; Enter checks and continues; Delete clears.
- Per-lesson badge: last completed date and first-try accuracy.
- Never use `alert()`. Errors show as an inline toast; a connection banner retries automatically.

**Shortcut steps.** No formula bar. A picture or mini grid that changes with each correct key; key-chip hints such as "Hold ⌘ + Shift, press ↓"; the Mac variant is chosen automatically; a "Mobile device detected — Skip section" banner on touch devices; a Mac skip bar when a shortcut has no Mac version. Pattern inside shortcut lessons: introduce, repeat, combine.

### 4. Grid UX that makes it feel like Excel

- Name box with the active cell, ✕ ✓ fx buttons, formula bar, fixed grid of 7–8 columns × 8 rows; target cell highlighted.
- **Point mode:** while typing a formula, after `(`, `,` or an operator, clicking or dragging a cell — or arrow keys, Shift+arrow to extend — inserts the reference; more arrows replace the last inserted reference.
- **Coloured references:** each reference in the formula gets its own colour, and the matching range is outlined in that colour on the grid.
- Space after a column letter or row number inserts a whole-column or whole-row reference.
- Thick selection border; the editor stays visible while pointing; on a correct answer the result is written into the cell.
- `mobileButtons`: tap-to-insert tokens such as `(`, `,`, `:` on phones.
- Selection grading for `select` steps: a cell, range, whole column (`B:B`) or whole row (`3:3`).
- Our grid is small and ships with the page — no 10 MB lazy-loaded spreadsheet library on the first formula step.

### 5. Lesson schema v2 (replaces v1 today, before content generation)

This is the only lesson schema; the v1 example is retired. The example below shows every step type in one file — a real lesson uses a few of them. Step types: `formula`, `select` (click a cell, range, column or row), `shortcut` with `mode: "chord"` (hold keys, press one) or `"sequence"` (Alt key-tips pressed in order), `mcq`, `picture`, `project` and `info`. Every step has an `id`, which the API uses as `stepId`. Optional step fields: `activeCell`, `highlightCells`, `postcondition` (grid or selection shown after success), `mobileButtons`. Lesson fields: `difficulty` (1–3), `requiredCorrect`, `isIntro`, `video`. Order is not stored in the lesson; it lives only in `content/order.json`.

```json
{
  "id": "count-1", "module": "count", "title": "COUNT Function",
  "difficulty": 1, "requiredCorrect": 6, "isIntro": false, "video": null,
  "steps": [
    { "id": "s1", "type": "select", "prompt": "Click cell B2.",
      "grid": [["Item","Qty"],["Pens",12],["Tape","n/a"],["Clips",40],["Glue",7],["Ink",3]], "target": "B2" },
    { "id": "s2", "type": "formula", "prompt": "In C2, count the numbers in B2:B6.",
      "grid": [["Item","Qty"],["Pens",12],["Tape","n/a"],["Clips",40],["Glue",7],["Ink",3]],
      "targetCell": "C2", "expectedValue": 4, "mustUse": ["COUNT"], "solution": "=COUNT(B2:B6)",
      "explain": "COUNT counts cells that hold numbers, so the text in B3 is skipped.",
      "highlightCells": ["B2:B6"], "mobileButtons": ["(", ")", ":"] },
    { "id": "s3", "type": "shortcut", "mode": "chord", "prompt": "Extend the selection one cell right.",
      "keys": { "win": "Shift+ArrowRight", "mac": "Shift+ArrowRight" }, "activeCell": "B2",
      "postcondition": { "selection": "B2:C2" } },
    { "id": "s4", "type": "shortcut", "mode": "sequence", "prompt": "Make the text bold with key tips.",
      "keys": { "win": ["Alt", "H", "1"], "mac": null }, "pics": ["r0.png", "r1.png", "r2.png", "r3.png"] },
    { "id": "s5", "type": "mcq", "prompt": "Which function counts only cells that contain numbers?",
      "options": ["COUNTA", "COUNT", "COUNTBLANK"], "answer": 1 },
    { "id": "s6", "type": "picture", "prompt": "Which function is shown?", "image": "q.png", "accept": ["sumif"] },
    { "id": "s7", "type": "project", "prompt": "What is the total in cell F20?", "file": "dataset.xlsx", "accept": ["1840"] },
    { "id": "s8", "type": "info", "text": "COUNT ignores text and blanks." }
  ]
}
```

- `mac: null` → the Mac skip bar shows. In a sequence, the picture advances one frame per correct key.
- `accept` answers are normalised before comparing: smart quotes → straight, all whitespace removed, lower-cased.
- `validate-content` checks: every formula solution evaluates to `expectedValue`; every `select` target is inside the grid; no browser-reserved shortcuts; step ids are unique within a lesson; each lesson has at least requiredCorrect gradable steps; every lesson id appears exactly once in order.json.

### 6. Curriculum and recommended order

Topics only — all lesson text is ours. Number in brackets = lessons. 86 files in total: Intro plus 85 lessons across 15 modules. Progress counters show x / 85 because Intro sits outside the modules, but Intro does count as one of the two free lessons.

| Module | Lessons |
| --- | --- |
| Intro (1) | Cells, references, selecting a cell, first formula |
| SUM (9) | SUM · AutoSum · intro to SUMIF · SUMIF with sum range · SUMIFS · skill summary · SUMIF practice · SUMIFS practice · debugging SUM functions |
| COUNT (7) | COUNT · COUNTIF · COUNTIFS · practice · skill summary · COUNTA and COUNTBLANK · COUNTIF with wildcards |
| Logical (7) | TRUE/FALSE · AND, OR, XOR · IF · IS functions · IFS · SWITCH · IF combinations |
| Lookup (10) | VLOOKUP · HLOOKUP · VLOOKUP 2 · HLOOKUP 2 · VLOOKUP practice · XLOOKUP · XLOOKUP 2 · more VLOOKUP practice · VLOOKUP approximate match · XLOOKUP with wildcards |
| Text Search (7) | LEN, LEFT, RIGHT · MID · practice · wildcard characters · FIND · SEARCH · TEXTBEFORE and TEXTAFTER |
| Intro to Shortcuts (6) | Alt key tips · text formatting · number formatting · fill right and down · cut, copy, paste · data shortcuts |
| Cell Selection (7) | Arrow keys · selection shortcuts · larger selections · rows and columns · selection 2 · larger selections 2 · skill summary |
| Text Manipulation (4) | CONCAT · TEXTJOIN · UPPER, LOWER, PROPER · SUBSTITUTE |
| Index Match (6) | MATCH · INDEX · INDEX MATCH · skill summary · INDEX MATCH practice · MATCH practice |
| Statistical (7) | AVERAGE · MIN, MAX, LARGE, SMALL · FLOOR and CEILING · practice · ODD and EVEN · MEDIAN · MODE |
| Tables (4) | Pivot tables 1 · pivot tables 2 · table filters · skill summary |
| Dates (5) | DATE · TODAY · DATEDIF · DAYS · skill summary |
| Other skills (2) | Worksheets · conditional formatting |
| Array formulas (2) | UNIQUE · FILTER |
| Combined (2) | Two multi-function case studies (our own scenarios) |

**Global order** lives in `content/order.json`: Intro first, then easy shortcut lessons interleaved between function lessons, and every "practice" or "skill summary" lesson placed after its concept lessons. Two curated tracks can be added later ("Essentials", 10 lessons; "Advanced").

**Pattern inside a lesson:** concept with one bold term → the smallest possible action (click a cell) → a guided formula typed as shown → variations on new data → one "apply it" question. Skill-summary lessons mix every function in the module.

### 7. Scoring, review status and AI explanations

- **Points:** 10 × lesson difficulty per correct answer, +50% if first try, 0 after Show Answer (decision 20). Points feed only today's leaderboard.
- **First-try tracking:** every step attempt is logged; a lesson's first-try accuracy is the share of steps answered right first time.
- **Status per lesson** (from its latest completion): first-try accuracy below 50% → **Low Accuracy** (red); else last completed 14 or more days ago → **Needs Practice** (yellow); else **Good** (green). The dashboard bar stacks the three counts.
- **AI explanation flow** (replaces the plain hint route):
  1. On a wrong answer the browser calls `POST /api/explain {lessonId, stepId, input}`.
  2. The server normalises the input and looks up `ai_explanations` by (lesson, step, normalised input) with score ≥ 0, best score first.
  3. Hit → return the cached text at once. Miss → call Gemini with the step's prompt, grid, correct solution and the wrong input; store and return it.
  4. 👍 / 👎 calls `POST /api/explain/[id]/rate`, which adds or subtracts 1; explanations below 0 are no longer served, so the next learner gets a fresh one.
  5. Shortcut mistakes use the same table with the pressed keys as the input.

### 8. Review mode (`/review`)

- Same player layout. Questions come from `content/review-bank.json` (formula and shortcut items), shuffled and drawn without repeats until the pool is used up, then reshuffled — endless.
- Left column: **Suggested Practice — based on your last 30 days**: lessons ranked by review questions missed, each with an "N missed" badge linking back to the lesson.
- Each answer posts to `POST /api/review/attempt`; the server grades it, awards points and logs misses in `review_misses`. (Their version saves points from the browser every 60 seconds; ours grades every answer on the server.)

### 9. Daily challenge details

- One challenge per date in IST: 5 questions picked from `content/daily-bank.json` by a seed made from the date, so everyone gets the same set. A file `content/daily/YYYY-MM-DD.json`, if present, overrides the pick.
- Page: date, **Today's Topics** pills linking to the matching lessons, Start Challenge, timer shown as mm:ss.ms.
- Results panel: accuracy, time, global rank, "Come back tomorrow", share buttons including Copy link.
- Worldwide leaderboard with gold, silver and bronze rank colours.
- Dashboard chart: last 7 days' accuracy as a line chart (0–100), gaps joined, with an empty state and a "Today's daily challenge" button.

### 10. Profile page (`/profile`)

Greeting "Hey, {name}", a minimal nav, and one column of cards in this order:

1. **Account details** — email, username, member since, last active.
2. **Lesson progress** — x / 85 bar and a Reset Progress button (confirm modal).
3. **SQL progress** — shown as "coming soon" until Phase 7.
4. **Leaderboard options** — LinkedIn profile URL field + Save; the link appears next to the name on leaderboards.
5. **Certificate** — Generate (disabled with "Complete all lessons to unlock" until done) and "View existing certificate →".
6. **Projects** — thumbnails with a Premium pill where locked, each with "View project →".
7. **Subscription** — access level (Free / Premium); Upgrade, or manage / cancel for premium users.
8. **Delete account** — two-step confirm; asks for a fresh sign-in if the last one isn't recent; deletes the profile, progress and the auth user.

### 11. Projects

- Dashboard project cards open a **modal**: screenshot of the finished workbook, one-paragraph description, and a gate box with three states — signed out ("Sign in or create an account"), free ("Upgrade to Premium"), premium ("Start Project"). One project is free and ungated.
- **Project page:** breadcrumb, title, "View completed project" (screenshots + download of the finished workbook — no OneDrive embed), description, "Skills to know" links to the matching `/learn` articles, Start button.
- **Project steps** use the `project` step type: download the dataset `.xlsx`, build in real Excel, type the answers to check questions.
- Four projects, all with our own datasets: one data-modelling dashboard (free), one interview-style assessment, two themed dashboards (drop-downs, lookups, absolute references, charts).

### 12. Admin portal (`/admin`)

- Controls: term start date, days of history (default 14; more than 30 groups the columns by month), Update view.
- A note explaining that accuracy means first-try accuracy, and low accuracy can mean heavy use of AI explanations.
- Learner table: username (with first name), user ID, total completed, accuracy, then one column per day (Today, Yesterday, weekday + date) or per month, showing lessons completed.
- **Invite users:** paste emails separated by commas or new lines → Send invites → rows in `invitations`; a table shows each invitation's status.
- Data comes from `lesson_completions` filtered by `group_id`; every completion stores the learner's `group_id` and `cohort`.

### 13. Growth and analytics

- One-time share bonus: a card on the dashboard and lesson pages — share on LinkedIn for +500 points; sets `shared_on_linkedin` so it never repeats.
- Share buttons on every lesson page; LinkedIn URL shown on leaderboards.
- **SEO article template** (`/learn/[function]`): syntax, argument list, worked examples with images, and a sticky bottom bar "Continue to \[function\] practice exercises →" deep-linking to the lesson. This was their main acquisition channel.
- Exam-prep pages (Microsoft Office Specialist exams, job-application Excel tests) and shortcut articles in Phase 6.
- Institutional plans through groups + `group_domains`.
- Analytics: one tool (PostHog) with events `lesson_start`, `step_answer`, `lesson_complete`, `signup`, `paywall_view`, `checkout_start`, `purchase`, `share`. Ad pixels only when ads run, behind a cookie-consent banner.

### 14. Design system (our own)

Same structure as theirs, our own values, kept in one tokens file:

| Token | Used for |
| --- | --- |
| `primary`, `primary-strong` | Buttons, headings, correct state |
| `ink` | Headline text, breadcrumb bar, correct-answer footer |
| `surface-warm` | Landing, player and sign-up backgrounds |
| `warning` | Incorrect drawer header |
| `danger` | Low Accuracy |
| `surface`, `text` | Cards and body text |
| `track-sql` | Accent for the SQL track |

One font family. Pill buttons with a darker bottom border so they look pressable. Cards with a 4 px accent left border. Three-column player collapses to one column below about 1000 px.

### 15. Data and API additions

New tables (profiles and groups are defined in the Data model; these are added to it):

| Table | Key columns | Used by |
| --- | --- | --- |
| lesson\_completions | id, user\_id, lesson\_id, completed\_at, first\_try\_accuracy, points, group\_id, cohort | Admin grid and history — append-only, survives Reset Progress |
| step\_attempts | user\_id, lesson\_id, step\_id, correct, first\_try, showed\_answer, started\_at, ended\_at | First-try accuracy |
| ai\_explanations | id, lesson\_id, step\_id, input\_norm, text, score, served\_count | AI cache |
| review\_misses | user\_id, item\_id, lesson\_id, missed\_at | Suggested Practice |
| invitations | group\_id, email, invited\_by, invited\_at, cohort, status | Admin invites |
| group\_domains | group\_id, domain | Institutional premium |
| certificates (extend) | + name\_lower, pdf\_url | Verify search, PDF link |

New routes (added to System design §5):

| Method | Route | Auth | Body → response |
| --- | --- | --- | --- |
| GET | /api/lessons/\[id\]/access | any | → `{allowed, reason: "ok" \| "signup" \| "paywall"}` |
| GET | /api/review/next | user | → next review item |
| POST | /api/review/attempt | user | `{itemId, input}` → `{correct, points}` |
| GET | /api/review/suggested | user | → `[{lessonId, missed}]` for the last 30 days |
| PATCH | /api/profile | user | `{firstName, username, linkedinUrl}` → profile |
| DELETE | /api/account | user, recent sign-in | → `{ok}` |
| POST | /api/billing/manage | premium | → Stripe portal URL, or cancels the Razorpay subscription |
| GET | /api/verify?q= | public | → certificates matching a name or ID |
| POST | /api/admin/groups/\[id\]/invites | group admin | `{emails}` → `{invited}` |
| GET | /api/admin/groups/\[id\]?from=&days= | group admin | → learner rows with per-day or per-month counts |

### 16. Where the additions land

Scope grew by roughly 40%. It still fits 5 days because most of it is UI on top of the same data, but only if each day ends with a deploy.

| Day | Lane A (player, grid) | Lane B (platform) | Lane C (content, you) |
| --- | --- | --- | --- |
| Fri 13 | Point mode, coloured references, `select` steps, chord and sequence shortcuts, footer states, Show Answer rule, keyboard focus | Schema v2 types, `requiredCorrect` progress rule, global order, status tags, module pages, breadcrumb, sign-up wall + onboarding, server access check | Schema v2 frozen by noon; Intro lesson; `order.json` |
| Sat 14 | AI explanation cache + rating, completion celebration + auto-advance, video modal, mobile and Mac banners | Points rule, IST day boundary, streak copy, pricing page layout, share bonus, LinkedIn URL | Remaining lessons; 4 project datasets |
| Sun 15 | Review mode + Suggested Practice, daily challenge page, project modal and pages | Profile page (8 cards), admin grid + invites, certificate flow + verify search | Review bank, daily bank, 10 `/learn` articles |
| Mon 16 | Error toasts and connection banner; one-column layout check | Help, terms, privacy, analytics events, cookie banner | Full playthrough against the teardown screenshots |

Cut order if a day slips: review mode → admin per-month grouping and invitations table → video modal → the three premium projects → daily-challenge trend chart → `/learn` articles.

This is the one cut list for the whole plan. Never cut the grid, grading, the paywall or payments.

### 17. Still unknown (design these ourselves)

- Inside premium projects, the checkout and the customer portal — not captured.
- How the red and yellow status states look — follow §7 rules with our tokens.
- Daily-challenge questions — write our own in the daily bank.
- Mobile layout below about 1000 px — design it; only the banners are known.
- Their AI prompt and model — ours: Gemini gets the step prompt, grid values, correct solution and the wrong input, and must explain the specific mistake in under 80 words without giving away a different lesson's answer.
