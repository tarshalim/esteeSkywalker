-- Fixes from the Supabase security and performance advisors (BUG-FIX.md §2).
-- Behaviour is unchanged: the same roles can read and write the same rows.

-- ---------------------------------------------------------------------------
-- Security: function_search_path_mutable
-- These trigger functions run as the caller and only touch public.* tables
-- (already schema-qualified). Pin the search_path like the other functions.
-- ---------------------------------------------------------------------------
alter function public.check_trip_companion_bounds() set search_path = public;
alter function public.check_trip_stop_bounds() set search_path = public;
alter function public.check_trip_shrink() set search_path = public;
alter function public.sync_trip_data() set search_path = public;
alter function public.sync_blog_hierarchy() set search_path = public;
alter function public.sync_gallery_item_hierarchy() set search_path = public;
alter function public.cascade_trip_location() set search_path = public;
alter function public.cascade_blog_trip() set search_path = public;

-- ---------------------------------------------------------------------------
-- Security: anon/authenticated_security_definer_function_executable
-- Trigger functions don't need EXECUTE to fire (it's only checked at
-- CREATE TRIGGER), so take them off /rest/v1/rpc.
--
-- Kept executable on purpose:
--   my_role, is_admin            RLS policies call them as the requesting role
--   purge_unconfirmed_signup     called by signed-out signups (Account.jsx);
--                                only deletes unconfirmed @users.skywalker.app users
--   set_user_role, reject_account  check super_admin inside
--   section_reaction_counts, toggle_section_reaction  guest reactions
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.restamp_blog_authors() from public, anon, authenticated;
revoke execute on function public.stamp_blog_author() from public, anon, authenticated;
revoke execute on function public.stamp_section_comment() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Security (§9 #41): the public buckets' SELECT policies let anyone list every
-- object, including media uploaded for unpublished drafts. Public URLs
-- (/object/public/...) don't go through RLS, so reads keep working. Admins keep
-- SELECT because Storage needs it to remove() files.
-- ---------------------------------------------------------------------------
drop policy if exists "anon read media" on storage.objects;
drop policy if exists "public read blog audio" on storage.objects;
drop policy if exists "admin read media" on storage.objects;
drop policy if exists "admin read blog audio" on storage.objects;

create policy "admin read media" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));

create policy "admin read blog audio" on storage.objects
  for select to authenticated
  using (bucket_id = 'blog-audio' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Performance: unindexed_foreign_keys
-- ---------------------------------------------------------------------------
create index if not exists blogs_owner_id_idx on public.blogs (owner_id);
create index if not exists gallery_items_owner_id_idx on public.gallery_items (owner_id);
create index if not exists locations_owner_id_idx on public.locations (owner_id);
create index if not exists templates_owner_id_idx on public.templates (owner_id);
create index if not exists trips_owner_id_idx on public.trips (owner_id);
create index if not exists section_comments_user_id_idx on public.section_comments (user_id);

-- ---------------------------------------------------------------------------
-- Performance: auth_rls_initplan
-- Wrap auth.uid() / role helpers in a subselect so they run once per query.
-- ---------------------------------------------------------------------------
drop policy if exists "read own or all as super admin" on public.profiles;
create policy "read own or all as super admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.my_role()) = 'super_admin');

drop policy if exists "delete own comment or moderate" on public.section_comments;
create policy "delete own comment or moderate" on public.section_comments
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Performance: multiple_permissive_policies
-- "admin write X" was FOR ALL, so it overlapped "public read X" on SELECT.
-- Split it into insert/update/delete; reads stay on the public read policy
-- (which already lets admins see drafts on blogs).
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('blogs', 'admin write blogs', 'blogs'),
      ('templates', 'admin write templates', 'templates'),
      ('gallery_items', 'admin write photos', 'gallery items'),
      ('locations', 'admin write pins', 'locations'),
      ('trips', 'admin write trips', 'trips'),
      ('trip_companions', 'admin write trip companions', 'trip companions'),
      ('trip_stops', 'admin write trip stops', 'trip stops')
    ) as v(tbl, old_name, label)
  loop
    execute format('drop policy if exists %I on public.%I', t.old_name, t.tbl);
    execute format('drop policy if exists %I on public.%I', 'admin insert ' || t.label, t.tbl);
    execute format('drop policy if exists %I on public.%I', 'admin update ' || t.label, t.tbl);
    execute format('drop policy if exists %I on public.%I', 'admin delete ' || t.label, t.tbl);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))',
      'admin insert ' || t.label, t.tbl);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      'admin update ' || t.label, t.tbl);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))',
      'admin delete ' || t.label, t.tbl);
  end loop;
end
$$;

-- Not changed (documented in BUG-FIX.md §9 #47):
--   rls_enabled_no_policy on section_reactions  deny-all by design, RPC-only
--   unused_index                                 tables are tiny; indexes back real filters
--   auth_leaked_password_protection              Auth dashboard setting, not SQL
