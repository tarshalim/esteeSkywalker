-- Public bucket for blog posts' background music (.mp3/.m4a/.wav). Anyone can
-- stream; only admins can upload, replace or delete — same rule as `media`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-audio',
  'blog-audio',
  true,
  26214400, -- 25 MB, matches MAX_AUDIO_BYTES in src/lib/music.js
  array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read blog audio" on storage.objects;
drop policy if exists "admin upload blog audio" on storage.objects;
drop policy if exists "admin update blog audio" on storage.objects;
drop policy if exists "admin delete blog audio" on storage.objects;

create policy "public read blog audio" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'blog-audio');

create policy "admin upload blog audio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'blog-audio' and public.is_admin());

create policy "admin update blog audio" on storage.objects
  for update to authenticated
  using (bucket_id = 'blog-audio' and public.is_admin())
  with check (bucket_id = 'blog-audio' and public.is_admin());

create policy "admin delete blog audio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'blog-audio' and public.is_admin());
