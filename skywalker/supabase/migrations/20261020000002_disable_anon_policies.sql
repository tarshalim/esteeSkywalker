-- Neutralise the open-access policies from the init migration (equivalent to
-- dropping them: a permissive policy that matches nothing grants nothing).
alter policy "anon all blogs" on public.blogs using (false) with check (false);
alter policy "anon all templates" on public.templates using (false) with check (false);
alter policy "anon all photos" on public.photos using (false) with check (false);
alter policy "anon all pins" on public.pins using (false) with check (false);
alter policy "anon upload media" on storage.objects with check (false);
