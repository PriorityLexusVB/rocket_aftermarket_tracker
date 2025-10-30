-- supabase/policies.md

-- Inspect RLS state for key tables
select relname, relrowsecurity
from pg_class
where relname in ('user_profiles','vendors','products','staff_records','sms_templates');

-- Example org-scoped read policy template (adjust table & org column)
-- Replace <table> with the actual table name
create policy "org members can read <table>"
on public.<table>
for select
to authenticated
using (
org_id = (
select org_id from public.user_profiles p where p.id = auth.uid()
)
);

-- Note: Do NOT apply these automatically here. Use Supabase Studio and verify column names before applying.
