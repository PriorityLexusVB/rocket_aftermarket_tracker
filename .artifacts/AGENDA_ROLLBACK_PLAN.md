# Agenda Feature Rollback Plan

## Quick Rollback (Feature Flag)

### Step 1: Disable Feature Flag
**File:** `.env.local` or deployment environment

```bash
# Change from:
VITE_SIMPLE_CALENDAR=true

# To:
VITE_SIMPLE_CALENDAR=false
```

**Effect:**
- Agenda route becomes inaccessible
- DealForm stops redirecting to Agenda
- No code removal needed
- Instant rollback on next deployment

**Verification:**
1. Navigate to `/calendar/agenda` → should 404
2. Create scheduled deal → should NOT redirect
3. Legacy calendar flows unaffected

---

## Partial Rollback (Remove Enhancements Only)

If you want to keep basic Agenda but remove enhancements:

### Files to Revert

#### 1. Remove Undo Complete
**File:** `src/pages/calendar-agenda/index.jsx`

**Lines to revert:** 163-194 (handleComplete function)

Replace with:
```javascript
async function handleComplete(job) {
  try {
    await jobService.updateStatus(job.id, 'completed', { 
      completed_at: new Date().toISOString() 
    })
    toast?.success?.('Marked completed')
    await load()
  } catch (e) {
    toast?.error?.('Complete failed')
  }
}
```

#### 2. Remove Advanced Filters
**File:** `src/pages/calendar-agenda/index.jsx`

**Lines to remove:**
- Lines 67-68: `conflicts` and enhanced state
- Lines 72-77: `dateRange` and `vendorFilter` state
- Lines 79-94: Enhanced URL sync
- Lines 122-150: Conflict detection useEffect
- Lines 28-52: Enhanced applyFilters (revert to original)

**Revert to original:**
```javascript
function applyFilters(rows, { q, status }) {
  return rows.filter((r) => {
    if (status && r.job_status !== status) return false
    if (q) {
      const needle = q.toLowerCase()
      const hay = [r.title, r.description, r.job_number, r.vehicle?.owner_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}
```

#### 3. Remove Conflict Hints
**File:** `src/pages/calendar-agenda/index.jsx`

**Lines to remove:**
- Line 8: `import { calendarService }` (if not used elsewhere)
- Lines 291-299: Conflict warning icon
- Line 275: `const hasConflict = conflicts.get(r.id)`

#### 4. Simplify Header
**File:** `src/pages/calendar-agenda/index.jsx`

**Lines to remove:**
- Line 233: aria-live region
- Lines 241-250: Date range filter dropdown

---

## Full Rollback (Complete Removal)

### Files to Delete

```bash
# Core Agenda files
rm -f src/pages/calendar-agenda/index.jsx
rm -f src/pages/calendar-agenda/RescheduleModal.jsx
rm -rf src/pages/calendar-agenda/

# Tests
rm -f src/tests/agenda.dateKey.test.js
rm -f e2e/agenda.spec.ts

# Documentation
rm -f .artifacts/AGENDA_*.md
```

### Files to Revert

#### 1. `.env.example`
```diff
- VITE_SIMPLE_CALENDAR=false
+ VITE_SIMPLE_CALENDAR=
```

#### 2. `src/Routes.jsx`
Remove lines 23-25 and 120-129:
```diff
- const SimpleAgendaEnabled =
-   String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'
- const CalendarAgenda = SimpleAgendaEnabled ? lazy(() => import('./pages/calendar-agenda')) : null

...

-         {SimpleAgendaEnabled && (
-           <Route
-             path="/calendar/agenda"
-             element={
-               <ProtectedRoute>
-                 <CalendarAgenda />
-               </ProtectedRoute>
-             }
-           />
-         )}
```

#### 3. `src/pages/deals/DealForm.jsx`
Remove lines 579-589 (redirect logic):
```diff
-         // Optional: redirect to Agenda when feature flag enabled and scheduling set
-         try {
-           const agendaOn =
-             String(import.meta.env?.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'
-           const hasSchedule = !!(
-             savedRecord?.scheduled_start_time || payload?.scheduled_start_time
-           )
-           if (agendaOn && hasSchedule && savedRecord?.id) {
-             navigate(`/calendar/agenda?focus=${encodeURIComponent(savedRecord.id)}`)
-           }
-         } catch (_) {}
```

---

## Verification Steps After Rollback

### 1. Feature Flag Disabled
```bash
# Should return 404
curl http://localhost:5173/calendar/agenda

# Should not see SIMPLE_CALENDAR in logs
grep -r "SIMPLE_CALENDAR" src/pages/deals/DealForm.jsx
```

### 2. Build Still Works
```bash
pnpm run build
# Should succeed
```

### 3. Tests Still Pass
```bash
pnpm test
# Should pass (minus removed Agenda tests)
```

### 4. Legacy Calendar Works
```bash
# Navigate to:
http://localhost:5173/calendar-flow-management-center
# Should work normally
```

---

## Git Rollback Commands

### Rollback to Before Agenda Changes

```bash
# Find the commit before Agenda work
git log --oneline | grep -B1 "Initial exploration"

# Revert to that commit (example)
git revert aa54075^..aa54075

# Or reset (destructive)
git reset --hard <commit-before-agenda>
git push --force origin copilot/confirm-agenda-flow-patches
```

### Cherry-pick Removal

If you need to keep other changes but remove Agenda:
```bash
# Revert specific commits
git revert aa54075  # Enhancements
git revert d23f271  # ESC handlers
git revert <first-agenda-commit>
```

---

## Database Rollback

### No Database Changes Required

✅ **Good News:** Agenda feature uses existing tables and RPCs
- No new migrations to roll back
- No schema changes
- No data modifications
- No RLS policy changes

**RPCs Used (already existed):**
- `get_jobs_by_date_range` (keep)
- `check_vendor_schedule_conflict` (keep)
- Both used by other calendar features

**Tables Used (no changes):**
- `jobs` (read/update only)
- `vendors` (read only)
- `vehicles` (read only)

**Result:** No database rollback needed

---

## Deployment Rollback

### Vercel/Production

**Option 1: Revert Deployment**
```bash
# Via Vercel dashboard
1. Go to Deployments
2. Find previous deployment (before Agenda)
3. Click "Promote to Production"
```

**Option 2: Environment Variable**
```bash
# Via Vercel dashboard or CLI
vercel env add VITE_SIMPLE_CALENDAR
# Set value: false
vercel --prod
```

**Option 3: Redeploy Previous Commit**
```bash
git checkout <commit-before-agenda>
git push origin HEAD:main --force
```

---

## Rollback Checklist

- [ ] Set `VITE_SIMPLE_CALENDAR=false` in environment
- [ ] Verify `/calendar/agenda` returns 404
- [ ] Verify DealForm does NOT redirect after save
- [ ] Verify legacy calendar still works
- [ ] Run build and tests
- [ ] Deploy with flag disabled

**If Full Removal:**
- [ ] Delete Agenda directory and files
- [ ] Revert Routes.jsx changes
- [ ] Revert DealForm.jsx redirect
- [ ] Revert .env.example
- [ ] Remove tests
- [ ] Verify build still succeeds
- [ ] Verify no import errors

---

## Estimated Rollback Time

| Method | Time | Difficulty | Risk |
|--------|------|------------|------|
| **Feature Flag Only** | < 1 min | Easy | None |
| **Partial Removal** | 5-10 min | Easy | Low |
| **Full Removal** | 15-20 min | Medium | Low |
| **Git Revert** | 2-5 min | Easy | None |

---

## Recovery (Re-enable)

If you need to re-enable after rollback:

```bash
# 1. Set flag
VITE_SIMPLE_CALENDAR=true

# 2. Redeploy
git checkout copilot/confirm-agenda-flow-patches
git push origin copilot/confirm-agenda-flow-patches:main

# 3. Verify
curl http://localhost:5173/calendar/agenda
# Should return 200
```

---

## Support Contacts

**Branch:** `copilot/confirm-agenda-flow-patches`
**PR:** (to be created)
**Commits:** 
- `1e624b2` - Initial
- `d23f271` - ESC handlers
- `aa54075` - Enhancements

**Files Changed:** 5 files
**Lines Changed:** +134 lines
**New Dependencies:** 0 (no new packages)

---

## Rollback Decision Matrix

| Scenario | Recommended Action |
|----------|-------------------|
| **Bug in Agenda** | Disable flag temporarily |
| **Performance issue** | Keep flag, remove conflict checks |
| **User confusion** | Keep flag, improve docs/training |
| **Security concern** | Disable flag immediately, investigate |
| **Feature not needed** | Full removal after testing |
| **Temporary disable** | Flag only, no code removal |

---

## Post-Rollback Actions

After any rollback:

1. ✅ Notify team of change
2. ✅ Update feature flag documentation
3. ✅ Document reason for rollback
4. ✅ Create issue for re-enablement (if temporary)
5. ✅ Verify monitoring/alerts still work
6. ✅ Check for any dangling references

**Remember:** Feature flag makes this safe and reversible!
