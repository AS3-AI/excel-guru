-- T2: core schema (SPEC: Data model, System design §7, Product spec §15).
--
-- Security model: row-level security is ON for every table. Learners may only
-- SELECT their own rows (user_id = auth.uid()). There are deliberately NO
-- insert/update/delete policies: every write goes through a server route using
-- the service key, so points, progress and entitlements can't be forged from
-- the browser. Tables without a per-user owner have RLS on and no policies.
--
-- Lesson, step and review-item ids are text: lessons live as JSON in the repo.
-- Accuracy values are fractions in [0, 1].
-- Every table cascades on auth.users delete so "Delete account" (§10) is one call.
-- Written to be re-runnable: if not exists / or replace / drop policy if exists.

-- ---------------------------------------------------------------------------
-- groups: institutional cohorts. Membership is profiles.group_id.
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  admin_id uuid references auth.users (id) on delete set null,
  has_paid_access boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists groups_admin_id_idx on public.groups (admin_id);

-- ---------------------------------------------------------------------------
-- profiles: one row per learner, created at sign-up or onboarding.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text not null check (char_length(first_name) between 1 and 50),
  -- Same rule as apps/web/lib/auth.ts USERNAME_RE.
  username text not null unique check (username ~ '^[a-z][a-z0-9_]{2,19}$'),
  is_premium boolean not null default false, -- cache, recomputed by the webhook handler
  plan text check (plan in ('monthly', 'annual', 'lifetime')),
  linkedin_url text,
  shared_on_linkedin boolean not null default false,
  last_active_at timestamptz,
  group_id uuid references public.groups (id) on delete set null,
  cohort text,
  created_at timestamptz not null default now()
);
create index if not exists profiles_group_id_idx on public.profiles (group_id);

-- ---------------------------------------------------------------------------
-- lesson_progress: one row per learner and lesson; cleared by Reset Progress.
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  first_try_accuracy real check (first_try_accuracy between 0 and 1),
  times_completed integer not null default 1 check (times_completed >= 0),
  primary key (user_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- points_log: every points award. Feeds today's high scores (IST).
-- ---------------------------------------------------------------------------
create table if not exists public.points_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists points_log_created_at_idx on public.points_log (created_at);
create index if not exists points_log_user_created_idx on public.points_log (user_id, created_at);

-- ---------------------------------------------------------------------------
-- streaks: one row per learner. last_active_date is an IST calendar date.
-- ---------------------------------------------------------------------------
create table if not exists public.streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current integer not null default 0 check (current >= 0),
  longest integer not null default 0 check (longest >= 0),
  last_active_date date
);
create index if not exists streaks_last_active_idx on public.streaks (last_active_date, current desc);

-- ---------------------------------------------------------------------------
-- daily_challenge_scores: one score per learner per IST date.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_challenge_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  accuracy real not null check (accuracy between 0 and 1),
  time_ms integer not null check (time_ms >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);
create index if not exists daily_challenge_scores_rank_idx
  on public.daily_challenge_scores (date, accuracy desc, time_ms);

-- ---------------------------------------------------------------------------
-- certificates: one per learner. name_lower powers the /verify name search.
-- ---------------------------------------------------------------------------
create table if not exists public.certificates (
  credential_id text primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  name_lower text generated always as (lower(name)) stored,
  pdf_url text,
  issued_at timestamptz not null default now()
);
create index if not exists certificates_name_lower_idx
  on public.certificates (name_lower text_pattern_ops);

-- ---------------------------------------------------------------------------
-- subscriptions + webhook_events (System design §7).
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('razorpay', 'stripe')),
  provider_ref text not null,
  plan text not null check (plan in ('monthly', 'annual', 'lifetime')),
  status text not null check (status in ('active', 'cancelled', 'past_due')),
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

-- Idempotency log: a duplicate event_id means "already handled, return 200".
create table if not exists public.webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Product spec §15 additions.
-- ---------------------------------------------------------------------------

-- Append-only history; survives Reset Progress. Stores the learner's group and
-- cohort at completion time for the admin grid.
create table if not exists public.lesson_completions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  first_try_accuracy real check (first_try_accuracy between 0 and 1),
  points integer not null default 0,
  group_id uuid references public.groups (id) on delete set null,
  cohort text
);
create index if not exists lesson_completions_user_idx on public.lesson_completions (user_id, completed_at);
create index if not exists lesson_completions_group_idx on public.lesson_completions (group_id, completed_at);

-- Every step attempt; first-try accuracy is derived from these.
create table if not exists public.step_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  step_id text not null,
  correct boolean not null,
  first_try boolean not null,
  showed_answer boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz not null default now()
);
create index if not exists step_attempts_user_lesson_idx on public.step_attempts (user_id, lesson_id);

-- AI explanation cache. Several rows may share a key: a downvoted one (score < 0)
-- stops being served and a fresh one is generated.
create table if not exists public.ai_explanations (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  step_id text not null,
  input_norm text not null,
  text text not null,
  score integer not null default 0,
  served_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_explanations_lookup_idx
  on public.ai_explanations (lesson_id, step_id, input_norm, score desc);

-- Review misses for Suggested Practice (last 30 days).
create table if not exists public.review_misses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  lesson_id text not null,
  missed_at timestamptz not null default now()
);
create index if not exists review_misses_user_idx on public.review_misses (user_id, missed_at);

-- Group admin invitations.
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  email text not null check (email = lower(email)),
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default now(),
  cohort text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  unique (group_id, email)
);
create index if not exists invitations_email_idx on public.invitations (email);

-- Institutional email domains -> group (never hard-coded). One group per domain.
create table if not exists public.group_domains (
  domain text primary key check (domain = lower(domain)),
  group_id uuid not null references public.groups (id) on delete cascade
);
create index if not exists group_domains_group_id_idx on public.group_domains (group_id);

-- ---------------------------------------------------------------------------
-- Row-level security.
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.points_log enable row level security;
alter table public.streaks enable row level security;
alter table public.daily_challenge_scores enable row level security;
alter table public.certificates enable row level security;
alter table public.subscriptions enable row level security;
alter table public.webhook_events enable row level security;      -- no policies
alter table public.lesson_completions enable row level security;
alter table public.step_attempts enable row level security;
alter table public.ai_explanations enable row level security;     -- no policies
alter table public.review_misses enable row level security;
alter table public.invitations enable row level security;
alter table public.group_domains enable row level security;       -- no policies

-- Read own rows only. (select auth.uid()) is evaluated once per query, not per row.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own lesson_progress" on public.lesson_progress;
create policy "read own lesson_progress" on public.lesson_progress
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own points_log" on public.points_log;
create policy "read own points_log" on public.points_log
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own streak" on public.streaks;
create policy "read own streak" on public.streaks
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own daily_challenge_scores" on public.daily_challenge_scores;
create policy "read own daily_challenge_scores" on public.daily_challenge_scores
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own certificate" on public.certificates;
create policy "read own certificate" on public.certificates
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own subscriptions" on public.subscriptions;
create policy "read own subscriptions" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own lesson_completions" on public.lesson_completions;
create policy "read own lesson_completions" on public.lesson_completions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own step_attempts" on public.step_attempts;
create policy "read own step_attempts" on public.step_attempts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own review_misses" on public.review_misses;
create policy "read own review_misses" on public.review_misses
  for select to authenticated using (user_id = (select auth.uid()));

-- A group is "owned" by its admin and visible to its members.
drop policy if exists "read own group" on public.groups;
create policy "read own group" on public.groups
  for select to authenticated using (
    admin_id = (select auth.uid())
    or id = (select p.group_id from public.profiles p where p.user_id = (select auth.uid()))
  );

-- Invitations are owned by the admin of their group.
drop policy if exists "group admin reads invitations" on public.invitations;
create policy "group admin reads invitations" on public.invitations
  for select to authenticated using (
    exists (
      select 1 from public.groups g
      where g.id = invitations.group_id and g.admin_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Leaderboards: today in IST (Asia/Kolkata). Points reset at midnight IST.
-- security_invoker = true so the views obey the caller's RLS; /api/leaderboard
-- reads them with the service key. Not readable by anon/authenticated directly.
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard_points_today
with (security_invoker = true) as
select
  pl.user_id,
  p.username,
  p.first_name,
  p.linkedin_url,
  sum(pl.points)::integer as points,
  rank() over (order by sum(pl.points) desc) as rank
from public.points_log pl
join public.profiles p on p.user_id = pl.user_id
-- Start of today in IST, as a timestamptz; index-friendly range on created_at.
where pl.created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
group by pl.user_id, p.username, p.first_name, p.linkedin_url;

create or replace view public.leaderboard_streaks_today
with (security_invoker = true) as
select
  s.user_id,
  p.username,
  p.first_name,
  p.linkedin_url,
  s.current as streak,
  rank() over (order by s.current desc) as rank
from public.streaks s
join public.profiles p on p.user_id = s.user_id
where s.last_active_date = (now() at time zone 'Asia/Kolkata')::date
  and s.current > 0;

revoke all on public.leaderboard_points_today from anon, authenticated;
revoke all on public.leaderboard_streaks_today from anon, authenticated;
