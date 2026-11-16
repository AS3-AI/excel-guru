# Security Audit Report — Task Card T46

This audit reviews row-level security (RLS) across all database tables and views, authentication and authorization across all API routes, rate-limiting coverage, environment variables and secret isolation, and pre-launch owner verification items.

---

## 1. Row-Level Security (RLS) Audit

Security Model: Every table has Row-Level Security enabled (`alter table ... enable row level security`). Learners may only `SELECT` their own rows (`user_id = (select auth.uid())`). There are **no** `INSERT`, `UPDATE`, or `DELETE` policies for `anon` or `authenticated` roles on any table: all state mutations must flow through trusted Next.js server route handlers using the Supabase service-role client.

| # | Table Name | RLS | Policies | Command | Role | Expression / Restriction | Cross-Tenant Leak? | Status |
|---|---|:---:|---|:---:|:---:|---|:---:|:---:|
| 1 | `waitlist` | ON | None (0 policies) | - | - | Server-only writes via `/api/waitlist` with service key | No | ✅ |
| 2 | `groups` | ON | `read own group` | SELECT | `authenticated` | `admin_id = (select auth.uid()) or id = (select p.group_id from public.profiles p where p.user_id = (select auth.uid()))` | No | ✅ |
| 3 | `profiles` | ON | `read own profile` | SELECT | `authenticated` | `user_id = (select auth.uid())` | No | ✅ |
| 4 | `lesson_progress` | ON | `read own lesson_progress` | SELECT | `authenticated` | `user_id = (select auth.uid())` | No | ✅ |
| 5 | `points_log` | ON | `read own points_log` | SELECT | `authenticated` | `user_id = (select auth.uid())` | No | ✅ |
| 6 | `streaks` | ON | `read own streak` | SELECT | `authenticated` | `user_id = (select auth.uid())` | No | ✅ |
| 7 | `daily_challenge_scores` | ON | `read own daily_challenge_scores` | SELECT | `authenticated` | `user_id = (select auth.uid())` | No | ✅ |
| 8 | `certificates` | ON | `read own certificate` | SELECT | `authenticated` | `user_id = (select auth.uid())` | No | ✅ |
| 9 | `subscriptions` | ON | `read own subscriptions` | SELECT | `authenticated` | `user_id = (select auth.uid())` | No | ✅ |
| 10 | `webhook_events` | ON | None (0 policies) | - | - | Server-only idempotency table | No | ✅ |
| 11 | `lesson_completions` | ON | `read own lesson_completions` | SELECT | `authenticated` | `user_id = (select auth.uid())` | No | ✅ |
| 12 | `step_attempts` | ON | `read own step_attempts` | SELECT | `authenticated` | `user_id = (select auth.uid())` | No | ✅ |
| 13 | `ai_explanations` | ON | None (0 policies) | - | - | Server-only cache table | No | ✅ |
| 14 | `review_misses` | ON | `read own review_misses` | SELECT | `authenticated` | `user_id = (select auth.uid())` | No | ✅ |
| 15 | `invitations` | ON | `group admin reads invitations` | SELECT | `authenticated` | `exists (select 1 from public.groups g where g.id = invitations.group_id and g.admin_id = (select auth.uid()))` | No | ✅ |
| 16 | `group_domains` | ON | None (0 policies) | - | - | Server-only lookup table | No | ✅ |
| 17 | `explain_calls` | ON | None (0 policies) | - | - | Server-only quota log | No | ✅ |
| 18 | `lesson_opens` | ON | None (0 policies) | - | - | Server-only open log | No | ✅ |
| 19 | `rate_limits` | ON | None (0 policies) | - | - | Server-only rate limit log; written via `hit_rate_limit` RPC | No | fixed |

---

## 2. Views Security Audit

Views bypass table RLS unless defined with `security_invoker = true`. Both leaderboard views are defined with `security_invoker = true` and all permissions are revoked from `anon` and `authenticated`. Migration `0005_security.sql` hardens both views.

| View Name | `security_invoker` | Anon / Authenticated Direct Access | Columns Selected in View | Columns Leaked | API Access Method | Status |
|---|:---:|:---:|---|:---:|---|:---:|
| `public.leaderboard_points_today` | `true` | `REVOKE ALL` | `user_id, username, first_name, linkedin_url, points, rank` | None | Read only by `/api/leaderboard` via service-role admin client; API omits `user_id` | fixed |
| `public.leaderboard_streaks_today` | `true` | `REVOKE ALL` | `user_id, username, first_name, linkedin_url, streak, rank` | None | Read only by `/api/leaderboard` via service-role admin client; API omits `user_id` | fixed |

---

## 3. Server Route Handlers Audit (Auth, Ownership, Rate Limits)

API contracts are frozen: rate-limited requests return HTTP status `429` with JSON `{"error":"rate_limited"}`. Every route verifies authentication and enforces ownership so learners can only act on their own data.

| Route | Method | Auth Required | Ownership Check | Rate Limit | Key Format | Status |
|---|:---:|:---:|---|---|---|:---:|
| `/api/waitlist` | POST | Public | N/A (inserts email, enforces unique email check) | 5 / min | `waitlist:<ipHash>` | fixed |
| `/api/explain` | POST | Mixed (Intro free; other lessons require auth & access) | User session checked; quota tracked per user/IP via `explain_calls` | 20 uncached calls / day (returns 429 `limit`) | SHA-256 caller key | ✅ |
| `/api/explain/[id]/rate` | POST | Authenticated | User session required. Adjusts score. *(Note: per-user vote deduplication deferred to T35)* | 30 / min | `explain/rate:<userId>` | fixed |
| `/api/progress` | POST | Authenticated | Server verifies session `user.id`; reads/writes only caller's rows (`lesson_progress`, `lesson_completions`, `streaks`, `points_log`, `step_attempts`) | 60 / min | `progress:<userId>` | fixed |
| `/api/progress/merge` | POST | Authenticated | Server verifies session `user.id`; merges offline progress strictly into caller's rows | 20 / min | `progress/merge:<userId>` | fixed |
| `/api/progress/reset` | POST | Authenticated | Server verifies session `user.id`; deletes only `lesson_progress` where `user_id = user.id` | 5 / min | `progress/reset:<userId>` | fixed |
| `/api/share-bonus` | POST | Authenticated | Server verifies session `user.id`; atomically sets `profiles.shared_on_linkedin = true` and inserts 500 points for caller | 5 / min | `share-bonus:<userId>` | fixed |
| `/api/checkout` | GET | Authenticated | Server verifies session `user.id`; queries only caller's profile and subscriptions | N/A (read) | - | ✅ |
| `/api/checkout` | POST | Authenticated | Server verifies session `user.id`; checks entitlement and creates checkout subscription for caller's `user.id` | 10 / min | `checkout:<userId>` | fixed |
| `/api/billing/manage` | POST | Authenticated | Server verifies session `user.id`; cancels only caller's own active Razorpay subscription | 5 / min | `billing/manage:<userId>` | fixed |
| `/api/dashboard` | GET | Authenticated | Server verifies session `user.id`; reads only caller's rows (`lesson_progress`, `points_log`, `streaks`) | N/A (read) | - | ✅ |
| `/api/leaderboard` | GET | Public | Public top 3 entries (no emails/user IDs returned). If signed in, computes caller's personal points/streak via `user_id = user.id` | N/A (read) | - | ✅ |
| `/api/lessons/[id]/access` | GET | Public | Evaluates access based on session `user.id` | N/A (read) | - | ✅ |
| `/api/lessons/[id]/workbook` | GET | Authenticated / Allowed | Verifies user has access to lesson before generating `.xlsx` | N/A (read) | - | ✅ |
| `/api/webhooks/razorpay` | POST | Webhook Signature | Verifies HMAC-SHA256 signature using `RAZORPAY_WEBHOOK_SECRET`; deduplicates events via `webhook_events`; modifies only subscription/profile for matching user ID | Webhook-deduped | Handled by payments webhook handler | ✅ |
| `/api/webhooks/stripe` | POST | Disabled | Returns 503 unavailable | - | - | ✅ |

---

## 4. Secrets and Environment Variables Isolation

All secrets are confined to server-side code execution. Server-only libraries import `"server-only"` to prevent accidental inclusion in client-side bundles during build time.

| Environment Variable | Secret? | NEXT_PUBLIC_? | Imported in Client Component? | Usage Locations | Status |
|---|:---:|:---:|:---:|---|:---:|
| `NEXT_PUBLIC_BASE_URL` | No | Yes | No | Public site origin configuration | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Yes | Yes (browser client) | Supabase project endpoint | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No (publishable) | Yes | Yes (browser client) | Supabase anon key (RLS enforced) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | **YES** | No | **No** (`import "server-only"`) | `lib/supabase/admin.ts`, `api/waitlist/route.ts` | ✅ |
| `PAYMENTS_ENABLED` | No (flag) | No | **No** | Server-side feature flag | ✅ |
| `RAZORPAY_KEY_ID` | Semi-public | No | **No** | Server checkout payload generation | ✅ |
| `RAZORPAY_KEY_SECRET` | **YES** | No | **No** | Razorpay REST API auth in server routes | ✅ |
| `RAZORPAY_WEBHOOK_SECRET` | **YES** | No | **No** | Razorpay webhook signature verification | ✅ |
| `RAZORPAY_PLAN_MONTHLY` | No (ID) | No | **No** | Razorpay plan ID mapping | ✅ |
| `RAZORPAY_PLAN_ANNUAL` | No (ID) | No | **No** | Razorpay plan ID mapping | ✅ |
| `STRIPE_SECRET_KEY` | **YES** | No | **No** | Stripe server integration (deferred) | ✅ |
| `STRIPE_WEBHOOK_SECRET` | **YES** | No | **No** | Stripe webhook signature (deferred) | ✅ |
| `GEMINI_API_KEY` | **YES** | No | **No** | Google Generative AI API calls in `explain.ts` | ✅ |
| `GEMINI_MODEL` | No (config) | No | **No** | Gemini model identifier | ✅ |
| `EXPLAIN_IP_SALT` | **YES** | No | **No** | Salting unauthenticated IP hashes in `explain.ts` & `rate-limit.ts` | ✅ |

---

## 5. Rate Limiting Mechanism (Migration 0005 & `rate-limit.ts`)

- **Table `public.rate_limits`**:
  - `(key text, window_start timestamptz, count int, primary key (key, window_start))`
  - RLS enabled, zero policies (closed to `anon` and `authenticated`).
- **Function `public.hit_rate_limit(p_key, p_max, p_window_seconds)`**:
  - `security definer`, `set search_path = public`.
  - Atomically upserts and increments the counter for the aligned time bucket.
  - Returns `boolean` (`true` = allowed, `false` = limit exceeded).
  - Cleans up records older than 1 day probabilistically (~1% of invocations).
  - Executable only by `service_role` (`revoke all ... from public, anon, authenticated; grant execute ... to service_role`).
- **Client library `apps/web/lib/rate-limit.ts`**:
  - `rateLimit(admin, key, max, windowSeconds): Promise<boolean>`
  - Invokes `admin.rpc("hit_rate_limit", { p_key, p_max, p_window_seconds })`.
  - **Fails open**: If the RPC or network fails, logs a short error to `console.error` and allows the request (`return true`), ensuring rate-limiter outages do not break the application.
  - Frozen contract: All rate-limited routes return HTTP 429 with `{"error":"rate_limited"}`.

---

## 6. Pre-Launch Owner Verification Items

| Item | Description | Responsibility | Status |
|---|---|:---:|:---:|
| Run migration `0005_security.sql` | Execute `supabase/migrations/0005_security.sql` in the Supabase SQL editor on the production and staging databases. | Owner | ⚠ owner |
| Test Razorpay Refund Flow | Make one test purchase (or ₹499 live test) and trigger a refund from the Razorpay dashboard to verify end-to-end ledger reconciliation. | Owner | ⚠ owner |
| Production Build Secret Grep | Automated grep over production `.next` build output bundles ensuring no service keys or private secrets are leaked into client JS bundles. | Claude | ✅ 0 hits in .next/static (17 Nov) |
