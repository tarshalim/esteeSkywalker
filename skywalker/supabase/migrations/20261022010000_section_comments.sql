-- Section-anchored comments and emoji reactions on published posts.
--   * A "section" is a block id (block posts) or canvas element id (scrapbook
--     posts); it's opaque text here so either works.
--   * Approved accounts comment as themselves; everyone else (anon visitors and
--     still-pending accounts) comments as a guest with a display name and an
--     optional email. The trigger, not the client, decides which — so nobody
--     can post under someone else's username.
--   * Guest emails are kept for moderation only: readers can't select them.

create table if not exists public.section_comments (
  id uuid primary key default gen_random_uuid(),
  blog_id text not null references public.blogs (id) on delete cascade,
  section_id text not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  user_id uuid references auth.users (id) on delete set null,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 60),
  author_email text check (author_email is null or (char_length(author_email) <= 254 and author_email like '%_@_%')),
  author_avatar text,
  is_guest boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists section_comments_blog_idx on public.section_comments (blog_id, created_at);

create or replace function public.stamp_section_comment()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.user_id := case when public.my_role() in ('user', 'admin', 'super_admin') then auth.uid() end;
  new.is_guest := new.user_id is null;
  new.body := btrim(new.body);
  new.created_at := now();
  if new.is_guest then
    new.author_name := btrim(new.author_name);
    new.author_email := nullif(lower(btrim(new.author_email)), '');
    new.author_avatar := null;
  else
    select p.username, u.raw_user_meta_data ->> 'avatar'
      into new.author_name, new.author_avatar
      from public.profiles p join auth.users u on u.id = p.id
      where p.id = new.user_id;
    new.author_email := null;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_section_comment on public.section_comments;
create trigger stamp_section_comment
  before insert on public.section_comments
  for each row execute function public.stamp_section_comment();

alter table public.section_comments enable row level security;

-- Comments follow their post's visibility (drafts stay admin-only).
create policy "read comments on visible posts" on public.section_comments
  for select to anon, authenticated
  using (exists (select 1 from public.blogs b where b.id = blog_id and (b.status = 'published' or public.is_admin())));

create policy "comment on published posts" on public.section_comments
  for insert to anon, authenticated
  with check (exists (select 1 from public.blogs b where b.id = blog_id and b.status = 'published'));

create policy "delete own comment or moderate" on public.section_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Hide author_email from readers: column grants instead of table-wide select.
revoke select on public.section_comments from anon, authenticated;
grant select (id, blog_id, section_id, body, user_id, author_name, author_avatar, is_guest, created_at)
  on public.section_comments to anon, authenticated;
grant insert (blog_id, section_id, body, author_name, author_email) on public.section_comments to anon, authenticated;
grant delete on public.section_comments to authenticated;

-- Reactions: one row per (section, emoji, reactor). `reactor` is 'u:<uid>' for
-- accounts and 'g:<key>' for guests, where the key is a random id the browser
-- keeps. No table policies: reads and toggles go through the functions below,
-- so guest keys are never exposed to other readers.
create table if not exists public.section_reactions (
  blog_id text not null references public.blogs (id) on delete cascade,
  section_id text not null,
  emoji text not null check (emoji in ('❤️', '👏', '😍', '📍', '😂')),
  reactor text not null,
  created_at timestamptz not null default now(),
  primary key (blog_id, section_id, emoji, reactor)
);

alter table public.section_reactions enable row level security;

create or replace function public.section_reactor(guest_key text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.my_role() in ('user', 'admin', 'super_admin') then
    return 'u:' || auth.uid();
  end if;
  if guest_key is null or guest_key !~ '^[A-Za-z0-9-]{16,64}$' then
    return null;
  end if;
  return 'g:' || guest_key;
end;
$$;

create or replace function public.section_reaction_counts(p_blog text, guest_key text default null)
returns table (section_id text, emoji text, count bigint, mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.section_id, r.emoji, count(*), coalesce(bool_or(r.reactor = public.section_reactor(guest_key)), false)
  from public.section_reactions r
  join public.blogs b on b.id = r.blog_id
  where r.blog_id = p_blog and (b.status = 'published' or public.is_admin())
  group by r.section_id, r.emoji;
$$;

-- Adds the reaction, or removes it if this reader already left it. Returns
-- whether the reaction is now on.
create or replace function public.toggle_section_reaction(p_blog text, p_section text, p_emoji text, guest_key text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  who text := public.section_reactor(guest_key);
begin
  if who is null then
    raise exception 'Missing reactor key';
  end if;
  if not exists (select 1 from public.blogs where id = p_blog and status = 'published') then
    raise exception 'Reactions are only open on published posts';
  end if;
  delete from public.section_reactions
    where blog_id = p_blog and section_id = p_section and emoji = p_emoji and reactor = who;
  if found then
    return false;
  end if;
  insert into public.section_reactions (blog_id, section_id, emoji, reactor)
    values (p_blog, left(p_section, 120), p_emoji, who);
  return true;
end;
$$;

revoke execute on function public.section_reactor(text) from public, anon, authenticated;
grant execute on function public.section_reaction_counts(text, text) to anon, authenticated;
grant execute on function public.toggle_section_reaction(text, text, text, text) to anon, authenticated;
