# Supabase RLS Policies Documentation

## Overview

This document describes the Row Level Security (RLS) policies for the rocket_aftermarket_tracker application.

**Last Updated:** 2025-12-06

## Key Principles

1. **No recursion on user_profiles**: Policies on `user_profiles` must use `auth.uid()` directly, NOT `auth_user_org()` or `app_current_org_id()`, because those functions query `user_profiles`.

2. **Fallback for unaligned users**: Products and vendors policies include a fallback `OR auth_user_org() IS NULL` to handle users whose profile isn't properly linked to an org.

3. **No auth.users references**: Policies should never directly query `auth.users` - use helper functions instead.

## Helper Functions

```sql
-- Returns the user's org_id (checks both id and auth_user_id columns)
public.auth_user_org() -> uuid

-- Alias for auth_user_org()
public.app_current_org_id() -> uuid

-- Returns true if user has admin or manager role
public.is_admin_or_manager() -> boolean
```

## Table Policies Summary

### user_profiles

| Policy Name | Operation | Expression |
|-------------|-----------|------------|
| user_profiles_read_active | SELECT | `coalesce(is_active, true)` |
| user_profiles_update_self | UPDATE | `id = auth.uid()` (USING and WITH CHECK) |

**IMPORTANT:** These policies do NOT use `auth_user_org()` to prevent infinite recursion (error 42P17).

### products

| Policy Name | Operation | Expression |
|-------------|-----------|------------|
| app_org_staff_can_read_products | SELECT | `is_active AND (org_id = auth_user_org() OR org_id IS NULL OR auth_user_org() IS NULL)` |
| org can insert products | INSERT | `org_id = auth_user_org() OR is_admin_or_manager()` |
| org can update products | UPDATE | `org_id = auth_user_org() OR is_admin_or_manager()` |

### vendors

| Policy Name | Operation | Expression |
|-------------|-----------|------------|
| app_org_staff_can_read_vendors | SELECT | `is_active AND (org_id = auth_user_org() OR org_id IS NULL OR auth_user_org() IS NULL)` |
| org can insert vendors | INSERT | `org_id = auth_user_org() OR is_admin_or_manager()` |
| org can update vendors | UPDATE | `org_id = auth_user_org() OR is_admin_or_manager()` |

### loaner_assignments

| Policy Name | Operation | Expression |
|-------------|-----------|------------|
| org can select loaner_assignments via jobs | SELECT | `EXISTS(job with org_id = auth_user_org()) OR is_admin_or_manager()` |
| org can insert loaner_assignments via jobs | INSERT | `EXISTS(job with org_id = auth_user_org())` |
| org can update loaner_assignments via jobs | UPDATE | `EXISTS(job with org_id = auth_user_org())` |
| managers_manage_loaner_assignments | ALL | `is_admin_or_manager()` |

## Verification Queries

```sql
-- Check RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('user_profiles','vendors','products','loaner_assignments');

-- List all policies on key tables
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('user_profiles','vendors','products','loaner_assignments')
ORDER BY tablename, policyname;

-- Check for recursion risk (should return 0 rows for user_profiles)
SELECT policyname, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_profiles'
AND (qual ILIKE '%auth_user_org%' OR qual ILIKE '%app_current_org_id%');
```

## Testing

Run the full RLS smoke test:
```bash
# In Supabase SQL Editor, run:
-- See supabase/rls_smoke_test.sql
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| 42P17: Infinite recursion | user_profiles policy uses auth_user_org() | Replace with auth.uid() |
| 401 Unauthorized | auth_user_org() returns NULL | Add fallback condition |
| Permission denied for table users | Policy queries auth.users | Use auth.uid() or helper |

## After Changes

Always run:
```sql
NOTIFY pgrst, 'reload schema';
```
