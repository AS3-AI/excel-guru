-- Server-only record of lessons opened by learners. Premium opens are not stored.
create table if not exists public.lesson_opens (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  opened_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.lesson_opens enable row level security;
