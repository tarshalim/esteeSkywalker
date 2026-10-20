-- Accounts: anyone can read, only signed-in users can write, and rows can only
-- be changed or deleted by the user who created them.

alter table public.blogs     add column if not exists owner_id uuid default auth.uid() references auth.users on delete set null;
alter table public.templates add column if not exists owner_id uuid default auth.uid() references auth.users on delete set null;
alter table public.photos    add column if not exists owner_id uuid default auth.uid() references auth.users on delete set null;
alter table public.pins      add column if not exists owner_id uuid default auth.uid() references auth.users on delete set null;

do $$
declare t text;
begin
  foreach t in array array['blogs', 'templates', 'photos', 'pins'] loop
    execute format('create policy "public read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('create policy "signed-in insert %1$s" on public.%1$I for insert to authenticated with check (owner_id = auth.uid())', t);
    -- Unowned rows (created before accounts existed) stay editable by any signed-in user.
    execute format('create policy "owner update %1$s" on public.%1$I for update to authenticated using (owner_id = auth.uid() or owner_id is null) with check (owner_id = auth.uid() or owner_id is null)', t);
    execute format('create policy "owner delete %1$s" on public.%1$I for delete to authenticated using (owner_id = auth.uid() or owner_id is null)', t);
  end loop;
end $$;

create policy "signed-in upload media" on storage.objects for insert to authenticated with check (bucket_id = 'media');
