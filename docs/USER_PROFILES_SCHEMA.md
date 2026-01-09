# User Profiles Schema and Capability Detection

## Current Schema

The `user_profiles` table has the following structure (as of migration `20250922170950_automotive_aftermarket_system.sql`):

```sql
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role public.user_role DEFAULT 'staff'::public.user_role,
    phone TEXT,
    department TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Important Notes

1. **Available Columns**: The table currently has `full_name` as the primary name field
2. **Missing Columns**: The columns `name` and `display_name` do NOT exist in the current schema
3. **Backward Compatibility**: The application uses a capability detection system to handle schema variations gracefully

## Capability Detection System

The application uses runtime capability detection to determine which name columns are available:

### How It Works

1. **Health Endpoint** (`/api/health-user-profiles`):
   - Probes for the existence of `name`, `full_name`, and `display_name` columns
   - Returns a JSON response indicating which columns are available
   - Example response:
     ```json
     {
       "ok": true,
       "classification": "ok",
       "columns": {
         "name": false,
         "full_name": true,
         "display_name": false
       }
     }
     ```

2. **SessionStorage Caching**:
   - Capability flags are stored in sessionStorage:
     - `cap_userProfilesName`
     - `cap_userProfilesFullName`
     - `cap_userProfilesDisplayName`
   - Flags persist across page navigations within a session
   - Clear sessionStorage to force re-detection after schema changes

3. **Fallback Chain**:
   The application resolves user display names in this priority order:
   ```
   profile.name → profile.full_name → profile.display_name → email local-part
   ```

## E2E Testing

E2E tests verify the capability system works correctly:

### Test Coverage

- `e2e/profile-name-fallback.spec.ts`:
  - Tests fallback from `name` to `full_name`
  - Tests fallback from `full_name` to `display_name`
  - Tests final fallback to email local-part

### Test Strategy

Tests use two approaches:

1. **Mock Route**: Override the health endpoint to simulate different schemas
2. **Init Script**: Pre-set capability flags before app initialization

## Migration Guidelines

### Adding Name Columns

If you need to add `name` or `display_name` columns:

```sql
-- Example migration to add name column
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS name TEXT;

-- Example migration to add display_name column
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
```

### After Migration

1. Run `NOTIFY pgrst, 'reload schema'` in Supabase SQL editor
2. Clear browser sessionStorage to force capability re-detection
3. The health endpoint will automatically detect the new columns
4. No application code changes are required

## CI/CD Considerations

### Environment Variables

Required for E2E tests:

- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
- `E2E_EMAIL`: Test user email
- `E2E_PASSWORD`: Test user password

### Health Check Failures

If the health endpoint returns errors:

- Check that Supabase is accessible
- Verify RLS policies allow reads from `user_profiles`
- Check that at least one name column exists

### Common Issues

1. **"column user_profiles.name does not exist"**:
   - This is EXPECTED behavior when `name` column doesn't exist
   - The health endpoint catches this error and returns `false` for that column
   - The error is NOT a test failure; it's part of normal capability detection

2. **All capabilities showing as false**:
   - Check that `full_name` column exists (it should always be present)
   - Verify RLS policies allow the test user to read from `user_profiles`
   - Check network connectivity to Supabase

3. **Tests failing after schema changes**:
   - Run schema cache reload: `NOTIFY pgrst, 'reload schema'`
   - Clear browser/test sessionStorage
   - Restart the dev server

## Related Files

- Health endpoints:
  - `/api/health-user-profiles.js` (Vercel serverless)
  - `/src/api/health-user-profiles.js` (Local dev)
- Capability utilities:
  - `/src/utils/userProfileName.js`
- Services using capabilities:
  - `/src/services/staffService.js`
  - `/src/services/dealService.js`
  - `/src/services/dropdownService.js`
- E2E tests:
  - `/e2e/profile-name-fallback.spec.ts`
- Documentation:
  - `/docs/PROFILE_NAME_FALLBACK.md`
