# Runbook - Calendar-First Aftermarket Tracker

## CI, Deploys, and E2E (Quick Reference)

- CI jobs (GitHub Actions):
  - CI: unit tests, build, Prettier, ESLint, and TypeScript (E2E scope)
  - E2E Smoke (PR): runs a fast subset of Playwright specs on pull requests
  - E2E Full (Main): runs the full Playwright suite on push to main; use as a required check before Production deploys
- Required repo secrets (for E2E auth and manual deploy fallback):
  - VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (app runtime)
  - E2E_EMAIL, E2E_PASSWORD (test user credentials present in Supabase Auth)
  - Optional (manual Vercel deploy workflow): VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
- Vercel auto-deploys:
  - vercel.json uses pnpm with `--no-frozen-lockfile` and `pnpm run build`
  - Production auto-deploys from main via Vercel Git integration; PRs get Preview URLs

### E2E Flakiness Tips

- If tests fail locally with auth issues, set E2E_EMAIL/E2E_PASSWORD in `.env.local` and run `pnpm e2e`.
- Global setup writes `e2e/storageState.json`. Delete it if corrupted and rerun.
- Ensure port 5173 is free; the Playwright config launches the Vite dev server automatically.

## Local Development Setup

### Prerequisites

- Node.js 18+
- pnpm or npm
- Supabase CLI
- Docker (for local Supabase)

### Environment Setup

1. **Clone and Install**

```bash
git clone <repository>
cd aftermarket-tracker
pnpm install
```

2. **Environment Variables**

```bash
cp .env.example .env
# Edit .env with your actual values
```

3. **Start Supabase Local**

```bash
supabase start
```

4. **Apply Migrations**

```bash
supabase db reset
```

5. **Apply Latest Migration**

```bash
supabase db push
```

6. **Load Seed Data** (Optional)

```bash
supabase db execute -f supabase/seed.sql
```

7. **Start Development Server**

```bash
pnpm dev
```

### Application URLs

- **Frontend**: http://localhost:5173
- **Supabase Studio**: http://localhost:54323
- **Supabase API**: http://localhost:54321

## Production Deployment

## Production Readiness Checklist (Must-Pass)

Use this as the final gate before considering Production “healthy”. It is optimized for the real failure modes we’ve seen in this repo:

- PostgREST schema-cache drift (missing relationship/columns)
- RLS deletes that affect 0 rows (silent no-op)
- Schema drift in `user_profiles` display columns (e.g. missing `name`)

### 1) Supabase migrations applied

- Apply latest migrations to the target Supabase project:

```bash
supabase link --project-ref <project-id>
supabase db push
```

- Verify the latest migration is present:

```sql
select * from supabase_migrations.schema_migrations order by version desc;
```

### 2) Reload PostgREST schema cache (critical after relationships/columns)

Run this in Supabase SQL editor (Production):

```sql
NOTIFY pgrst, 'reload schema';
```

This is the first step anytime you see errors like:

- “Could not find a relationship … in the schema cache”
- “column … does not exist” right after a migration

### 3) Vercel environment variables

Set in Vercel → Project Settings → Environment Variables (Production + Preview):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional but recommended:

- `VITE_SIMPLE_CALENDAR=true` (if you expect `/calendar/agenda`)
- `VITE_DEAL_FORM_V2=true` (recommended default)

### 4) Health endpoints (quick drift detectors)

Hit these endpoints in Production (browser or curl). All are expected to return HTTP 200 with a JSON body.

- `/api/health-user-profiles`
  - Detects which `user_profiles` display columns exist (`name`, `full_name`, `display_name`).
  - If your org’s schema does not have `user_profiles.name`, this endpoint should report `name: false`.
- `/api/health-deals-rel`
  - Validates nested relationships for deals: `jobs -> job_parts -> vendors`.
  - If it reports `stale_cache`, run the schema reload (Step 2).

### 5) Verify RLS deletes truly delete (no silent “0 rows affected”)

Perform a real delete from the UI (e.g. delete a deal/job) and confirm:

- The UI shows success.
- Refreshing the list does not show the row.
- Opening the URL for the deleted row fails/404s.

If you have direct SQL access, confirm the row is gone:

```sql
select id from jobs where id = '<JOB_ID_YOU_DELETED>';
select id from job_parts where job_id = '<JOB_ID_YOU_DELETED>';
select id from transactions where job_id = '<JOB_ID_YOU_DELETED>';
```

If the UI reports success but rows remain, treat it as an RLS policy issue.

### 6) Verify `/auth` does not spam PostgREST 400s

Open `/auth` in Production and check the network tab.

- Expected: no repeated 400s like `column user_profiles.name does not exist`.
- Note: the client caches profile-column capabilities in `sessionStorage`.
  - The cache is versioned; on deploy the app should auto-reprobe via `/api/health-user-profiles`.
  - If you are diagnosing on an old tab that has been open a long time, do a hard refresh.

### 7) Local verification before pushing to Production

From repo root:

```bash
pnpm test
pnpm build
pnpm e2e --project=chromium
```

### Supabase Setup

1. **Create Project**

- Go to https://supabase.com/dashboard
- Create new project
- Note project URL and anon key

2. **Deploy Migrations**

```bash
supabase link --project-ref <project-id>
supabase db push
```

3. **Deploy Edge Functions**

```bash
supabase functions deploy processOutbox
supabase functions deploy twilioInbound
```

4. **Set Production Secrets**

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your-auth-token
supabase secrets set TWILIO_FROM=+1234567890
```

### Verify Supabase migrations and RLS fixes

1. Confirm GitHub Action **Supabase Migrate Production** succeeded on main.
2. In Supabase SQL editor (production):
   - `select * from supabase_migrations.schema_migrations order by version desc;`
   - `select pg_get_functiondef('public.auth_user_org()'::regprocedure);`
   - `select policyname, cmd, roles, qual from pg_policies where schemaname='public' and tablename='user_profiles';`
3. Production migrations require the **supabase-production** environment approval (if configured) before applying.

### Note on CI Migration Workflows

The GitHub Actions workflows for Supabase migrations (`supabase-migrate.yml` and `supabase-migrate-dry-run.yml`) temporarily disable `supabase/config.toml` during migration runs. This is necessary because the pinned CLI version (2.65.5) does not support certain configuration keys present in the config file (such as `oauth_server`, `web3`, `email_optional`, `network_restrictions`, and `db.migrations.enabled`). The config file is renamed to `config.toml.disabled` before linking and restored after migrations complete. This workaround ensures migration stability while maintaining the config file for local development.

### Frontend Deployment (Netlify/Vercel)

1. **Build Application**

```bash
pnpm build
```

2. **Deploy to Netlify**

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

3. **Set Environment Variables**

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

## Twilio Configuration

### Account Setup

1. **Create Twilio Account**: https://console.twilio.com
2. **Get Credentials**: Account SID, Auth Token, Phone Number
3. **Configure Webhooks**:
   - **Incoming SMS Webhook**: `https://your-project.supabase.co/functions/v1/twilioInbound`
   - **HTTP Method**: POST

### Phone Number Setup

1. **Buy Twilio Phone Number**
2. **Configure Messaging**:
   - **Webhook URL**: Your inbound function URL
   - **HTTP Method**: POST
   - **Webhook Events**: Check "A message comes in"

### Testing SMS

```bash
# Test outbound SMS processing
curl -X POST https://your-project.supabase.co/functions/v1/processOutbox \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test inbound SMS (simulate Twilio webhook)
curl -X POST https://your-project.supabase.co/functions/v1/twilioInbound \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+1234567890&Body=YES&MessageSid=SMxxxxxxxx"
```

## Database Management

### Backup Procedures

```bash
# Create backup
supabase db dump --local > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
supabase db reset
psql -h localhost -p 54322 -U postgres -d postgres < backup_file.sql
```

### Migration Commands

```bash
# Create new migration
supabase migration new migration_name

# Apply migrations
supabase db push

# Reset database (destructive)
supabase db reset

# Check migration status
supabase migration list
```

### Schema Cache Reload (PostgREST/Supabase)

When adding or modifying foreign key relationships, PostgREST's schema cache must be reloaded for the relationships to be queryable via the REST API.

**Automatic reload in migrations**: Add this at the end of your migration:

```sql
NOTIFY pgrst, 'reload schema';
```

**Manual reload via SQL**:

```sql
-- Trigger schema cache reload
NOTIFY pgrst, 'reload schema';
```

**Manual reload via Supabase CLI**:

```bash
# Connect to your database and run:
supabase db execute --sql "NOTIFY pgrst, 'reload schema';"
```

**Symptoms of stale schema cache**:

- `Could not find a relationship between 'X' and 'Y' in the schema cache`
- Queries with relationship syntax (e.g., `table:foreign_table(...)`) fail
- Migration applied successfully but queries still fail

**When to reload**:

- After adding foreign key constraints
- After modifying table relationships
- After changing RLS policies that affect relationships
- Immediately after running `supabase db push` in production

### Data Verification

```sql
-- Check critical data counts
SELECT
  (SELECT COUNT(*) FROM vehicles) as vehicles_count,
  (SELECT COUNT(*) FROM jobs) as jobs_count,
  (SELECT COUNT(*) FROM vendors) as vendors_count,
  (SELECT COUNT(*) FROM user_profiles) as users_count;

-- Check notification outbox status
SELECT status, COUNT(*) FROM notification_outbox GROUP BY status;

-- Verify stock number indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'vehicles'
AND indexname LIKE '%stock%';
```

### Verifying job_parts ↔ vendors Relationship

After deploying migration `20251107000000_fix_job_parts_vendor_fkey.sql`, verify the relationship is working:

**Quick verification script**:

```bash
./scripts/verify-schema-cache.sh
```

**Manual SQL verification**:

```sql
-- 1. Check column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'job_parts'
  AND column_name = 'vendor_id';
-- Expected: vendor_id | uuid

-- 2. Check foreign key constraint exists
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'job_parts'
    AND kcu.column_name = 'vendor_id';
-- Expected: job_parts_vendor_id_fkey | vendor_id | vendors

-- 3. Check index exists
SELECT indexname
FROM pg_indexes
WHERE tablename = 'job_parts'
  AND indexname = 'idx_job_parts_vendor_id';
-- Expected: idx_job_parts_vendor_id

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
```

**API verification**:

```bash
# Test nested vendor relationship query
curl -X GET \
  "${VITE_SUPABASE_URL}/rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}"
```

**Expected success response**:

```json
[{ "id": "...", "vendor_id": "...", "vendor": { "id": "...", "name": "..." } }]
```

or empty array `[]` if no data exists.

**Error response (indicates FK missing)**:

```json
{
  "code": "...",
  "message": "Could not find a relationship between 'job_parts' and 'vendors' in the schema cache"
}
```

**Rollback procedure** (if needed):

```sql
-- Remove FK constraint
ALTER TABLE public.job_parts DROP CONSTRAINT IF EXISTS job_parts_vendor_id_fkey;

-- Optionally remove column (destructive)
ALTER TABLE public.job_parts DROP COLUMN IF EXISTS vendor_id;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
```

## Monitoring & Maintenance

### Health Checks

```bash
# Check Supabase connection
curl https://your-project.supabase.co/rest/v1/health

# Check edge function status
curl https://your-project.supabase.co/functions/v1/processOutbox

# Verify authentication
curl https://your-project.supabase.co/auth/v1/settings
```

### Performance Monitoring

```sql
-- Slow query monitoring
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage verification
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check notification processing
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  status,
  COUNT(*) as count
FROM notification_outbox
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour, status
ORDER BY hour DESC;
```

### Log Monitoring

```bash
# View edge function logs
supabase functions logs processOutbox

# View real-time logs
supabase functions logs processOutbox --follow

# Filter logs by level
supabase functions logs processOutbox --level error
```

## Common Issues & Solutions

### Issue: SMS Not Sending

**Symptoms**: Messages stuck in "pending" status
**Diagnosis**:

```sql
SELECT * FROM notification_outbox WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5;
```

**Solutions**:

1. Check Twilio credentials in Supabase secrets
2. Verify edge function deployment
3. Check function logs for errors
4. Manually trigger processOutbox function

### Issue: Stock Search Not Working

**Symptoms**: Vehicle searches return no results
**Diagnosis**:

```sql
-- Check if stock numbers exist
SELECT stock_number, COUNT(*) FROM vehicles GROUP BY stock_number;

-- Verify indexes
\d vehicles
```

**Solutions**:

1. Rebuild stock indexes: `REINDEX INDEX idx_vehicles_stock;`
2. Check for leading/trailing spaces in stock numbers
3. Verify case-insensitive search implementation

### Issue: Calendar Loading Slowly

**Symptoms**: Calendar takes >5 seconds to load
**Diagnosis**:

```sql
-- Check job counts by date range
SELECT DATE_TRUNC('day', scheduled_start_time) as day, COUNT(*)
FROM jobs
WHERE scheduled_start_time > NOW() - INTERVAL '30 days'
GROUP BY day;
```

**Solutions**:

1. Add date range pagination
2. Optimize get_jobs_by_date_range function
3. Consider caching for large datasets

### Issue: CSV Import Failing

**Symptoms**: Import shows errors or partial completion
**Diagnosis**:

1. Check browser console for JavaScript errors
2. Verify CSV format matches expected headers
3. Check for special characters or encoding issues
   **Solutions**:
4. Convert CSV to UTF-8 encoding
5. Ensure required fields (stock, customer) are present
6. Check for duplicate stock numbers in file

## Security Procedures

### RLS Policy Verification

```sql
-- Check that RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;

-- Verify user can only see their own data
SET ROLE authenticated;
SELECT * FROM jobs LIMIT 5;
RESET ROLE;
```

### User Access Audit

```sql
-- Review user roles
SELECT email, role, is_active, vendor_id
FROM user_profiles
ORDER BY role, full_name;

-- Check for inactive users with data
SELECT up.email, up.is_active, COUNT(j.id) as job_count
FROM user_profiles up
LEFT JOIN jobs j ON up.id = j.created_by
WHERE up.is_active = false
GROUP BY up.email, up.is_active;
```

### SMS Opt-out Compliance

```sql
-- Review opt-out status
SELECT COUNT(*) as opted_out_count FROM sms_opt_outs;

-- Verify opt-outs are respected
SELECT no.phone_e164, no.message_template, soo.opted_out_at
FROM notification_outbox no
LEFT JOIN sms_opt_outs soo ON no.phone_e164 = soo.phone_e164
WHERE soo.phone_e164 IS NOT NULL
AND no.created_at > soo.opted_out_at;
```

## Scheduled Maintenance

### Daily Tasks

- Check SMS processing status
- Review error logs
- Verify backup completion
- Monitor API response times

### Weekly Tasks

- Review user activity
- Clean up old notification_outbox records
- Update vendor hours if needed
- Check database storage usage

### Monthly Tasks

- Update dependencies
- Review and optimize slow queries
- Audit user permissions
- Test disaster recovery procedures

## Emergency Procedures

### SMS System Down

1. Check Twilio account status
2. Verify edge function deployment
3. Manually process critical notifications
4. Update customers via alternative channels

### Database Connection Issues

1. Check Supabase status page
2. Verify connection strings
3. Test with direct psql connection
4. Contact Supabase support if needed

### Authentication Failures

1. Check Supabase auth settings
2. Verify JWT configuration
3. Test with different user accounts
4. Clear browser cache/localStorage

## Contact Information

### Support Escalation

- **Critical Issues**: Immediate response required
- **Supabase Support**: support@supabase.io
- **Twilio Support**: https://support.twilio.com
- **Development Team**: [Your team contact]

### External Services

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Twilio Console**: https://console.twilio.com
- **Deployment Platform**: [Netlify/Vercel dashboard]
