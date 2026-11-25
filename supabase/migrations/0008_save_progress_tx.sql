-- Atomic lesson progress save: wraps completion, progress, step attempts,
-- points log, and streak update in a single transaction.
create or replace function public.save_lesson_progress(
  p_user_id uuid,
  p_lesson_id text,
  p_completed_at timestamptz,
  p_ist_day date,
  p_first_try_accuracy real,
  p_points integer,
  p_group_id uuid,
  p_cohort text,
  p_streak_current integer,
  p_streak_longest integer,
  p_attempts jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points integer := greatest(0, coalesce(p_points, 0));
begin
  begin
    insert into public.lesson_completions (
      user_id, lesson_id, completed_at, ist_day, first_try_accuracy, points, group_id, cohort
    ) values (
      p_user_id, p_lesson_id, p_completed_at, p_ist_day, p_first_try_accuracy, v_points, p_group_id, p_cohort
    );
  exception when unique_violation then
    if v_points = 0 then
      raise;
    end if;
    v_points := 0;
    insert into public.lesson_completions (
      user_id, lesson_id, completed_at, ist_day, first_try_accuracy, points, group_id, cohort
    ) values (
      p_user_id, p_lesson_id, p_completed_at, p_ist_day, p_first_try_accuracy, 0, p_group_id, p_cohort
    );
  end;

  insert into public.lesson_progress (
    user_id, lesson_id, completed_at, first_try_accuracy, times_completed
  ) values (
    p_user_id, p_lesson_id, p_completed_at, p_first_try_accuracy, 1
  )
  on conflict (user_id, lesson_id) do update set
    completed_at = excluded.completed_at,
    first_try_accuracy = excluded.first_try_accuracy,
    times_completed = public.lesson_progress.times_completed + 1;

  if p_attempts is not null and jsonb_typeof(p_attempts) = 'array' and jsonb_array_length(p_attempts) > 0 then
    insert into public.step_attempts (
      user_id, lesson_id, step_id, correct, first_try, showed_answer, started_at, ended_at
    )
    select
      p_user_id,
      p_lesson_id,
      a.step_id,
      a.correct,
      a.first_try,
      a.showed_answer,
      a.started_at,
      coalesce(a.ended_at, p_completed_at)
    from jsonb_to_recordset(p_attempts) as a(
      step_id text,
      correct boolean,
      first_try boolean,
      showed_answer boolean,
      started_at timestamptz,
      ended_at timestamptz
    );
  end if;

  if v_points > 0 then
    insert into public.points_log (user_id, points, reason, created_at)
    values (p_user_id, v_points, 'lesson:' || p_lesson_id, p_completed_at);
  end if;

  insert into public.streaks (user_id, current, longest, last_active_date)
  values (p_user_id, p_streak_current, p_streak_longest, p_ist_day)
  on conflict (user_id) do update set
    current = excluded.current,
    longest = greatest(public.streaks.longest, excluded.longest),
    last_active_date = excluded.last_active_date;

  return v_points;
end;
$$;

revoke all on function public.save_lesson_progress(
  uuid, text, timestamptz, date, real, integer, uuid, text, integer, integer, jsonb
) from public, anon, authenticated;

grant execute on function public.save_lesson_progress(
  uuid, text, timestamptz, date, real, integer, uuid, text, integer, integer, jsonb
) to service_role;
