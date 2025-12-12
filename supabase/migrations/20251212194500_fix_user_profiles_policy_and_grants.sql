-- Fix recursive user_profiles policy and ensure authenticated grants

-- Drop existing SELECT policies to avoid recursion/loops
drop policy if exists user_profiles_select on public.user_profiles;
drop policy if exists user_profiles_read on public.user_profiles;
drop policy if exists user_profiles_read_active on public.user_profiles;
drop policy if exists user_profiles_select_self_or_same_org on public.user_profiles;

-- Simple non-recursive SELECT policy for authenticated users
create policy user_profiles_read_active on public.user_profiles
for select
to authenticated
using (coalesce(is_active, true));

-- Ensure schema usage and table SELECT grants for authenticated role
grant usage on schema public to authenticated;
grant select on public.user_profiles to authenticated;
grant select on public.products to authenticated;
grant select on public.vendors to authenticated;
grant select on public.jobs to authenticated;
grant select on public.job_parts to authenticated;
grant select on public.transactions to authenticated;
grant select on public.loaner_assignments to authenticated;
grant select on public.communications to authenticated;
grant select on public.notification_outbox to authenticated;
grant select on public.sms_templates to authenticated;

-- Optional helper used elsewhere: ensure auth_user_org is SECURITY DEFINER
create or replace function public.auth_user_org()
returns uuid
language plpgsql
security definer
set row_security = off
set search_path = public
as $$
declare
  u_id uuid;
  result uuid;
begin
  select auth.uid() into u_id;
  select org_id into result
  from public.user_profiles
  where id = u_id
  limit 1;
  return result;
end;
$$;
