-- Location -> Trip -> (Blog posts, Gallery items) hierarchy.
--
--   locations        (was `pins`) a place on the globe: "Kyoto, Japan"
--     trips          one journey at a location, with a start/end date
--       trip_companions   who came along, per date interval within the trip
--       blogs        stories written within a trip           (blogs.trip_id)
--       gallery_items (was `photos`) photos/videos of a trip  (gallery_items.trip_id),
--                    optionally attached to one of its posts  (gallery_items.blog_id)
--
-- `location_id` on blogs/gallery_items is derived from the trip whenever there
-- is one, so a post or photo can never sit at a different place than its trip.
-- A post can still be filed under a location without a trip (older posts, quick
-- notes), and a gallery item may be unfiled entirely.
--
-- The app keeps reading objects out of `data`; the triggers below mirror the
-- columns back into it (data.pinId = location id, data.tripId, data.blogId) so
-- the columns stay the source of truth, as blogs.pin_id did before.

-- ---------------------------------------------------------------------------
-- Locations (pins renamed). Policies, the realtime publication and the
-- blogs.pin_id foreign key all follow the table through the rename.
-- ---------------------------------------------------------------------------
alter table if exists public.pins rename to locations;

alter table public.locations
  add column if not exists name text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists country_code text,
  add column if not exists city text;

update public.locations
set name = coalesce(data ->> 'placeName', data ->> 'title'),
    lat = (data ->> 'lat')::double precision,
    lng = (data ->> 'lng')::double precision,
    country_code = nullif(data ->> 'countryCode', ''),
    city = nullif(data ->> 'city', '')
where name is null;

create index if not exists locations_country_city_idx on public.locations (country_code, city);

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id text primary key,
  location_id text not null references public.locations (id) on delete cascade,
  title text not null,
  start_date date not null,
  end_date date not null,
  data jsonb not null default '{}'::jsonb,
  owner_id uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_date_range_check check (end_date >= start_date),
  constraint trips_title_check check (length(btrim(title)) > 0)
);

create index if not exists trips_location_id_idx on public.trips (location_id);
create index if not exists trips_start_date_idx on public.trips (start_date);

-- Who you were with, per phase of the trip: "Aiko, Ben: Oct 1–4", "Ben: Oct 5–9".
-- Intervals may overlap (someone joins for a few days of a longer stretch).
create table if not exists public.trip_companions (
  id text primary key default gen_random_uuid()::text,
  trip_id text not null references public.trips (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  companion_names text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint trip_companions_date_range_check check (end_date >= start_date),
  constraint trip_companions_names_check check (cardinality(companion_names) > 0)
);

create index if not exists trip_companions_trip_id_idx on public.trip_companions (trip_id);
create index if not exists trip_companions_names_idx on public.trip_companions using gin (companion_names);

-- An interval must sit inside its trip's dates.
create or replace function public.check_trip_companion_bounds()
returns trigger
language plpgsql
as $$
declare
  t record;
begin
  select start_date, end_date into t from public.trips where id = new.trip_id;
  if new.start_date < t.start_date or new.end_date > t.end_date then
    raise exception 'Companion dates (% – %) must fall within the trip (% – %)',
      new.start_date, new.end_date, t.start_date, t.end_date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trip_companions_check_bounds on public.trip_companions;
create trigger trip_companions_check_bounds
  before insert or update on public.trip_companions
  for each row execute function public.check_trip_companion_bounds();

-- Trip columns mirrored into data, like the other tables.
create or replace function public.sync_trip_data()
returns trigger
language plpgsql
as $$
begin
  new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
    'id', new.id,
    'locationId', new.location_id,
    'title', new.title,
    'startDate', new.start_date,
    'endDate', new.end_date
  );
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trips_sync_data on public.trips;
create trigger trips_sync_data
  before insert or update on public.trips
  for each row execute function public.sync_trip_data();

-- Shrinking a trip can't strand companion intervals outside it. Deferred to
-- commit, so save_trip can change the dates and replace the intervals together.
create or replace function public.check_trip_shrink()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.trip_companions c
    where c.trip_id = new.id and (c.start_date < new.start_date or c.end_date > new.end_date)
  ) then
    raise exception 'Some companion dates fall outside the new trip dates (% – %)', new.start_date, new.end_date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trips_check_shrink on public.trips;
create constraint trigger trips_check_shrink
  after update of start_date, end_date on public.trips
  deferrable initially deferred
  for each row execute function public.check_trip_shrink();

-- ---------------------------------------------------------------------------
-- Blogs: pin_id -> location_id, plus trip_id.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'blogs' and column_name = 'pin_id'
  ) then
    alter table public.blogs rename column pin_id to location_id;
  end if;
end;
$$;

alter table public.blogs
  add column if not exists location_id text references public.locations (id) on delete set null,
  add column if not exists trip_id text references public.trips (id) on delete set null;

alter index if exists public.blogs_pin_id_idx rename to blogs_location_id_idx;
create index if not exists blogs_location_id_idx on public.blogs (location_id);
create index if not exists blogs_trip_id_idx on public.blogs (trip_id);

drop trigger if exists blogs_sync_pin_id on public.blogs;
drop function if exists public.sync_blog_pin_id();

create or replace function public.sync_blog_hierarchy()
returns trigger
language plpgsql
as $$
begin
  if new.trip_id is not null then
    select location_id into new.location_id from public.trips where id = new.trip_id;
  end if;
  new.data := new.data - 'pinId' - 'tripId'
    || case when new.location_id is null then '{}'::jsonb else jsonb_build_object('pinId', new.location_id) end
    || case when new.trip_id is null then '{}'::jsonb else jsonb_build_object('tripId', new.trip_id) end;
  return new;
end;
$$;

drop trigger if exists blogs_sync_hierarchy on public.blogs;
create trigger blogs_sync_hierarchy
  before insert or update on public.blogs
  for each row execute function public.sync_blog_hierarchy();

-- ---------------------------------------------------------------------------
-- Gallery items (photos renamed): trip_id, optional blog_id, derived location_id.
-- ---------------------------------------------------------------------------
alter table if exists public.photos rename to gallery_items;

alter table public.gallery_items
  add column if not exists trip_id text references public.trips (id) on delete set null,
  add column if not exists blog_id text references public.blogs (id) on delete set null,
  add column if not exists location_id text references public.locations (id) on delete set null;

create index if not exists gallery_items_trip_id_idx on public.gallery_items (trip_id);
create index if not exists gallery_items_blog_id_idx on public.gallery_items (blog_id);
create index if not exists gallery_items_location_id_idx on public.gallery_items (location_id);

create or replace function public.sync_gallery_item_hierarchy()
returns trigger
language plpgsql
as $$
declare
  blog_trip text;
  blog_location text;
begin
  if new.blog_id is not null then
    select trip_id, location_id into blog_trip, blog_location from public.blogs where id = new.blog_id;
    if new.trip_id is null and blog_trip is null then
      new.location_id := blog_location;
    end if;
    -- Attached to a post: the photo belongs to that post's trip.
    if new.trip_id is null then
      new.trip_id := blog_trip;
    elsif blog_trip is not null and blog_trip <> new.trip_id then
      raise exception 'A photo attached to a post must be in the same trip as the post'
        using errcode = 'check_violation';
    end if;
  end if;
  if new.trip_id is not null then
    select location_id into new.location_id from public.trips where id = new.trip_id;
  end if;
  new.data := new.data - 'pinId' - 'tripId' - 'blogId'
    || case when new.location_id is null then '{}'::jsonb else jsonb_build_object('pinId', new.location_id) end
    || case when new.trip_id is null then '{}'::jsonb else jsonb_build_object('tripId', new.trip_id) end
    || jsonb_build_object('blogId', new.blog_id);
  return new;
end;
$$;

drop trigger if exists gallery_items_sync_hierarchy on public.gallery_items;
create trigger gallery_items_sync_hierarchy
  before insert or update on public.gallery_items
  for each row execute function public.sync_gallery_item_hierarchy();

-- Existing photos already carried a blogId inside `data`.
update public.gallery_items g
set blog_id = g.data ->> 'blogId'
where g.blog_id is null
  and exists (select 1 from public.blogs b where b.id = g.data ->> 'blogId');

-- Moving a trip to another location carries its posts and photos along.
create or replace function public.cascade_trip_location()
returns trigger
language plpgsql
as $$
begin
  update public.blogs set location_id = new.location_id where trip_id = new.id;
  update public.gallery_items set location_id = new.location_id where trip_id = new.id;
  return new;
end;
$$;

drop trigger if exists trips_cascade_location on public.trips;
create trigger trips_cascade_location
  after update of location_id on public.trips
  for each row
  when (old.location_id is distinct from new.location_id)
  execute function public.cascade_trip_location();

-- A post moving to another trip takes its attached photos with it.
create or replace function public.cascade_blog_trip()
returns trigger
language plpgsql
as $$
begin
  update public.gallery_items set trip_id = new.trip_id where blog_id = new.id;
  return new;
end;
$$;

drop trigger if exists blogs_cascade_trip on public.blogs;
create trigger blogs_cascade_trip
  after update of trip_id on public.blogs
  for each row
  when (old.trip_id is distinct from new.trip_id)
  execute function public.cascade_blog_trip();

-- ---------------------------------------------------------------------------
-- Saving a trip and its companion intervals in one transaction. security
-- invoker, so RLS (admin write) still decides who may call it successfully.
-- ---------------------------------------------------------------------------
create or replace function public.save_trip(trip jsonb, companions jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id text := trip ->> 'id';
begin
  insert into public.trips (id, location_id, title, start_date, end_date, data)
  values (
    v_id,
    trip ->> 'locationId',
    trip ->> 'title',
    (trip ->> 'startDate')::date,
    (trip ->> 'endDate')::date,
    trip - 'companions'
  )
  on conflict (id) do update
    set location_id = excluded.location_id,
        title = excluded.title,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        data = excluded.data;

  delete from public.trip_companions where trip_id = v_id;

  insert into public.trip_companions (id, trip_id, start_date, end_date, companion_names)
  select
    coalesce(nullif(c ->> 'id', ''), gen_random_uuid()::text),
    v_id,
    (c ->> 'startDate')::date,
    (c ->> 'endDate')::date,
    array(select btrim(n) from jsonb_array_elements_text(c -> 'names') n where btrim(n) <> '')
  from jsonb_array_elements(coalesce(companions, '[]'::jsonb)) c;

  return (select data from public.trips where id = v_id);
end;
$$;

revoke execute on function public.save_trip(jsonb, jsonb) from public, anon;
grant execute on function public.save_trip(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: same rule as the rest of the content — anyone reads, admins write.
-- ---------------------------------------------------------------------------
alter table public.trips enable row level security;
alter table public.trip_companions enable row level security;

drop policy if exists "public read trips" on public.trips;
drop policy if exists "admin write trips" on public.trips;
drop policy if exists "public read trip companions" on public.trip_companions;
drop policy if exists "admin write trip companions" on public.trip_companions;

create policy "public read trips" on public.trips for select to anon, authenticated using (true);
create policy "admin write trips" on public.trips for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public read trip companions" on public.trip_companions for select to anon, authenticated using (true);
create policy "admin write trip companions" on public.trip_companions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Live sync (src/lib/liveSync.js) for the new tiers.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['locations', 'trips', 'trip_companions', 'gallery_items', 'blogs'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
