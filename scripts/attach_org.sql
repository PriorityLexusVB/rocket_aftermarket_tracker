-- Create org if it doesn't exist
insert into public.organizations (name)
values ('Priority Lexus VB')
on conflict do nothing;

-- Attach YOUR user profile to that org (replace id with yours if different)
update public.user_profiles
set org_id = (select id from public.organizations where name='Priority Lexus VB')
where id = 'e49cf323-1b81-4044-bcbb-b6f906b7b562';

-- Alternatively, attach by email (recommended for E2E/test users)
update public.user_profiles up
set org_id = (select id from public.organizations where name='Priority Lexus VB'),
		is_active = true
where up.email in (
	'rob.brasco@priorityautomotive.com'
);

-- (Optional) tag existing global rows so org counts light up immediately
update public.vendors       set org_id = (select id from public.organizations where name='Priority Lexus VB') where org_id is null;
update public.products      set org_id = (select id from public.organizations where name='Priority Lexus VB') where org_id is null;
update public.transactions  set org_id = (select id from public.organizations where name='Priority Lexus VB') where org_id is null;
update public.vehicles      set org_id = (select id from public.organizations where name='Priority Lexus VB') where org_id is null;
-- leave SMS templates global if you want shared templates; otherwise uncomment:
-- update public.sms_templates set org_id = (select id from public.organizations where name='Priority Lexus VB') where org_id is null;
