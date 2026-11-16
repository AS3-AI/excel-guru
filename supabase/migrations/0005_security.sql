-- T46: Security pass - Rate limiting table and RPC, view security enforcement.

-- ---------------------------------------------------------------------------
-- 1. Rate limits table
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);
create index if not exists rate_limits_window_start_idx on public.rate_limits (window_start);

-- RLS on with no policies: anon and authenticated cannot read or write directly.
alter table public.rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- 2. hit_rate_limit RPC
-- Atomic upsert-and-increment; returns true if allowed, false if limit exceeded.
-- Set to security definer with search_path = public.
-- Executable only by service_role.
-- ---------------------------------------------------------------------------
create or replace function public.hit_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  if p_window_seconds <= 0 or p_max <= 0 then
    return false;
  end if;

  -- Occasionally (approx 1% of calls) purge entries older than 1 day
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Leaderboard views hardening
-- Obey caller RLS; revoked from anon and authenticated.
-- ---------------------------------------------------------------------------
alter view public.leaderboard_points_today set (security_invoker = true);
alter view public.leaderboard_streaks_today set (security_invoker = true);

revoke all on public.leaderboard_points_today from anon, authenticated;
revoke all on public.leaderboard_streaks_today from anon, authenticated;
