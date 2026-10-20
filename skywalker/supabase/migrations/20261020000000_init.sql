-- Skywalker initial schema. Each row keeps the app's object as-is in `data`,
-- with a few columns pulled out for ordering/filtering.

create table if not exists public.blogs (
  id text primary key,
  track_x double precision not null default 0,
  status text not null default 'draft',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pins (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS: there is no auth yet, so the anon key gets full access. Tighten these
-- (e.g. `to authenticated`) once login exists.
alter table public.blogs enable row level security;
alter table public.templates enable row level security;
alter table public.photos enable row level security;
alter table public.pins enable row level security;

create policy "anon all blogs" on public.blogs for all to anon, authenticated using (true) with check (true);
create policy "anon all templates" on public.templates for all to anon, authenticated using (true) with check (true);
create policy "anon all photos" on public.photos for all to anon, authenticated using (true) with check (true);
create policy "anon all pins" on public.pins for all to anon, authenticated using (true) with check (true);

-- Public bucket for uploaded images/audio.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "anon read media" on storage.objects for select to anon, authenticated using (bucket_id = 'media');
create policy "anon upload media" on storage.objects for insert to anon, authenticated with check (bucket_id = 'media');
