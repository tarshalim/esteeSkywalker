-- Lets admins remove files from `media`, so deleting a post can clean up its
-- cover and canvas images. Same admin-only rule as uploads.
drop policy if exists "admin delete media" on storage.objects;

create policy "admin delete media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
