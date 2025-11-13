# Deferred TODOs — Aftermarket Tracker

This document tracks TODO/FIXME items that are **non-blocking** and deferred to future sprints.

**Last Updated:** November 12, 2025

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

**Total Deferred TODOs:** 1  
**Blocking TODOs:** 0  
**Critical TODOs:** 0

All deferred items are low-priority enhancements that do not impact functionality, security, or operational readiness.

---

*For urgent TODOs that need immediate attention, search codebase for "TODO(urgent)" or "FIXME(critical)" (none found as of 2025-11-12).*
