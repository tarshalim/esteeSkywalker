-- Account roles. Every auth user gets a profile row:
--   user        – can sign in, read-only
--   admin       – can create/edit/delete blogs, templates, photos, pins, media
--   super_admin – everything an admin can, plus managing other accounts' roles
-- Roles are only changed through set_user_role(); profiles has no update policy.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin', 'super_admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- security definer so policies can call these without recursing into
-- profiles' own RLS.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.my_role() in ('admin', 'super_admin'), false);
$$;

create policy "read own or all as super admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.my_role() = 'super_admin');

-- New sign-ups get a profile. If nobody is super admin yet (fresh project),
-- the first account becomes one so there's always someone who can promote others.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when exists (select 1 from public.profiles where role = 'super_admin') then 'user' else 'super_admin' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill accounts created before this migration; the oldest one becomes the
-- super admin.
insert into public.profiles (id, email, created_at)
select id, email, created_at from auth.users
on conflict (id) do nothing;

update public.profiles set role = 'super_admin'
where id = (select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'super_admin');

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
  if new_role not in ('user', 'admin', 'super_admin') then
    raise exception 'Unknown role %', new_role;
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- Content: anyone can read, only admins can write. Drop every earlier write
-- policy — policies are OR'd, so any leftover "signed-in"/"owner" one would
-- still let plain users write.
do $$
declare
  t text;
begin
  foreach t in array array['blogs', 'templates', 'photos', 'pins'] loop
    execute format('drop policy if exists %I on public.%I', 'anon all ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'public read ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'signed-in insert ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'owner update ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'owner delete ' || t, t);
  end loop;
end;
$$;

create policy "public read blogs" on public.blogs for select to anon, authenticated using (true);
create policy "public read templates" on public.templates for select to anon, authenticated using (true);
create policy "public read photos" on public.photos for select to anon, authenticated using (true);
create policy "public read pins" on public.pins for select to anon, authenticated using (true);

create policy "admin write blogs" on public.blogs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write templates" on public.templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write photos" on public.photos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write pins" on public.pins for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anon upload media" on storage.objects;
drop policy if exists "signed-in upload media" on storage.objects;
create policy "admin upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
