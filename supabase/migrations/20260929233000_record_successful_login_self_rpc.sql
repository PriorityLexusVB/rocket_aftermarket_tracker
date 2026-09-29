-- Rocket login telemetry: replace the client's direct user_profiles update
-- (rejected by production RLS while the client falsely reported success) with
-- one authenticated self-only RPC. The function takes no identity argument;
-- it resolves the caller exclusively from auth.uid(), requires exactly one
-- active matching profile, and fails closed on any ambiguity.

create or replace function public.record_successful_login_self()
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $$
declare
  v_caller uuid := (select auth.uid());
  v_profile_id uuid;
  v_matches uuid[];
begin
  if v_caller is null then
    return false;
  end if;

  select pg_catalog.array_agg(up.id order by up.id)
  into v_matches
  from public.user_profiles up
  where (up.id = v_caller or up.auth_user_id = v_caller)
    and up.is_active is true;

  if pg_catalog.coalesce(pg_catalog.cardinality(v_matches), 0) <> 1 then
    return false;
  end if;

  v_profile_id := v_matches[1];

  update public.user_profiles
  set last_login_at = pg_catalog.now()
  where id = v_profile_id
    and (id = v_caller or auth_user_id = v_caller)
    and is_active is true;

  return found;
end;
$$;

revoke all on function public.record_successful_login_self() from public;
revoke all on function public.record_successful_login_self() from anon;
grant execute on function public.record_successful_login_self() to authenticated;

comment on function public.record_successful_login_self() is
  'Authenticated self-only login telemetry: updates only auth.uid()''s own active user_profiles.last_login_at using the database server clock, and fails closed unless exactly one active profile matches.';
