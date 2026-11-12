-- T1: landing-page waitlist. Writes go through /api/waitlist with the service key.
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null unique check (email = lower(email)),
  source text not null default 'landing',
  country text,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: anon/authenticated can neither read nor write.
alter table public.waitlist enable row level security;
