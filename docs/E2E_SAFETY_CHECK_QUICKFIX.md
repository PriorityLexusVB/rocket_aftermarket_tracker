# E2E Safety Check Quick Fix

**Issue**: E2E workflow failing at "Safety check - block E2E against production Supabase"

**Workflow Run**: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/runs/20557233940

---

## TL;DR - Two Options

### Option A: Temporarily Allow E2E on Production (5 minutes)
**⚠️ Use only if you're sure you want to run tests against production**

1. Go to: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/settings/variables/actions
2. Click "New repository variable"
3. Name: `ALLOW_E2E_ON_PROD`, Value: `1`
4. Click "Add variable"
5. Go to your PR and click "Re-run jobs"

**Warning**: This will seed test data into your production database.

---

### Option B: Set Up Dedicated E2E Supabase (30-60 minutes)
**✅ Recommended for long-term**

See full guide: [E2E_SAFETY_CHECK_GUIDE.md](./E2E_SAFETY_CHECK_GUIDE.md)

**Summary**:
1. Create new Supabase project named "Rocket Aftermarket Tracker - E2E"
2. Copy schema from production (migrations or manual)
3. Create E2E test user in new project
4. Update GitHub secrets to point to E2E project:
   - `VITE_SUPABASE_URL` → E2E project URL
   - `VITE_SUPABASE_ANON_KEY` → E2E anon key
   - `DATABASE_URL` → E2E database URL
   - `E2E_EMAIL` → E2E user email
   - `E2E_PASSWORD` → E2E user password
5. (Optional) Set `ENABLE_E2E_SEED=1` variable
6. Re-run workflow

---

## Why This Happened

The workflow has a **safety check** that prevents E2E tests from accidentally running against production databases. This is intentional and protects your production data.

**The safety check fails when**:
- `VITE_SUPABASE_URL` or `DATABASE_URL` contains production reference `ogjtmtndgiqqdtwatsue`
- AND `ALLOW_E2E_ON_PROD` is not set to "1"

**Your current situation**:
- ✅ Secrets are configured
- ✅ Workflow is working correctly
- ⚠️ But secrets point to production Supabase
- ⚠️ Safety check is blocking execution (as designed)

---

## Decision Matrix

| Scenario | Recommended Option | Risk Level |
|----------|-------------------|------------|
| Need tests to pass ASAP | Option A | 🔴 High |
| Have time to set up properly | Option B | 🟢 Low |
| Testing locally only | Neither - use `.env.local` | 🟢 Low |
| Production has test isolation | Option A | 🟡 Medium |
| No test isolation in prod | Option B | 🟢 Low |

---

## What Happens After Fix

### With Option A (ALLOW_E2E_ON_PROD=1)
```bash
# Workflow output:
⚠️ ALLOW_E2E_ON_PROD=1 set; skipping prod safety block
✅ Safety check passed
🔄 Seeding E2E test data...
🧪 Running E2E tests...
```

**Side effects**:
- Test data will be inserted into production database
- Tests may create/update/delete records in production
- Use with caution!

### With Option B (Dedicated E2E Supabase)
```bash
# Workflow output:
✅ Safety check passed (E2E Supabase detected)
🔄 Seeding E2E test data...
🧪 Running E2E tests...
```

**Side effects**:
- None! Tests run in isolated environment
- Production data is completely safe
- Can reset E2E database anytime

---

## Verification

After implementing either option, verify the fix:

1. **Go to workflow run**: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions
2. **Find step**: "Safety check - block E2E against production Supabase"
3. **Expected output**:
   - Option A: `⚠️ ALLOW_E2E_ON_PROD=1 set; skipping prod safety block`
   - Option B: No error, step passes silently

4. **Next steps should run**:
   - ✅ Seed E2E test data
   - ✅ Run E2E smoke tests

---

## Rollback Plan

### If Option A Causes Issues
1. Remove the variable:
   - Go to: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/settings/variables/actions
   - Find `ALLOW_E2E_ON_PROD`
   - Click "Delete"
2. Workflow will block E2E tests again (safe state)

### If Option B Causes Issues
1. Verify secrets are correct:
   - Check `VITE_SUPABASE_URL` doesn't contain `ogjtmtndgiqqdtwatsue`
   - Check `DATABASE_URL` doesn't contain `ogjtmtndgiqqdtwatsue`
2. If E2E tests fail, check:
   - Schema matches production
   - Test user exists and has permissions
   - RLS policies allow test user access

---

## FAQ

**Q: Can I just disable the safety check?**  
A: Not recommended. It's there to protect your production data. Use Option A or B instead.

**Q: Why don't I just run tests locally?**  
A: CI/CD runs tests automatically on every PR. Local testing is great for development, but CI ensures all PRs are tested consistently.

**Q: What if I don't have time for Option B right now?**  
A: Use Option A temporarily, but plan to implement Option B soon for safety.

**Q: Can I use the same E2E Supabase for multiple repositories?**  
A: Possible but not recommended. Each repo should have its own E2E project for isolation.

**Q: How much does an E2E Supabase project cost?**  
A: Supabase free tier (2 free projects) or Pro plan ($25/mo per project). E2E projects typically stay within free tier limits.

---

## Next Steps

1. **Choose your option**: A (quick) or B (proper)
2. **Implement**: Follow steps above
3. **Test**: Re-run the workflow
4. **Monitor**: Watch for any issues
5. **Document**: Update team on the choice made

For detailed instructions, see: [E2E_SAFETY_CHECK_GUIDE.md](./E2E_SAFETY_CHECK_GUIDE.md)
