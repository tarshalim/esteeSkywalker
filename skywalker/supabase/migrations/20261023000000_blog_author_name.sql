-- Stamp each post with its publisher's display name as `data.authorName`, so
-- readers (who can't see auth.users or other people's profiles) get it with
-- the post. Falls back to the username when no display name is set. The
-- trigger, not the client, writes it, so nobody can post under another name.

create or replace function public.stamp_blog_author()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  name text;
begin
  if new.owner_id is not null then
    select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), p.username)
      into name
      from auth.users u left join public.profiles p on p.id = u.id
      where u.id = new.owner_id;
  end if;
  new.data := new.data - 'authorName'
    || case when name is null then '{}'::jsonb else jsonb_build_object('authorName', name) end;
  return new;
end;
$$;

drop trigger if exists blogs_stamp_author on public.blogs;
create trigger blogs_stamp_author
  before insert or update on public.blogs
  for each row execute function public.stamp_blog_author();

-- Renaming yourself on the Account page re-stamps your posts.
create or replace function public.restamp_blog_authors()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.raw_user_meta_data ->> 'display_name' is distinct from old.raw_user_meta_data ->> 'display_name' then
    update public.blogs set data = data where owner_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_display_name_change on auth.users;
create trigger on_auth_user_display_name_change
  after update of raw_user_meta_data on auth.users
  for each row execute function public.restamp_blog_authors();

-- Backfill existing posts (the update re-runs the stamp trigger).
update public.blogs set data = data;
