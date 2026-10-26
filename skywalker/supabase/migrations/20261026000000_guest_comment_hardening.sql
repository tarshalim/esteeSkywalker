-- Guest comments: validation and spam limits on top of section_comments.
--   * Guests must leave a valid email (still hidden from readers).
--   * Names and bodies lose control characters; names collapse whitespace.
--   * Guests are rate limited per client IP (stored only as a salted hash, also
--     hidden from readers) and can't repost the same text in quick succession.
--   * Errors carry stable hints (`invalid_email`, `rate_limited`, ...) the
--     client turns into friendly messages.

alter table public.section_comments add column if not exists author_ip_hash text;
alter table public.section_comments drop constraint if exists section_comments_section_id_len;
alter table public.section_comments add constraint section_comments_section_id_len
  check (char_length(section_id) between 1 and 120);

create index if not exists section_comments_ip_idx on public.section_comments (author_ip_hash, created_at);

-- Supabase grants every new table to anon/authenticated by default; narrow that
-- to exactly what the client needs so nobody can write server-owned columns.
revoke all on public.section_comments from anon, authenticated;
grant select (id, blog_id, section_id, body, user_id, author_name, author_avatar, is_guest, created_at)
  on public.section_comments to anon, authenticated;
grant insert (blog_id, section_id, body, author_name, author_email) on public.section_comments to anon, authenticated;
grant delete on public.section_comments to authenticated;

create or replace function public.stamp_section_comment()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  client_ip text;
begin
  new.user_id := case when public.my_role() in ('user', 'admin', 'super_admin') then auth.uid() end;
  new.is_guest := new.user_id is null;
  -- Keep newlines and tabs; drop every other control character.
  new.body := btrim(regexp_replace(new.body, '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]', '', 'g'));
  new.created_at := now();

  if not new.is_guest then
    select p.username, u.raw_user_meta_data ->> 'avatar'
      into new.author_name, new.author_avatar
      from public.profiles p join auth.users u on u.id = p.id
      where p.id = new.user_id;
    new.author_email := null;
    new.author_ip_hash := null;
    return new;
  end if;

  new.author_avatar := null;
  new.author_name := btrim(regexp_replace(regexp_replace(new.author_name, '[\u0001-\u001F\u007F]', '', 'g'), '\s+', ' ', 'g'));
  new.author_email := nullif(lower(btrim(new.author_email)), '');

  if char_length(new.author_name) not between 1 and 60 then
    raise exception 'Please enter a name (up to 60 characters)' using errcode = '22023', hint = 'invalid_name';
  end if;
  if new.author_email is null
     or char_length(new.author_email) > 254
     or new.author_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address' using errcode = '22023', hint = 'invalid_email';
  end if;

  -- Cloudflare's header can't be forged by the client; the others are fallbacks.
  client_ip := coalesce(
    headers ->> 'cf-connecting-ip',
    btrim(split_part(headers ->> 'x-forwarded-for', ',', 1)),
    headers ->> 'x-real-ip'
  );
  new.author_ip_hash := encode(
    extensions.digest('skywalker-comments:' || coalesce(nullif(client_ip, ''), 'email:' || new.author_email), 'sha256'),
    'hex'
  );

  if (select count(*) from public.section_comments c
      where c.author_ip_hash = new.author_ip_hash and c.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'You''re commenting too quickly. Please wait a few minutes.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  if exists (select 1 from public.section_comments c
             where c.author_ip_hash = new.author_ip_hash and c.blog_id = new.blog_id
               and c.body = new.body and c.created_at > now() - interval '1 hour') then
    raise exception 'You already posted that comment.' using errcode = 'P0001', hint = 'duplicate';
  end if;

  return new;
end;
$$;
