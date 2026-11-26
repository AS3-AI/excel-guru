# Roadmap

Last updated: 26 Nov 2026 (T61: lesson content sits on the page, no box)

## Start here (17 Nov 2026) — for the human review

**In one sentence:** the product is built. All 86 lessons, the player, grading, progress, points, leaderboards,
payments (test mode), AI explanations (code only, switched off), 10 `/learn` articles, help/privacy/terms, SEO,
and the security pass are on `main`. What stands between us and a public launch is **switching things from test
to live, filling in your details, and checking it by hand** — not more features.

### Launch checklist (in this order)

| #   | What                                                                                                                                            | Who                                      | Why it matters                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fill the legal placeholders `[LEGAL NAME]`, `[ADDRESS]`, `[CONTACT EMAIL]`, `[CITY/STATE]` on `/privacy`, `/terms`, `/help`                     | You send values, Claude edits            | Razorpay live mode and the law both need real details. They show as brackets on the live site today.                             |
| 2   | Check the payment bug: one test purchase, then read Razorpay → Webhooks → deliveries and the Vercel logs (T34 now logs ignored events)          | You + Claude                             | The "Manage / cancel" button didn't appear after the 16 Nov test purchase. Cause not found yet. Must be fixed before real money. |
| 3   | **O3** Pre-launch checklist: turn email confirmation back on (token_hash template), create test accounts, set production env vars in Vercel     | You (Claude writes the steps)            | Sign-up is wide open today; confirmation was switched off for testing.                                                           |
| 4   | **O2** Payments to live mode: finish Razorpay activation, add live keys and webhook secret in Vercel, make one real ₹499 purchase and refund it | You                                      | Until then no one can pay. Needs #2 fixed first.                                                                                 |
| 5   | **T45** Landing page says "Start free"; email the waitlist                                                                                      | Claude builds, you approve copy and send | This is the actual launch switch.                                                                                                |
| 6   | **O4** Play-through: first 2–3 lessons of each module in Chrome, Safari and one phone; try the shortcut lessons with real keys on your Mac      | You + Claude                             | Shortcut keys and iOS touch are untested on real devices.                                                                        |
| 7   | Lighthouse SEO ≥ 90 on landing and one lesson; refund test in Razorpay                                                                          | Claude (Lighthouse), You (refund)        | Last checks from T46/T47.                                                                                                        |
| 8   | **O5** Launch posts (LinkedIn, X, Product Hunt) and 10 beta users                                                                               | You (Claude drafts)                      | Gets the first users.                                                                                                            |

### Decided, not for launch

- **Projects (C11, T42), certificates (T40), daily challenge (T38), review mode (T37), profile (T39), group admin (T41):**
  after launch. SPEC §16's cut order already allows this.
- **Stripe / USD:** deferred; USD shows "Coming soon". No lifetime plan.
- **AI explanations:** code is merged but stays off until you set the Gemini key (O1).
- **Tables and Other Skills lessons** are formula + multiple-choice practice because the grid has no pivot, filter,
  sheet-tab or formatting UI. A real UI is a later card if wanted.
- **Analytics (T48):** only Vercel's cookieless page-view analytics for now; PostHog and a cookie banner come later.

### Known open items (not blockers unless noted)

- Payments: Manage/cancel button missing after a test purchase (launch blocker, see #2).
- Engine, to confirm in real Excel: `=SUMIF(A1:A3,Hike,B1:B3)` unquoted; TEXTBEFORE on empty text; COUNTIF with an empty-cell criterion.
- Rate limits never delete old rows (`rate_limits` grows slowly); add a daily cleanup later.
- Free users can still open a third lesson (progress saving is blocked); T36 covers opening.
- Not run on a live database before you applied them: migrations 0005 and 0006 (applied by you 17 Nov, no errors).

### Database migrations (all applied)

0000 waitlist · 0001 init · 0002 points once per day · 0003 explain calls · 0004 lesson opens ·
0005 security (rate limits, leaderboard views) · 0006 one AI rating per user.

### How to read the rest of this file

Everything below is the reference: every phase, its goal, a table of cards with status, then the full text of
cards that have no file in `docs/tasks/` yet. Status keys: ✅ done and on `main` · 🟡 waiting on you ·
⏸ postponed on purpose · ⬜ not started. Card kinds: `T` code, `C` content, `O` owner task.
Rules for every card are in `CLAUDE.md` (touch only the card's files; frozen schema/contracts; secrets only on
the server; prices only from `apps/web/lib/plans.ts`; never copy from `docs/teardown.md`; done = typecheck, test
and validate-content pass).

---

## Phase 1 — Foundations and the simulator ✅

**Goal:** a learner can open the live site, sign in, and play one lesson end to end in a real spreadsheet grid.
**Done when:** one lesson playable end to end on the live URL. **Status:** done (12–13 Nov).

| Card | What                                                               | Status                                |
| ---- | ------------------------------------------------------------------ | ------------------------------------- |
| T0   | Claude Code workspace setup                                        | ✅                                    |
| T1   | Scaffold + landing page with waitlist (first deploy)               | ✅                                    |
| T2   | Supabase schema + auth (Google, email), profiles, protected routes | ✅                                    |
| T3   | Formula tokenizer                                                  | ✅                                    |
| T4   | Pratt parser                                                       | ✅                                    |
| T5   | Evaluator + Sheet (recalc, errors)                                 | ✅                                    |
| T7   | Lesson types + formula grading                                     | ✅                                    |
| T8   | validate-content script                                            | ✅                                    |
| T9   | Grid component (cells, formula bar, selection)                     | ✅                                    |
| T10  | Lesson player v0                                                   | ✅                                    |
| C0   | Gold lessons + SUM, COUNT, Logical modules                         | ✅ (Logical finished in Phase 3 week) |

---

## Phase 2 — The learning loop ✅

**Goal:** the full lesson experience: every step type graded, progress saved, dashboard with status tags, and
the first half of the curriculum (Intro through Text Manipulation, plus Index Match).
**Done when:** a learner can do all SUM → Text lessons and see their progress.
**Status:** ✅ done (16 Nov).

| Card                                | What                                                               | Status      |
| ----------------------------------- | ------------------------------------------------------------------ | ----------- |
| T6                                  | Dynamic arrays (spill)                                             | ✅          |
| T11                                 | Player polish                                                      | ✅          |
| T12                                 | Engine functions batch                                             | ✅          |
| T13                                 | Element-wise functions                                             | ✅ (16 Nov) |
| T14                                 | Grade spilled answers                                              | ✅ (16 Nov) |
| T15                                 | Grader for every step type                                         | ✅          |
| T16                                 | Player v1 (Check / Show Answer / Skip / Previous, Enter)           | ✅          |
| T17                                 | Shortcut steps (Win/Mac, mobile banners)                           | ✅          |
| T18                                 | Point mode + coloured references                                   | ✅          |
| T19                                 | Progress API (first-try accuracy, replay rule A)                   | ✅          |
| T20                                 | Dashboard + server access check                                    | ✅          |
| T21                                 | CI (typecheck, test, validate-content, build)                      | ✅          |
| T22                                 | Merge race fix (migration 0002)                                    | ✅          |
| T23                                 | Rich text + module slugs                                           | ✅          |
| T28                                 | Engine: whole rows                                                 | ✅          |
| T29                                 | IS functions see errors                                            | ✅          |
| T31                                 | INDEX and MATCH follow Excel                                       | ✅          |
| C-SUM, C-COUNT, C-LOG, C-LOOK, C-IM | SUM 9, COUNT 7, Logical 7, Lookup 10, Index Match 6                | ✅          |
| **C1**                              | Text Search (7)                                                    | ✅          |
| T51                                 | Text functions follow Excel (SEARCH wildcards, PROPER, LEFT/RIGHT) | ✅          |
| **C2**                              | Text Manipulation (4)                                              | ✅          |

---

## Phase 3 — Engagement and money ✅ (payments bug open)

**Goal:** reasons to come back (points, streaks, leaderboards, AI help, video) and a way to pay; every lesson in
the repo.
**Done when:** payment works in test mode (✅) and all 86 lessons plus 4 project datasets are in the repo (⬜).
**Owner decisions recorded:** Razorpay only (Stripe deferred, USD shows "Coming soon"); no lifetime plan;
per-user AI ratings deferred.

| Card                                                          | What                                                                                    | Status                                                                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| T24                                                           | Points, streaks, leaderboards, LinkedIn share bonus                                     | ✅                                                                                                           |
| T25                                                           | Payments (Razorpay), free tier + paywall                                                | ✅                                                                                                           |
| T26                                                           | AI explanations (Gemini, cached, 👍/👎)                                                 | ✅ code; 🟡 off until the Gemini key is set                                                                  |
| T27                                                           | Video per lesson + .xlsx download                                                       | ✅                                                                                                           |
| T30                                                           | Payments switch `PAYMENTS_ENABLED`                                                      | ✅ (on, test keys)                                                                                           |
| T32                                                           | Razorpay `total_count` + logged errors                                                  | ✅ (test purchase passed 16 Nov)                                                                             |
| T33                                                           | 20 new Gemini calls a day (migration 0003)                                              | ✅ code; 🟡 owner runs 0003                                                                                  |
| T36                                                           | Free tier counts lessons opened (migration 0004)                                        | ✅ (owner ran 0004; browser check with a free account pending)                                               |
| T52                                                           | Statistical functions follow Excel                                                      | ✅                                                                                                           |
| T53                                                           | Dates display as dates; fixed lesson today                                              | ✅ merged 16 Nov                                                                                             |
| T54                                                           | Shortcut steps show a real grid + `grid`/`postcondition.format` schema (owner-approved) | ✅ merged 16 Nov (browser check pending)                                                                     |
| **O1**                                                        | Turn on AI explanations                                                                 | 🟡 owner — below                                                                                             |
| **T34**                                                       | Payments: subscription row + Manage / cancel button                                     | 🟡 tests and logging of ignored events are on `main`; root cause still needs the Razorpay webhook deliveries |
| **O2**                                                        | Payments to live mode                                                                   | ⬜ owner — below (also listed in Phase 5)                                                                    |
| **T35**                                                       | One AI rating per user                                                                  | ✅ on `main`; migration 0006 applied                                                                         |
| ~~T36~~                                                       | moved up: done                                                                          |
| C5 Statistical (7) · C9 Array Formulas (2) · C10 Combined (2) |                                                                                         | ✅ live 16 Nov                                                                                               |
| C3 Intro to Shortcuts 2–6 · C4 Cell Selection 1–7             | plan: docs/content/shortcuts-plan.md                                                    | ✅ merged 16 Nov (browser key test pending; intro-to-shortcuts-1 Alt key tips ✅ on `main` (Windows-only))   |
| C6 Dates (5)                                                  |                                                                                         | ✅ merged 16 Nov                                                                                             |
| C7 Tables (4) · C8 Other Skills (2)                           | formula + multiple-choice steps, no new UI (owner decision 16 Nov)                      | ✅ on `main`                                                                                                 |
| **C11**                                                       | 4 project datasets + steps                                                              | ⏸ after launch, together with T42                                                                            |

---

## Phase 4 — Certificates, daily challenge, projects ⬜

**Goal:** the rest of the product around the lessons: review mode, daily challenge, profile, certificates,
group admin, projects, and the first SEO articles.
**Done when:** feature-complete on staging (a Vercel preview with the dev Supabase project).
Cut order if time runs short (SPEC §16): review mode → admin per-month grouping and invitations table → video
modal → the three premium projects → daily-challenge trend chart → `/learn` articles. Never cut the grid,
grading, the paywall or payments.

| Card              | What                                               | Status                                                                |
| ----------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| **T37** + **C12** | Review mode + review bank                          | ⬜                                                                    |
| **T38** + **C13** | Daily challenge + daily bank (150)                 | ⬜                                                                    |
| **T39**           | Profile page (8 cards, delete account)             | ⬜                                                                    |
| **T40**           | Certificates + public verify                       | ⬜                                                                    |
| **T41**           | Group admin portal + invites                       | ⬜                                                                    |
| **T42**           | Projects: modal, page, player                      | ⬜ (needs C11)                                                        |
| **T43** + **C14** | `/learn/[function]` article template + 10 articles | ✅ live 16 Nov                                                        |
| **C15**           | Landing copy + pricing FAQ                         | 🟡 draft 1 in `docs/content/landing-copy.md`, waiting on owner review |

---

## Phase 5 — Harden and launch 🟡 (in progress)

**Goal:** nothing broken, nothing embarrassing, nothing insecure; then open the doors.
**Done when:** public launch (landing says "Start free", payments live, posts out).

| Card    | What                                                                        | Status                                                                                                    |
| ------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **T44** | Error states, toasts, connection banner, one-column layout                  | ⬜                                                                                                        |
| **T45** | Landing "Start free" + email the waitlist                                   | ⬜                                                                                                        |
| **T46** | Security pass: RLS on every table, rate limits                              | ✅ on `main`, migration 0005 applied, audit in `docs/security-audit.md`; 🟡 Razorpay refund test is yours |
| **T47** | SEO basics + help / privacy / terms pages                                   | ✅ on `main`; 🟡 legal placeholders and the Lighthouse score still to do                                  |
| —       | Route loading indicator between pages                                       | 🟡 PR #3 open (24 Nov)                                                                                    |
| **T48** | Analytics (PostHog) + cookie banner                                         | ⬜                                                                                                        |
| **O2**  | Payments to live mode                                                       | ⬜ owner                                                                                                  |
| **O3**  | Pre-launch checklist (auth email, test accounts, dev project, Excel checks) | ⬜ owner + Claude                                                                                         |
| **O4**  | Full playthrough + cross-browser pass                                       | ⬜ owner + Claude                                                                                         |
| **O5**  | Launch posts + 10 beta users                                                | ⬜ owner                                                                                                  |

---

## Phase 6 — Growth content (after launch) ⬜

**Goal:** search traffic: function and shortcut articles and exam-prep pages that deep-link into lessons.
Nothing from Phase 6+ starts before launch (plan rule).

| Card    | What                                        | Status |
| ------- | ------------------------------------------- | ------ |
| **C16** | ~45 more `/learn` and `/shortcuts` articles | ⬜     |
| **T49** | Exam-prep pages                             | ⬜     |

## Phase 7 — SQL track (after launch) ⬜

| Card    | What                                                        | Status                        |
| ------- | ----------------------------------------------------------- | ----------------------------- |
| **T50** | SQL track: same player, own accent, 23 lessons in 6 modules | ⬜ (needs its own spec first) |

---

# New cards in full

## O1: Turn on AI explanations (owner)

Steps: run `supabase/migrations/0003_explain_calls.sql` in the Supabase SQL editor; create a Gemini key at
aistudio.google.com/apikey; add `GEMINI_API_KEY`, `GEMINI_MODEL` (`gemini-2.5-flash`) and `EXPLAIN_IP_SALT`
(long random string) to `.env.local` and to Vercel Production; redeploy; optionally set a budget alert in Google Cloud.
Done when: Claude's live test shows an explanation, the same wrong answer served from cache, and a 429 after 20 new calls.

## T34: Payments — subscription row and Manage / cancel

Goal: after the 16 Nov test purchase, premium unlocked but "Manage / cancel subscription" didn't show, so the
`subscriptions` row is probably not `active` with a future `period_end`. Renewals, cancellations and halts depend on it.
Files: apps/web/app/api/webhooks/razorpay/route.ts, packages/payments/src/index.ts, their tests
(read the evidence first: Razorpay webhook deliveries and the owner's `subscriptions` row).
Rules: `subscription.activated` and `.charged` upsert the row as `active` with `period_end` = Razorpay's
`current_end`; `.cancelled`, `.completed`, `.halted` set the matching status and premium follows `isEntitled`;
out-of-order events are ignored by event time (existing helper); PaymentProvider interface unchanged.
Done when: tests for each event; a test-mode purchase shows the Manage button; cancel from our site ends premium at period end.

## O2: Payments to live mode (owner)

Steps: finish Razorpay account activation; in Live mode create Monthly ₹499 and Annual ₹1,499 plans and the
webhook (`/api/webhooks/razorpay`, the five subscription events, a new secret); put live key ID/secret, plan IDs
and webhook secret in Vercel Production; redeploy; one real ₹499 purchase and refund to prove it.
Done when: a live purchase unlocks premium and the refund shows in Razorpay. Requires T34 first.

## T35: One AI rating per user (done)

Goal: 👍/👎 counts once per signed-in user per explanation, atomically.
Files: supabase/migrations/0006_explanation_ratings.sql (0004 was taken), apps/web/app/api/explain/[id]/rate/route.ts, tests.
Schema: `explanation_ratings(explanation_id, user_id, helpful, primary key (explanation_id, user_id))`, RLS on, no
policies; an RPC that inserts or updates the vote and adjusts `ai_explanations.score` by the difference in one transaction.
Done when: repeat votes don't change the score; switching 👍→👎 moves it by 2; concurrent votes don't get lost.

## T36: Free tier — block opening locked lessons

Goal: free users can still _open_ lessons past their two (they can't save progress). Block it on the server.
Files: apps/web/lib/access.ts, the lesson page loader, tests; a migration only if the free-lesson choice must be stored.
Rules: the free tier is Intro plus the first other lesson completed (spec §2); opening any other lesson as a free
user redirects to /pricing; premium and group-premium users unaffected.
Done when: tests for signed out / free with 0, 1, 2 lessons / premium; checked in the browser.

## C1: Text Search module (7)

Topics (SPEC §6): LEN, LEFT, RIGHT · MID · practice · wildcard characters · FIND · SEARCH · TEXTBEFORE and TEXTAFTER.
Before writing: probe the engine against Excel for LEN/LEFT/RIGHT/MID edge cases (beyond the length, 0, text
numbers), FIND (case-sensitive, #VALUE! when missing, start position) vs SEARCH (case-insensitive, wildcards),
TEXTBEFORE/TEXTAFTER (instance numbers, negative instances, missing delimiter → #N/A, if_not_found, empty cell —
an open Excel check). Fix gaps with an engine card first (as T31 did).
Audit: write `text-audit.mts` (length ±1, start ±1, FIND↔SEARCH swap, wrong instance, delimiter variants).
Done when: lint none, audit clean except listed trade-offs, module review passed, owner says merge.

## C2: Text Manipulation module (4)

Topics: CONCAT · TEXTJOIN · UPPER, LOWER, PROPER · SUBSTITUTE. Probe: TEXTJOIN ignore_empty, delimiters, ranges;
SUBSTITUTE instance_num and case sensitivity; PROPER on apostrophes and digits; `&` vs CONCAT. Audit: missing
delimiter/space, ignore_empty TRUE↔FALSE, wrong instance, UPPER↔PROPER. Same done-when as C1.

## C3: Intro to Shortcuts module (6) and C4: Cell Selection module (7)

Topics: Alt key tips · text formatting · number formatting · fill right and down · cut, copy, paste · data
shortcuts; and arrow keys · selection shortcuts · larger selections · rows and columns · selection 2 · larger
selections 2 · skill summary. These are mostly `shortcut` steps (T17): every step shows what it acts on, keys
for Windows and Mac, a touch-screen Skip path, and the known T17 limit (`[shortcut, shortcut, info]` can't be
finished on touch — avoid that pattern). In the global order, interleave easy shortcut lessons between function
lessons (SPEC §6). Audit: keys valid for both OS; no chord the browser intercepts (test in Chrome and Safari).
Done when: lint none; tried by hand on Mac in Chrome and Safari; module review passed.

## C5: Statistical (7) · C6: Dates (5) · C7: Tables (4) · C8: Other Skills (2)

Statistical: AVERAGE · MIN, MAX, LARGE, SMALL · FLOOR and CEILING · practice · ODD and EVEN · MEDIAN · MODE.
Dates: DATE · TODAY · DATEDIF · DAYS · skill summary (TODAY needs a fixed "today" in grading — check how the
engine handles volatile functions before writing; DATEDIF units).
Tables: pivot tables 1 · pivot tables 2 · table filters · skill summary — done as formula + multiple-choice steps
(the grid has no pivot or filter UI; owner decision 16 Nov).
Other skills: worksheets · conditional formatting — same approach (no multi-sheet or formatting UI yet).
Each: engine probe first; any missing behaviour becomes a T card before content; then the C1 process.

## C9: Array Formulas (2) · C10: Combined (2)

Array: UNIQUE · FILTER — spill already works (T6); grading spilled answers needs T14 (parked) and element-wise
conditions need T13 (parked): unpark both first. Combined: two multi-function case studies on our own
scenarios, written last, using only functions taught earlier.

## C11: Project datasets (4)

One free data-modelling dashboard, one interview-style assessment, two themed dashboards (drop-downs, lookups,
absolute references, charts). Each: our own `.xlsx` dataset, a finished workbook with screenshots, a
description, "skills to know" links, and `project` steps with typed check answers (SPEC §11). Files under
content/projects/. Done when: every check answer verified against the finished workbook.

## T37: Review mode (`/review`) + C12 review bank

Goal: endless practice from a shuffled bank, and Suggested Practice from misses (SPEC §8).
Files: app/(app)/review/*, app/api/review/{next,attempt,suggested}/route.ts, migration for `review_misses`,
lib/review.ts + tests; C12 = content/review-bank.json (formula and shortcut items, each linked to a lesson).
Rules: draw without repeats until the pool is used, then reshuffle; the server grades every answer, awards points
(same rule as lessons) and logs misses; Suggested Practice ranks lessons by misses in the last 30 days.
Done when: tests for drawing, grading, points, suggestions; validate-content checks the bank too.

## T38: Daily challenge + C13 daily bank

Goal: one shared 5-question challenge per IST date (SPEC §9).
Files: app/(app)/daily/*, routes for start/answer/leaderboard, a migration for daily results, lib/daily.ts + tests,
dashboard 7-day accuracy chart; C13 = content/daily-bank.json (150 items) and optional content/daily/YYYY-MM-DD.json.
Rules: the date seed picks 5 questions so everyone gets the same set; timer mm:ss.ms measured on the server
(start/finish times); results show accuracy, time, global rank; worldwide leaderboard; one attempt per user per day.
Done when: tests for seeding, override file, timing, ranking, one-attempt rule; chart has an empty state.

## T39: Profile page (`/profile`)

Goal: the 8 cards of SPEC §10. Files: app/(app)/profile/*, PATCH /api/profile, DELETE /api/account, tests.
Rules: account details; lesson progress with Reset (confirm modal; `lesson_completions` survives reset);
SQL "coming soon"; LinkedIn URL (validated https://linkedin.com/…) shown on leaderboards; certificate card
(T40); projects card (T42); subscription card (uses T34's manage/cancel); delete account — two-step confirm,
requires a recent sign-in, deletes profile, progress and the auth user via the admin client.
Done when: tests per route; delete tested on a throwaway account.

## T40: Certificates + `/verify`

Goal: a certificate after all 85 lessons (SPEC §10, §15). Files: certificate route + PDF generation,
GET /api/verify?q=, app/verify/*, migration extending `certificates` (name_lower, pdf_url), tests.
Rules: name confirmed before generation (can't be changed later); credential ID unguessable; PDF stored and
linked; "Add to LinkedIn" link prefilled with the credential; public verify searches by name or ID.
Done when: tests for eligibility, ID format, verify search; one PDF checked by eye.

## T41: Group admin portal (`/admin`)

Goal: a group admin sees learners' daily progress and invites people (SPEC §12).
Files: app/(app)/admin/*, GET /api/admin/groups/[id], POST /api/admin/groups/[id]/invites, migration for
`invitations` (and `group_domains` if institutional premium is in scope), tests.
Rules: only that group's admins; term start date and days of history (default 14, >30 groups by month);
accuracy note; invites by pasted emails create `invitations` rows and send emails; an invitation status table.
Done when: tests for authorisation, day/month grouping, invites; checked with a test group.

## T42: Projects (needs C11)

Goal: project cards, gated modal, project page and player (SPEC §11).
Files: app/(app)/projects/*, project modal component, `project` step support in the player (if not complete
from T15), tests. Rules: three gate states (signed out / free / premium); one project free; "View completed
project" = screenshots + workbook download; steps = download dataset, build in Excel, type check answers.
Done when: tests for gating; one project played end to end.

## T43: `/learn/[function]` template + C14 10 articles

Goal: SEO articles that send readers into practice (SPEC §13). Files: app/(marketing)/learn/[fn]/page.tsx,
content/learn/*.md(x), sitemap entry; C14 = 10 articles in our own words (syntax, arguments, worked examples,
images) for the most-searched functions taught so far. Sticky bar "Continue to X practice →" deep-links to the lesson.
Done when: 10 pages render statically with titles/descriptions; links land on the right lesson.

## C15: Landing copy + pricing FAQ

Our own copy for the landing sections and a pricing FAQ (refunds, cancel any time, what premium unlocks, INR/USD).
Prices only from plans.ts. Done when: owner approves the text.

## T44: Error states and layout

Goal: no blank screens. Files: error/loading boundaries in app/, a toast component, a connection banner,
player one-column check below ~1000 px. Done when: each failure path shows a friendly state (tests where
practical) and a phone-width pass in the browser.

## T45: Landing "Start free" + waitlist email

Swap the waitlist form for "Start free" (opens Intro); email everyone on the waitlist once (owner approves the
text and sends via the chosen email provider). Done when: CTA live; email sent by the owner.

## T46: Security pass

Goal: launch-safe. Check RLS on every table (list each with its policies); every server route checks auth and
ownership; rate limits on write routes (progress, review, daily, share, checkout); refund flow tested in
Razorpay; no secret in client bundles (grep the build). Done when: a written audit table with each item ✅.

## T47: SEO basics + help / privacy / terms

Meta titles and descriptions per page, sitemap.xml, robots.txt, OG images; help page; review the existing
privacy and terms pages for what we actually collect (Supabase, Razorpay, Gemini, analytics).
Done when: pages render; Lighthouse SEO ≥ 90 on landing and a lesson.

## T48: Analytics + cookie banner

PostHog with events `lesson_start`, `step_answer`, `lesson_complete`, `signup`, `paywall_view`,
`checkout_start`, `purchase`, `share` (SPEC §13); key via env; no personal data in event properties; a cookie
banner that defaults to essential only (ad pixels only if ads run). Done when: events visible in PostHog from a test run.

## O3: Pre-launch checklist (owner + Claude)

- Re-enable Supabase "Confirm email" with the token-hash template and redirect allow-list (see memory note).
- Delete test accounts; create a separate dev Supabase project and point Preview/Development env vars at it.
- Check in real Excel: `=SUMIF(A1:A3,Hike,B1:B3)` (unquoted), COUNTIF with `#N/A` criteria, TEXTBEFORE on an
  empty cell, COUNTIF with an empty-cell criterion — fix the engine if any differ.
- Keyboard check of the video modal; point mode on a real iPhone.

## O4: Full playthrough + cross-browser

Someone who didn't write the lessons plays every lesson and logs problems; fix list triaged; Chrome, Safari,
Edge, Firefox and one phone each run Intro, one lesson per step type, the paywall and checkout.

## O5: Launch

Launch posts (LinkedIn, X, Product Hunt draft) in the owner's words; invite 10 beta users first.

## C16: Growth articles (Phase 6)

~45 more `/learn` and `/shortcuts` articles using T43's template, each deep-linking to its lesson.

## T49: Exam-prep pages (Phase 6)

Pages for Microsoft Office Specialist exams and job-application Excel tests, each mapping exam skills to our
lessons. Needs its own short spec first.

## T50: SQL track (Phase 7)

Same player and progress model with its own accent token (`track-sql`), 23 lessons in 6 modules, a SQL engine
(likely an in-browser SQLite) and its own grader. Needs a full spec before any card is written.
