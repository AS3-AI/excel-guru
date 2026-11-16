-- Server-only log of uncached Gemini explanation calls. Caller values are
-- SHA-256 hashes; raw user ids and IP addresses are never stored.
create table if not exists public.explain_calls (
  id bigint generated always as identity primary key,
  caller text not null,
  called_at timestamptz not null default now()
);
create index if not exists explain_calls_caller_called_at_idx
  on public.explain_calls (caller, called_at);

alter table public.explain_calls enable row level security;
