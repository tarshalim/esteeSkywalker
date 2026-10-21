-- Blog posts can now span a date range, and the Trip type / Duration
-- categories are gone.
--   start_date: the post's date (first day of the trip)
--   end_date:   last day of the trip, null for a single-day post
-- The app keeps writing the full object to `data` too (startDate/endDate),
-- so these columns are for ordering/filtering in SQL.

alter table public.blogs
  drop column if exists duration,
  drop column if exists trip_type,
  add column if not exists start_date date,
  add column if not exists end_date date;

alter table public.blogs drop constraint if exists blogs_date_range_check;
alter table public.blogs
  add constraint blogs_date_range_check check (end_date is null or end_date >= start_date);

-- Trip type and duration lived in the jsonb blob; drop them there, and give
-- existing posts a startDate mirrored from their postDate.
update public.blogs
set data = (data - 'tripType' - 'duration')
  || case
       when data ? 'startDate' or coalesce(data ->> 'postDate', data ->> 'date') is null then '{}'::jsonb
       else jsonb_build_object('startDate', coalesce(data ->> 'postDate', data ->> 'date'))
     end
where data ? 'tripType' or data ? 'duration' or not data ? 'startDate';

update public.blogs
set start_date = (data ->> 'startDate')::date,
    end_date = case when data ->> 'endDate' ~ '^\d{4}-\d{2}-\d{2}$' then (data ->> 'endDate')::date end
where data ->> 'startDate' ~ '^\d{4}-\d{2}-\d{2}$';

create index if not exists blogs_start_date_idx on public.blogs (start_date);
