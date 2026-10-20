-- Username accounts with super-admin approval.
--   * Accounts are identified by a username. Supabase Auth still needs an
--     email, so the app signs up with a synthetic "<username>@<domain>"
--     address and passes the username in user metadata.
--   * New sign-ups start as 'pending' and can't do anything until a super
--     admin approves them (sets them to user/admin) or rejects them (deletes).
-- Turn OFF "Confirm email" in Auth > Providers > Email — the synthetic
-- addresses can't receive mail.

alter table public.profiles add column if not exists username text;

-- Backfill existing accounts from the email's local part, de-duplicated with
-- a slice of the id where needed.
with base as (
  select id, lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')) as name,
         row_number() over (partition by lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')) order by created_at) as n
  from public.profiles
  where username is null
)
update public.profiles p
set username = case when b.n = 1 then b.name else b.name || '_' || left(p.id::text, 4) end
from base b
where p.id = b.id;

alter table public.profiles alter column username set not null;
create unique index if not exists profiles_username_key on public.profiles (lower(username));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('pending', 'user', 'admin', 'super_admin'));
alter table public.profiles alter column role set default 'pending';

-- The first account on a fresh project is still made super admin so someone
-- can approve the rest.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, role)
  values (
    new.id,
    new.email,
    lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1))),
    case when exists (select 1 from public.profiles where role = 'super_admin') then 'pending' else 'super_admin' end
  );
  return new;
end;
$$;

create or replace function public.set_user_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.my_role() is distinct from 'super_admin' then
    raise exception 'Only super admins can change roles';
  end if;
  if target = auth.uid() then
    raise exception 'You can''t change your own role';
  end if;
  if new_role not in ('pending', 'user', 'admin', 'super_admin') then
    raise exception 'Unknown role %', new_role;
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

-- Rejecting a sign-up deletes it, freeing the username. Limited to pending
-- accounts so an approved account can't be wiped by a misclick.
create or replace function public.reject_account(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if public.my_role() is distinct from 'super_admin' then
    raise exception 'Only super admins can reject accounts';
  end if;
  if not exists (select 1 from public.profiles where id = target and role = 'pending') then
    raise exception 'Only pending accounts can be rejected';
  end if;
  delete from auth.users where id = target;
end;
$$;

revoke execute on function public.reject_account(uuid) from public, anon;
grant execute on function public.reject_account(uuid) to authenticated;
