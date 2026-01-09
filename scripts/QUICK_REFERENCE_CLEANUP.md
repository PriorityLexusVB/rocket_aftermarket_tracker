# Cleanup Old Deals - Quick Reference Card

## 🚀 Quick Start (3 Steps)

### 1. Get Your Organization ID

```sql
-- Run in Supabase SQL Editor
SELECT id, name FROM organizations;
```

### 2. Preview (Dry-Run)

```bash
ORG_ID="your-org-uuid-here" pnpm run cleanup:old-deals
```

### 3. Execute (After Backup!)

```bash
DRY_RUN=false ORG_ID="your-org-uuid-here" pnpm run cleanup:old-deals
```

---

## 📋 What You Need

### Environment Variables

Add to `.env.local` or export before running:

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
ORG_ID="550e8400-e29b-41d4-a716-446655440000"
```

**Where to find:**

- **SUPABASE_URL**: Supabase Dashboard → Settings → API → URL
- **SERVICE_ROLE_KEY**: Supabase Dashboard → Settings → API → service_role (⚠️ NOT anon_key!)
- **ORG_ID**: Run the SQL query above

---

## ⚡ Commands

### Using npm/pnpm script

```bash
# Preview only (safe)
pnpm run cleanup:old-deals

# Actually delete (after backup!)
DRY_RUN=false pnpm run cleanup:old-deals

# With inline ORG_ID
ORG_ID="your-uuid" pnpm run cleanup:old-deals
```

### Direct execution

```bash
node scripts/cleanupOldDeals.cjs
```

### SQL Version

Use `scripts/sql/cleanup_old_deals.sql` in Supabase SQL Editor

---

## 🎯 What It Does

**Keeps:** Newest job (by created_at)

**Deletes:** All other jobs for your org, plus:

- job_parts
- loaner_assignments
- transactions

**Never touches:** Jobs from other organizations

---

## ✅ Safety Checklist

Before running with `DRY_RUN=false`:

- [ ] I backed up my database
- [ ] I ran in DRY_RUN mode first
- [ ] I reviewed the preview output carefully
- [ ] The correct job is being kept
- [ ] The job counts look right
- [ ] I have the correct ORG_ID
- [ ] I understand this is permanent

---

## 🔍 Example Output (Dry-Run)

```
Configuration:
  Supabase URL: https://xxx.supabase.co
  Organization ID: 550e8400-...
  Mode: 🔍 DRY RUN (preview only)

Step 1: Querying jobs for organization...
   Found 5 job(s) for this organization

✅ Job to KEEP:
   ID: abc-123-def-456
   Number: JOB-2025-001
   Title: Customer Vehicle Service
   Created: 2025-12-06T10:30:00.000Z

🗑️  Jobs to DELETE: 4
   1. JOB-2025-000 - Test Deal
   2. JOB-2024-099 - Old Service
   ...

Related Records Summary:
   job_parts: 12 records
   loaner_assignments: 3 records
   transactions: 8 records
   jobs: 4 records

🔍 DRY RUN MODE - No data was deleted
```

---

## ⚠️ Troubleshooting

### "Missing SUPABASE_SERVICE_ROLE_KEY"

→ You need the **service_role** key from Settings → API, not the anon key

### "ORG_ID must be a valid UUID"

→ Format: `550e8400-e29b-41d4-a716-446655440000` (with hyphens)

### "No jobs found"

→ Check your ORG_ID is correct with:

```sql
SELECT id, job_number, org_id FROM jobs LIMIT 10;
```

### "Permission denied"

→ Confirm you're using SERVICE_ROLE_KEY, not ANON_KEY

---

## 📚 Full Documentation

- **Detailed Guide**: `scripts/README_CLEANUP_OLD_DEALS.md`
- **Script Source**: `scripts/cleanupOldDeals.cjs`
- **SQL Version**: `scripts/sql/cleanup_old_deals.sql`

---

## 🛑 Important Reminders

- ⚠️ This is a **ONE-OFF MAINTENANCE** script
- ⚠️ **ALWAYS backup** before running
- ⚠️ **ALWAYS preview** in dry-run mode first
- ⚠️ This is **PERMANENT** - there's no undo
- ⚠️ **NEVER** use in normal app flow
- ⚠️ **NEVER** commit real credentials to git

---

## 💡 When to Use

✅ Good:

- Cleaning up test/dev data
- Removing duplicate jobs
- Resetting test environment

❌ Bad:

- Production without review
- Automated processes
- Regular app operations

---

Need help? See `scripts/README_CLEANUP_OLD_DEALS.md` for complete documentation.
