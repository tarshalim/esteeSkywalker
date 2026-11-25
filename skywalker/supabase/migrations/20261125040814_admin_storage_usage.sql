-- Admin Settings tab: storage usage computed on demand. No tracking tables —
-- every call reads storage.objects and the database size live.
--
-- Per-blog breakdown: a post "uses" an upload when its `data` holds the
-- upload's public URL (<project>/storage/v1/object/public/<bucket>/<path>),
-- the same rule files.js uses to find a deleted post's media. An upload shared
-- by several posts counts toward each of them; `blog_media_bytes` counts it once.

create or replace function public.admin_storage_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can view storage usage' using errcode = '42501';
  end if;

  with objects as (
    select o.bucket_id, o.name, coalesce((o.metadata ->> 'size')::bigint, 0) as bytes
    from storage.objects o
  ),
  refs as (
    select distinct b.id as blog_id, m[1] as bucket_id, m[2] as name
    from public.blogs b,
         lateral regexp_matches(
           b.data::text,
           '/storage/v1/object/public/([A-Za-z0-9_-]+)/([^?#"''[:space:])\\]+)',
           'g'
         ) as m
  ),
  linked as (
    select distinct r.blog_id, o.bucket_id, o.name, o.bytes
    from refs r
    join objects o on o.bucket_id = r.bucket_id and o.name = r.name
  ),
  blog_usage as (
    select b.id,
           b.data ->> 'title' as title,
           b.status,
           b.updated_at,
           pg_column_size(b.data)::bigint as row_bytes,
           count(l.name)::int as files,
           coalesce(sum(l.bytes), 0)::bigint as media_bytes
    from public.blogs b
    left join linked l on l.blog_id = b.id
    group by b.id
  ),
  bucket_usage as (
    select bk.id as bucket, count(o.name)::int as files, coalesce(sum(o.bytes), 0)::bigint as bytes
    from storage.buckets bk
    left join objects o on o.bucket_id = bk.id
    group by bk.id
  ),
  blog_objects as (
    select distinct bucket_id, name, bytes from linked
  )
  select jsonb_build_object(
    'computed_at', now(),
    'database_bytes', pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum(bytes), 0) from objects),
    'storage_files', (select count(*) from objects),
    'blog_media_bytes', (select coalesce(sum(bytes), 0) from blog_objects),
    'blog_media_files', (select count(*) from blog_objects),
    'buckets', coalesce(
      (select jsonb_agg(jsonb_build_object('bucket', bucket, 'files', files, 'bytes', bytes) order by bytes desc, bucket)
       from bucket_usage),
      '[]'::jsonb
    ),
    'blogs', coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'id', id, 'title', title, 'status', status, 'updated_at', updated_at,
                  'files', files, 'media_bytes', media_bytes, 'row_bytes', row_bytes
                )
                order by media_bytes + row_bytes desc, id
              )
       from blog_usage),
      '[]'::jsonb
    )
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.admin_storage_usage() from public, anon;
grant execute on function public.admin_storage_usage() to authenticated;
