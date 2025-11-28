# Deferred TODOs — Aftermarket Tracker

This document tracks TODO/FIXME items that are **non-blocking** and deferred to future sprints.

**Last Updated:** November 28, 2025

---

## Supabase Security Lint Follow-ups (Medium Priority)

**Category:** Security Hardening  
**Severity:** Medium  
**Related:** `docs/db-lint/README.md`, `docs/security.md`

Supabase's database linter flags the following items that require future attention:

### 1. Organizations Multi-Tenant Model Design

**Status:** Partial fix applied; design decision pending  
**Migration:** `20251126161700_enable_rls_on_organizations.sql`

**Current State:**
- RLS is enabled on `public.organizations` with basic org membership policies
- Users can SELECT/UPDATE their own organization via `user_profiles.org_id`

**Future Work Required:**
- Design decision needed: `owner_id` vs `tenant_id` vs membership table approach
- Consider role-based permissions for organization management (admin-only updates)
- Evaluate INSERT/DELETE policy requirements for multi-org scenarios
- Document the chosen multi-tenant model in architecture docs

**Why Deferred:**
- Current single-org implementation works for existing use cases
- Requires stakeholder input on multi-tenant requirements
- Low risk with RLS already enabled; policies can be refined later

### 2. pg_trgm Extension Schema Location

**Status:** Fixed  
**Migration:** `20251126161701_move_pg_trgm_extension.sql`

**Resolution:**
- `pg_trgm` extension moved from `public` to `extensions` schema
- Trigram indexes recreated with explicit `extensions.gin_trgm_ops` reference
- Search path includes `extensions` for proper resolution

**No further action required** — this item is resolved.

### 3. Auth Leaked Password Protection

**Status:** Dashboard configuration required  
**Documentation:** `docs/security.md`

**Current State:**
- This is a Supabase Auth configuration setting, not a SQL migration
- Production environments should have this enabled

**Future Work Required:**
- Enable "Leaked password protection" in Supabase Dashboard → Authentication → Settings
- Choose appropriate protection level (Medium or High for production)
- Document the setting in deployment runbook

**Why Deferred:**
- Requires manual Dashboard configuration per environment
- Will be addressed as part of production hardening checklist
- Does not affect development/staging functionality

### Proposed Follow-up Timeline

These items will be addressed in a dedicated "Supabase Hardening" change after:
1. Multi-tenant model design decision is made for organizations
2. Production deployment checklist is finalized
3. Security review is scheduled

---

## Test Enhancement (Low Priority)

**File:** `src/tests/unit-dealService.test.js:4`  
**Category:** Test Improvement  
**Severity:** Low

### Current TODO Comment
```javascript
// TODO: These tests need enhanced mocks to support the full chain of updateDeal operations
```

### Context
The existing tests for `updateDeal` in `dealService` adequately cover the primary behavior and edge cases. However, the full chain of internal operations (e.g., version checks, conflict resolution, line item updates) could benefit from more granular mocking.

### Why Deferred
- Current test coverage is sufficient for production use
- No known bugs or gaps in updateDeal behavior
- Enhanced mocks are a "nice-to-have" improvement
- Higher-priority work takes precedence

### Proposed Future Action
When expanding test coverage in a future sprint:
1. Add detailed mocks for Supabase client responses
2. Test version conflict scenarios more thoroughly
3. Add tests for line item update edge cases
4. Consider integration tests with real Supabase instance

### Priority
**Low** — Defer indefinitely unless:
- Bugs discovered in updateDeal that tests don't catch
- Test coverage metrics show gaps
- Team prioritizes test enhancement sprint

---

## Summary

| Category | Count | Priority | Status |
|----------|-------|----------|--------|
| Supabase Security Lint | 3 | Medium | 1 resolved, 2 pending |
| Test Enhancement | 1 | Low | Deferred |

**Total Deferred TODOs:** 4  
**Blocking TODOs:** 0  
**Critical TODOs:** 0

All deferred items are non-blocking. Security items have partial mitigations in place and full resolution is planned for a future "Supabase Hardening" sprint.

---

*For urgent TODOs that need immediate attention, search codebase for "TODO(urgent)" or "FIXME(critical)" (none found as of 2025-11-28).*
