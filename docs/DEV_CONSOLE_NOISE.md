# Development Console Noise - Safe to Ignore

This document explains common console errors that appear during local development but do NOT affect application functionality.

## Chrome Extension Errors

**Example:**
```
Failed to load resource: net::ERR_FAILED
chrome-extension://hdokiejnpimakedhajhdlcegeplioahd/...
```

**Cause:** Browser extensions (like password managers, ad blockers, or developer tools) trying to inject scripts into the page.

**Impact:** None. These errors do NOT affect:
- Database operations (including `job_parts` writes)
- Authentication flows
- Application state or data integrity

**Action:** Safe to ignore. These are browser extension artifacts, not application errors.

---

## Pre-Login RLS 401 Errors

**Example:**
```
POST https://[project].supabase.co/rest/v1/products 401 (Unauthorized)
POST https://[project].supabase.co/rest/v1/vendors 401 (Unauthorized)
POST https://[project].supabase.co/rest/v1/user_profiles 401 (Unauthorized)
```

**Cause:** The application attempts to prefetch dropdown data (products, vendors, user profiles) before user authentication completes. Supabase RLS policies correctly reject these requests with 401.

**Impact:** Expected RLS behavior. These errors do NOT affect:
- Authentication flow (login still succeeds)
- Post-login data access (dropdowns load correctly after auth)
- The `DELETE` + `POST` sequence for `job_parts` (happens only after auth)

**Action:** Safe to ignore. These are expected pre-authentication RLS denials, not application bugs.

**Why This Happens:**
1. App initializes and attempts to prefetch dropdowns for better UX
2. User is not yet authenticated
3. RLS policies correctly reject the requests
4. User logs in
5. Subsequent dropdown requests succeed with proper authentication

---

## When to Be Concerned

❌ **DO** investigate console errors if they:
- Occur AFTER successful login
- Mention `job_parts` table operations failing
- Include messages like "Failed to delete", "Failed to insert", or "duplicate key violation"
- Cause visible UI errors or data loss

✅ **DON'T** worry about:
- Chrome extension errors (any `chrome-extension://` URL)
- Pre-login 401 errors for `products`, `vendors`, `user_profiles`
- Network errors from browser extensions or dev tools

---

## Debugging Tips

If you want to reduce console noise during development:

1. **Disable browser extensions** in an incognito/private window
2. **Add auth guards to prefetch logic** (defer until `session` is available)
3. **Filter console messages** in Chrome DevTools:
   - Click the filter icon
   - Add negative filter: `-chrome-extension:`
   - Add negative filter: `-401` (if pre-login 401s are cluttering output)

---

## Related Files

- `src/App.jsx` - Dropdown prefetch logic
- `src/services/dropdownService.js` - Caching and RLS handling
- `DEBUGGING_ACCUMULATION_BUG.md` - Guide for real `job_parts` issues
- `JOB_PARTS_WRITE_CONSOLIDATION.md` - Single source of truth for writes
