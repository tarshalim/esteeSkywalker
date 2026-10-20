-- Username accounts use a synthetic "<username>@users.skywalker.app" address
-- that can never receive mail, so an unconfirmed one (created while "Confirm
-- email" was on) can never sign in and just squats on the username. The
-- sign-up page calls this when sign-up returns no session so a failed attempt
-- leaves nothing behind. Only unconfirmed synthetic accounts are touched,
-- which is why anon may call it.

create or replace function public.purge_unconfirmed_signup(target_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.users
  where email = lower(target_email)
    and email like '%@users.skywalker.app'
    and email_confirmed_at is null;
end;
$$;

revoke execute on function public.purge_unconfirmed_signup(text) from public;
grant execute on function public.purge_unconfirmed_signup(text) to anon, authenticated;

-- Clear any dead accounts already left behind.
delete from auth.users
where email like '%@users.skywalker.app'
  and email_confirmed_at is null;
