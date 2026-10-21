-- Public bucket for hand-drawn canvas stickers (transparent PNGs exported by
-- the drawing pad, src/lib/drawings.js). Anyone can view; only admins can
-- upload, replace or delete — same rule as `media` and `blog-audio`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-drawings',
  'blog-drawings',
  true,
  5242880, -- 5 MB; a full-pad 2x PNG is well under 1 MB
  array['image/png', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read blog drawings" on storage.objects;
drop policy if exists "admin upload blog drawings" on storage.objects;
drop policy if exists "admin update blog drawings" on storage.objects;
drop policy if exists "admin delete blog drawings" on storage.objects;

create policy "public read blog drawings" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'blog-drawings');

create policy "admin upload blog drawings" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'blog-drawings' and public.is_admin());

create policy "admin update blog drawings" on storage.objects
  for update to authenticated
  using (bucket_id = 'blog-drawings' and public.is_admin())
  with check (bucket_id = 'blog-drawings' and public.is_admin());

create policy "admin delete blog drawings" on storage.objects
  for delete to authenticated
  using (bucket_id = 'blog-drawings' and public.is_admin());
