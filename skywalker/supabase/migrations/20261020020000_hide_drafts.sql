-- Drafts were readable by anyone holding the anon key ("public read blogs"
-- used `true`), so unpublished posts leaked via the API and every list view.
-- Only admins (who write posts) may now see drafts.
drop policy if exists "public read blogs" on public.blogs;
create policy "public read blogs" on public.blogs
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());
