alter table public.lesson_completions
  add column if not exists ist_day date;

update public.lesson_completions
set ist_day = (completed_at at time zone 'Asia/Kolkata')::date
where ist_day is null;

with ranked as (
  select id, row_number() over (
    partition by user_id, lesson_id, ist_day
    order by completed_at asc, id asc
  ) as occurrence
  from public.lesson_completions
  where points > 0
)
update public.lesson_completions as completion
set points = 0
from ranked
where completion.id = ranked.id
  and ranked.occurrence > 1;

-- Default keeps inserts from code that doesn't set ist_day working (deploy order doesn't matter).
alter table public.lesson_completions
  alter column ist_day set default ((now() at time zone 'Asia/Kolkata')::date);

alter table public.lesson_completions
  alter column ist_day set not null;

create unique index if not exists lesson_completions_points_once_per_day_idx
  on public.lesson_completions (user_id, lesson_id, ist_day)
  where points > 0;
