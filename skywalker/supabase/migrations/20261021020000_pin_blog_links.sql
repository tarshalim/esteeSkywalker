-- Globe pins <-> blog posts. A pin is a shared location hub ("Kyoto, Japan")
-- that holds any number of stories; a post belongs to at most one pin
-- (one-to-many: pins 1 — * blogs).
--   blogs.pin_id: the pin this post is filed under, null when unpinned.
-- The app also keeps `pinId` inside `data` (it reads posts from the jsonb);
-- the trigger below makes the column the source of truth, so deleting a pin
-- (ON DELETE SET NULL) clears `data.pinId` too instead of leaving it dangling.

alter table public.blogs
  add column if not exists pin_id text references public.pins (id) on delete set null;

create index if not exists blogs_pin_id_idx on public.blogs (pin_id);

create or replace function public.sync_blog_pin_id()
returns trigger
language plpgsql
as $$
begin
  new.data := case
    when new.pin_id is null then new.data - 'pinId'
    else jsonb_set(new.data, '{pinId}', to_jsonb(new.pin_id))
  end;
  return new;
end;
$$;

drop trigger if exists blogs_sync_pin_id on public.blogs;
create trigger blogs_sync_pin_id
  before insert or update on public.blogs
  for each row execute function public.sync_blog_pin_id();

-- Live globe: stream pin/post changes to open clients (src/lib/liveSync.js).
-- Realtime still applies RLS, so viewers never receive drafts.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['pins', 'blogs'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
