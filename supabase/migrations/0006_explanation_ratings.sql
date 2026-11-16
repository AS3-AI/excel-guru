-- T35: One AI rating per user
-- Tracks individual 👍/👎 votes per explanation and updates ai_explanations.score atomically.

create table if not exists public.explanation_ratings (
  explanation_id uuid not null references public.ai_explanations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  helpful boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (explanation_id, user_id)
);

create index if not exists explanation_ratings_user_id_idx
  on public.explanation_ratings (user_id);

alter table public.explanation_ratings enable row level security;

create or replace function public.rate_explanation(
  p_explanation_id uuid,
  p_user_id uuid,
  p_helpful boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_helpful boolean;
  v_old_val integer;
  v_new_val integer;
  v_delta integer;
  v_new_score integer;
begin
  -- Lock the explanation row: serialises every vote on it, including two first votes by the same user
  perform 1 from public.ai_explanations where id = p_explanation_id for update;
  if not found then
    return null;
  end if;

  -- Lock previous vote if it exists
  select helpful into v_old_helpful
  from public.explanation_ratings
  where explanation_id = p_explanation_id
    and user_id = p_user_id
  for update;

  v_old_val := case
    when v_old_helpful is null then 0
    when v_old_helpful then 1
    else -1
  end;

  v_new_val := case
    when p_helpful then 1
    else -1
  end;

  v_delta := v_new_val - v_old_val;

  insert into public.explanation_ratings (explanation_id, user_id, helpful)
  values (p_explanation_id, p_user_id, p_helpful)
  on conflict (explanation_id, user_id)
  do update set helpful = excluded.helpful, updated_at = now();

  -- Atomic update of score
  update public.ai_explanations
  set score = score + v_delta
  where id = p_explanation_id
  returning score into v_new_score;

  return v_new_score;
end;
$$;

revoke all on function public.rate_explanation(uuid, uuid, boolean) from public;
revoke all on function public.rate_explanation(uuid, uuid, boolean) from anon, authenticated;
grant execute on function public.rate_explanation(uuid, uuid, boolean) to service_role;
