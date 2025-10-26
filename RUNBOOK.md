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
