# Quick Troubleshooting Guide: Transaction RLS Errors

## Error Message
```
Failed to save: Failed to upsert transaction: new row violates row-level security policy for table "transactions"
```

## Quick Fix Checklist

### 1. Is org_id in the form payload?

**Check in browser console** (when saving):
```javascript
// Look for: [DealFormV2] Saving deal with payload:
// Should show: org_id: "123e4567-..."
```

✅ **If YES**: org_id is being passed correctly  
❌ **If NO or NULL**: Form is not getting org_id

### 2. Is the user authenticated?

**Check in browser console**:
```javascript
// In AuthContext or useTenant hook
console.log('Auth user:', user)
console.log('Org ID:', orgId)
```

✅ **If user and orgId exist**: Authentication working  
❌ **If NULL**: User not logged in or session expired

### 3. Does the job have org_id?

**Check in database**:
```sql
SELECT id, org_id, job_number 
FROM jobs 
WHERE id = '<your-job-id>';
```

✅ **If org_id present**: Job properly scoped  
❌ **If org_id is NULL**: Data integrity issue

### 4. Do RLS policies exist?

**Check in database**:
```sql
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'transactions'
AND schemaname = 'public';
```

✅ **If "org can insert/update transactions" exist**: Policies configured  
❌ **If missing**: Run migration `20251105000000_fix_rls_policies_and_write_permissions.sql`

---

## Common Causes & Solutions

### Cause 1: Editing Old Deals (Before Fix)
**Symptom**: Edit works for new deals, fails for old ones  
**Solution**: This fix resolves it - org_id now preserved in edit flow

### Cause 2: Session Expired
**Symptom**: Works for a while, then starts failing  
**Solution**: Refresh page to get new session token

### Cause 3: User Profile Missing org_id
**Symptom**: Fails for specific user  
**Solution**: 
```sql
UPDATE user_profiles 
SET org_id = '<correct-org-id>' 
WHERE id = '<user-id>';
```

### Cause 4: Direct Database Changes
**Symptom**: Manually created jobs fail  
**Solution**: Always set org_id when creating jobs:
```sql
INSERT INTO jobs (job_number, org_id, ...) 
VALUES ('JOB-001', '<org-id>', ...);
```

---

## Debug Mode

Add this to your `.env.development`:
```
VITE_DEBUG_RLS=true
```

Then check console for detailed org_id flow:
```
[dealService:update] org_id missing from payload, fetching from job record
[dealService:update] Retrieved org_id from job: 123e4567-...
[dealService:update] RLS violation on transactions table: {...}
```

---

## Emergency Workaround (NOT RECOMMENDED)

**Only if production is down and you need immediate access:**

```sql
-- Temporarily disable RLS on transactions (DANGEROUS!)
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Remember to re-enable after fix!
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
```

⚠️ **WARNING**: This removes tenant isolation! Fix the root cause ASAP.

---

## Verification After Fix

1. **Create Deal**: Should work ✅
2. **Edit Deal**: Should work ✅  
3. **Console**: No RLS errors ✅
4. **Database**: `SELECT org_id FROM transactions` shows values, not NULL ✅

---

## Still Not Working?

1. Check you have the latest code with the fix
2. Clear browser cache and localStorage
3. Verify `mapDbDealToForm` includes `org_id` (line 1933 in dealService.js)
4. Contact team with:
   - Browser console logs
   - Database query results for job and transaction
   - User ID and org_id

---

## Quick Reference SQL

```sql
-- Check if transaction has org_id
SELECT job_id, org_id, customer_name 
FROM transactions 
WHERE job_id = '<job-id>';

-- Check if job has org_id  
SELECT id, org_id, job_number
FROM jobs
WHERE id = '<job-id>';

-- Check user's org_id
SELECT id, org_id, email
FROM user_profiles
WHERE id = '<user-id>';

-- Check what org_id the current user should have
SELECT public.auth_user_org();

-- View all RLS policies on transactions
\d+ transactions  -- psql command
```

---

**Last Updated**: November 23, 2025  
**Related**: TRANSACTION_RLS_FIX_COMPLETE.md
