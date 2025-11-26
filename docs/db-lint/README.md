# Supabase DB Lint Documentation

This directory contains documentation about Supabase `db lint` results and decisions.

## Lint Categories

### Fixed Issues (via migrations)

1. **RLS Disabled on `public.organizations`** (ERROR)
   - Migration: `20251126161700_enable_rls_on_organizations.sql`
   - Enables RLS on organizations table with SELECT/UPDATE policies for org members

2. **`pg_trgm` extension in public schema** (WARN)
   - Migration: `20251126161701_move_pg_trgm_extension.sql`
   - Moves pg_trgm to extensions schema and recreates trigram indexes

3. **`auth_rls_initplan` warnings** (WARN)
   - Migration: `20251126161702_fix_auth_rls_initplan.sql`
   - Wraps all `auth.uid()` calls in `(SELECT ...)` to fix query planning issues
   - Updates helper functions: `auth_user_org()`, `is_admin_or_manager()`

4. **Duplicate indexes** (WARN)
   - Migration: `20251126161703_drop_duplicate_indexes.sql`
   - Drops `loaner_assignments_job_id_idx` (keeps `idx_loaner_assignments_job_id`)

5. **Unindexed foreign keys** (WARN)
   - Migration: `20251126161704_add_fk_indexes.sql`
   - Adds indexes for: `activity_history(performed_by)`, `claim_attachments(uploaded_by)`,
     `communications(job_id)`, `communications(sent_by)`, `jobs(created_by)`

### Documented (Not Auto-Fixed)

#### `users_leaked_password_protection` (auth.users)
> Enable "Leaked password protection" in Supabase Auth settings for production environments.

This is a Supabase Dashboard configuration, not a SQL migration. To enable:
1. Go to Supabase Dashboard → Authentication → Settings → Security
2. Enable "Leaked password protection"
3. Choose the recommended protection level

#### `multiple_permissive_policies` (various tables)
These warnings are **intentionally kept** as they reflect the designed authorization structure:
- Multiple policies allow different access patterns (org-scoped, role-based, ownership-based)
- Merging them could break intended behavior or reduce security granularity
- A dedicated security review should be conducted before any policy consolidation

Tables with multiple permissive policies (intentional):
- `claims`
- `filter_presets`
- `jobs`
- `vehicles`
- `user_profiles`
- `vendors`
- `products`
- `sms_templates`

#### `unused_index` (INFO level)
Indexes reported as "unused" are **not automatically dropped** because:
1. The dev/staging environment may have different query patterns than production
2. Some indexes support infrequent but important queries (reports, exports)
3. Dropping them could cause performance regression in production

Only drop an index if:
- It is confirmed as a **duplicate index** (handled separately)
- Production `pg_stat_user_indexes` confirms zero usage over an extended period

## Verification

After applying migrations, run:
```bash
npx supabase@latest db lint
```

Expected remaining warnings:
- `multiple_permissive_policies` - Intentional, documented above
- `unused_index` (INFO) - Intentional, documented above
- `users_leaked_password_protection` - Dashboard configuration required

## Related Documentation

- `PERFORMANCE_INDEXES.md` - Index strategy and rationale
- `docs/RLS_AUDIT_RESULT_2025-11-07.md` - Previous RLS audit results
- `docs/FINAL_HARDENING_SUMMARY.md` - Security hardening summary
