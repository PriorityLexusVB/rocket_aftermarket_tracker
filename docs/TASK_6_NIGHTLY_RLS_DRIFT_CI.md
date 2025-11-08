# Task 6: Nightly RLS Drift & Health CI Workflow

## Status: ✅ COMPLETED

## Branch

`ci/nightly-rls-drift`

## Objective

Create a GitHub Actions workflow that runs nightly to:

1. Execute schema drift script (`verify-schema-cache.sh`)
2. Curl health endpoints (`/api/health` and `/api/health-deals-rel`)
3. Fail on relationship errors or drift detection
4. Output actionable log instructions
5. Create GitHub issues on failure

## Implementation

### Workflow File

**File**: `.github/workflows/rls-drift-nightly.yml`

### Schedule

- **Cron**: `0 3 * * *` (3 AM UTC daily)
- **Manual Trigger**: `workflow_dispatch` enabled
- **Repository**: Only runs on `PriorityLexusVB/rocket_aftermarket_tracker` (skips forks)

### Jobs

#### Job: `rls-drift-check`

**Runner**: `ubuntu-latest`

**Steps**:

1. **Checkout** (actions/checkout@v4)
   - Checks out repository code

2. **Setup pnpm via corepack**
   - Reads `packageManager` version from package.json
   - Enables corepack and activates correct pnpm version

3. **Setup Node.js** (actions/setup-node@v4)
   - Node version: 20
   - Caches pnpm dependencies

4. **Install dependencies**
   - Runs `pnpm install --frozen-lockfile`

5. **Run Schema Drift Script**
   - Executes `bash scripts/verify-schema-cache.sh`
   - Requires secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - Output: `drift_detected=true/false`
   - Uses `continue-on-error` to proceed to health checks

6. **Check Health Endpoint**
   - Curls `/api/health`
   - Parses HTTP status code
   - Output: `health_ok=true/false`
   - Runs even if previous step fails (`if: always()`)

7. **Check Deals Relationship Health Endpoint**
   - Curls `/api/health-deals-rel`
   - Parses HTTP status code and JSON body
   - Checks for `"relationship":true` in response
   - Output: `deals_rel_ok=true/false`
   - Runs even if previous steps fail (`if: always()`)

8. **Generate Summary**
   - Creates workflow summary with results
   - Includes pass/fail status for each check
   - Provides troubleshooting links
   - Always runs (`if: always()`)

9. **Create Issue on Failure**
   - Runs only if drift detected (`if: failure() && drift_detected == 'true'`)
   - Uses `actions/github-script@v7`
   - Creates labeled issue (`schema-drift`, `automated`, `priority-high`)
   - Or adds comment to existing open issue
   - Includes workflow run link, troubleshooting steps, resolution guidance

10. **Fail Workflow on Issues**
    - Fails if any check failed
    - Ensures workflow status reflects health

### Required Secrets

#### SUPABASE_URL

- Production Supabase project URL
- Example: `https://your-project.supabase.co`
- Used by: verify-schema-cache.sh, health endpoints

#### SUPABASE_ANON_KEY

- Production Supabase anon/public API key
- Used by: verify-schema-cache.sh (REST API calls)

### Permissions

```yaml
permissions:
  contents: read # Read repository code
  issues: write # Create/comment on issues
```

### Features

#### 1. Automated Drift Detection

- Runs `verify-schema-cache.sh` with production credentials
- Checks:
  - ✅ Column existence (vendor_id in job_parts)
  - ✅ FK constraint (job_parts_vendor_id_fkey)
  - ✅ Index (idx_job_parts_vendor_id)
  - ✅ REST API relationship query
  - ✅ Schema cache staleness

#### 2. Health Endpoint Monitoring

- **Basic Health** (`/api/health`):
  - Validates Supabase connectivity
  - Expected: HTTP 200, `{ ok: true, db: true }`

- **Deals Relationship** (`/api/health-deals-rel`):
  - Validates jobs → job_parts → vendors relationship
  - Expected: HTTP 200, `{ ok: true, relationship: true }`
  - Detects schema cache drift

#### 3. Actionable Reporting

- **Workflow Summary**: Markdown table with pass/fail status
- **GitHub Issues**: Auto-created on drift detection
- **Troubleshooting Links**: Direct links to documentation
- **Workflow Run Link**: Included in issue body

#### 4. Issue Management

- Checks for existing open issues with `schema-drift` label
- Avoids duplicate issues (adds comment instead)
- Labels: `schema-drift`, `automated`, `priority-high`
- Template includes:
  - Workflow run link
  - Likely causes
  - Troubleshooting steps
  - Resolution code snippets

### Output Examples

#### Workflow Summary (Success)

```markdown
## Nightly RLS Drift & Health Check Results

**Date**: 2025-11-08 03:00:00 UTC

### Schema Drift Check

✅ **PASS** - No schema drift detected

### Health Endpoints

#### /api/health

✅ **PASS** - Basic health check OK

#### /api/health-deals-rel

✅ **PASS** - Deals relationship OK

### Actions

✅ **All Checks Passed** - System healthy
```

#### Workflow Summary (Failure)

```markdown
## Nightly RLS Drift & Health Check Results

**Date**: 2025-11-08 03:00:00 UTC

### Schema Drift Check

❌ **FAIL** - Schema drift detected

**Action Required**: Run `scripts/verify-schema-cache.sh` locally to diagnose

### Health Endpoints

#### /api/health

✅ **PASS** - Basic health check OK

#### /api/health-deals-rel

❌ **FAIL** - Deals relationship check failed

### Actions

⚠️ **Issues Detected** - Review logs above for details

**Troubleshooting**:

- Check [TROUBLESHOOTING_SCHEMA_CACHE.md](...)
- Run `bash scripts/verify-schema-cache.sh` locally
- Check [DEPLOY_CHECKLIST.md](...)
```

#### GitHub Issue (Auto-Created)

````markdown
Title: 🚨 Nightly Check: RLS Schema Drift Detected
Labels: schema-drift, automated, priority-high

## Schema Drift Detected

The nightly RLS drift check has detected a potential schema cache issue.

**Workflow Run**: [link]
**Date**: Fri, 08 Nov 2025 03:00:00 GMT

### Likely Causes

1. Recent migration added FK constraint without `NOTIFY pgrst, 'reload schema'`
2. PostgREST cache not reloaded after schema change
3. Column or relationship missing from database

### Troubleshooting Steps

1. Review workflow logs: [link]
2. Run locally: `bash scripts/verify-schema-cache.sh`
3. Check recent migrations in `supabase/migrations/`
4. See [TROUBLESHOOTING_SCHEMA_CACHE.md](...)
5. See [DEPLOY_CHECKLIST.md](...)

### Resolution

If a migration is missing `NOTIFY pgrst, 'reload schema'`, add it and redeploy:

```sql
-- At end of migration
NOTIFY pgrst, 'reload schema';
```
````

Or manually reload via Supabase SQL Editor:

```sql
NOTIFY pgrst, 'reload schema';
```

````

### CI/CD Integration

#### How It Works
1. **Scheduled**: Runs automatically at 3 AM UTC every day
2. **Manual**: Can be triggered via GitHub Actions UI
3. **Detection**: Checks schema drift and health endpoints
4. **Notification**: Creates/updates GitHub issues on failure
5. **Monitoring**: Workflow status visible in Actions tab

#### Dependencies
- Supabase CLI (installed via pnpm)
- curl (pre-installed on ubuntu-latest)
- jq (used in health checks for JSON parsing)
- Production Supabase credentials (secrets)

### Testing

#### Manual Trigger
1. Go to GitHub Actions tab
2. Select "Nightly RLS Drift & Health Check" workflow
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow" button

#### Local Testing
```bash
# Test schema drift script
bash scripts/verify-schema-cache.sh

# Test health endpoints
curl -s "${VITE_SUPABASE_URL}/api/health" | jq .
curl -s "${VITE_SUPABASE_URL}/api/health-deals-rel" | jq .
````

### Error Handling

#### Script Failures

- `continue-on-error: true` on drift check
- Allows health checks to run even if drift detected
- Final step fails if any check failed

#### Network Failures

- Curl uses `|| echo "000"` fallback
- HTTP code 000 indicates network/curl failure
- Logged and reported as failure

#### Missing Secrets

- Workflow fails gracefully
- Error message indicates missing secret
- Does not expose secret values

### Monitoring

#### Success Indicators

- ✅ Green check mark in Actions tab
- ✅ All checks passed in summary
- ✅ No issues created

#### Failure Indicators

- ❌ Red X in Actions tab
- ❌ Failed checks in summary
- ❌ GitHub issue created
- ❌ Workflow status email sent

### Maintenance

#### Updating Schedule

Edit cron expression in workflow file:

```yaml
schedule:
  - cron: '0 3 * * *' # Change time here
```

#### Adding Checks

Add new step after step 7:

```yaml
- name: Check New Endpoint
  id: new_check
  if: always()
  run: |
    # Your check logic
    echo "new_check_ok=true" >> $GITHUB_OUTPUT
```

Update summary generation and final step condition.

#### Customizing Issues

Edit issue template in step 9:

- Modify title
- Update body content
- Change labels
- Adjust duplicate detection logic

## Acceptance Criteria

- [x] ✅ Workflow file created in `.github/workflows/`
- [x] ✅ Runs on schedule (cron: `0 3 * * *`)
- [x] ✅ Executes `scripts/verify-schema-cache.sh`
- [x] ✅ Curls `/api/health` endpoint
- [x] ✅ Curls `/api/health-deals-rel` endpoint
- [x] ✅ Fails on drift detection (exit code 1)
- [x] ✅ Fails on health endpoint errors
- [x] ✅ Generates actionable summary
- [x] ✅ Creates GitHub issues on failure
- [x] ✅ Includes troubleshooting links
- [x] ✅ Uses proper GitHub Actions syntax
- [x] ✅ Requires appropriate secrets
- [x] ✅ Sets correct permissions

## Files Modified

1. `.github/workflows/rls-drift-nightly.yml` (NEW, 10,109 bytes)
2. `docs/TASK_6_NIGHTLY_RLS_DRIFT_CI.md` (this file)

**Total Files**: 2 files

## Related Files (Reference Only)

- `scripts/verify-schema-cache.sh` - Drift detection script
- `src/api/health.js` - Basic health endpoint
- `src/api/health-deals-rel.js` - Relationship health endpoint
- `docs/TROUBLESHOOTING_SCHEMA_CACHE.md` - Troubleshooting guide
- `docs/DEPLOY_CHECKLIST.md` - Deployment procedures

## Conclusion

**Task 6 Complete**: Nightly CI workflow implemented for:

1. ✅ Schema drift detection via verify-schema-cache.sh
2. ✅ Health endpoint monitoring (2 endpoints)
3. ✅ Actionable failure reporting
4. ✅ Automated GitHub issue creation
5. ✅ Comprehensive workflow summary

The workflow provides:

- **Proactive Monitoring**: Daily checks catch issues early
- **Automated Response**: Issues created automatically
- **Clear Guidance**: Troubleshooting steps included
- **Low Maintenance**: Runs unattended, self-documenting

---

**Task Completed**: 2025-11-07  
**Branch**: ci/nightly-rls-drift  
**Author**: Coding Agent (Task 6 Implementation)
