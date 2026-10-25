-- Multi-location trips: a trip's itinerary as an ordered list of stops.
--
--   trips
--     trip_stops   one leg of the journey: "Chengdu, China  Oct 1 – 4",
--                  "Jiuzhaigou, China  Oct 5 – 8" — each with its own place,
--                  country/continent tags, coordinates and dates
--
-- trips.location_id stays the trip's home pin on the globe (where its quick
-- card lives); the stops are the route drawn as arcs from leg to leg. The
-- journey order is start_date, then sequence_order for stops starting the
-- same day. Stops may overlap (a day trip inside a longer stay) but must sit
-- inside the trip's dates, like companion intervals.

create table if not exists public.trip_stops (
  id text primary key default gen_random_uuid()::text,
  trip_id text not null references public.trips (id) on delete cascade,
  location_name text not null,
  country text,
  country_code text,
  continent text,
  latitude double precision,
  longitude double precision,
  start_date date not null,
  end_date date not null,
  sequence_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint trip_stops_date_range_check check (end_date >= start_date),
  constraint trip_stops_name_check check (length(btrim(location_name)) > 0),
  constraint trip_stops_coords_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create index if not exists trip_stops_trip_order_idx on public.trip_stops (trip_id, start_date, sequence_order);
create index if not exists trip_stops_country_idx on public.trip_stops (continent, country_code);

-- A stop must sit inside its trip's dates.
create or replace function public.check_trip_stop_bounds()
returns trigger
language plpgsql
as $$
declare
  t record;
begin
  select start_date, end_date into t from public.trips where id = new.trip_id;
  if new.start_date < t.start_date or new.end_date > t.end_date then
    raise exception 'Stop dates (% – %) must fall within the trip (% – %)',
      new.start_date, new.end_date, t.start_date, t.end_date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trip_stops_check_bounds on public.trip_stops;
create trigger trip_stops_check_bounds
  before insert or update on public.trip_stops
  for each row execute function public.check_trip_stop_bounds();

-- Shrinking a trip can't strand companions or stops outside it (still
-- deferred to commit, so save_trip can change everything together).
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
  if exists (
    select 1 from public.trip_stops s
    where s.trip_id = new.id and (s.start_date < new.start_date or s.end_date > new.end_date)
  ) then
    raise exception 'Some stops fall outside the new trip dates (% – %)', new.start_date, new.end_date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_trip now replaces the stops too. The old two-argument version is
-- dropped so named calls ({ trip, companions }) can't hit an ambiguous overload.
-- ---------------------------------------------------------------------------
drop function if exists public.save_trip(jsonb, jsonb);

create or replace function public.save_trip(
  trip jsonb,
  companions jsonb default '[]'::jsonb,
  stops jsonb default '[]'::jsonb
)
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
    trip - 'companions' - 'stops'
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

  delete from public.trip_stops where trip_id = v_id;

  insert into public.trip_stops (
    id, trip_id, location_name, country, country_code, continent,
    latitude, longitude, start_date, end_date, sequence_order
  )
  select
    coalesce(nullif(s ->> 'id', ''), gen_random_uuid()::text),
    v_id,
    btrim(s ->> 'locationName'),
    nullif(btrim(s ->> 'country'), ''),
    nullif(btrim(s ->> 'countryCode'), ''),
    nullif(btrim(s ->> 'continent'), ''),
    (s ->> 'lat')::double precision,
    (s ->> 'lng')::double precision,
    (s ->> 'startDate')::date,
    (s ->> 'endDate')::date,
    coalesce((s ->> 'sequenceOrder')::integer, (ord - 1)::integer)
  from jsonb_array_elements(coalesce(stops, '[]'::jsonb)) with ordinality as x(s, ord);

  return (select data from public.trips where id = v_id);
end;
$$;

revoke execute on function public.save_trip(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_trip(jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: anyone reads, admins write — same as trip_companions.
-- ---------------------------------------------------------------------------
alter table public.trip_stops enable row level security;

drop policy if exists "public read trip stops" on public.trip_stops;
drop policy if exists "admin write trip stops" on public.trip_stops;

create policy "public read trip stops" on public.trip_stops for select to anon, authenticated using (true);
create policy "admin write trip stops" on public.trip_stops for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Live sync (src/lib/liveSync.js).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_stops'
     ) then
    alter publication supabase_realtime add table public.trip_stops;
  end if;
end;
$$;
