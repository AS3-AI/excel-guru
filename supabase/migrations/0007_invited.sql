-- Invited learners get full access without paying.
alter table public.profiles add column if not exists invited boolean not null default false;

-- Backfill: email signups since invite-only stored the code in user metadata.
update public.profiles p
set invited = true
from auth.users u
where u.id = p.user_id and coalesce(u.raw_user_meta_data->>'invite', '') <> '';
