---
name: ui-state-desync
agent: 'agent'
description: Diagnose “saved but UI didn’t update / reverted / stale list” issues (state, caching, optimistic updates) using DevTools evidence.
argument-hint: tabHint=<URL or tab title> actionSteps=<short repro steps>
tools:
  - chrome-devtools/*
---

Goal: Determine whether the UI desync is caused by stale cache, missing refetch, optimistic update bug, or server returning unexpected data.

Inputs:

- tabHint: ${input:tabHint}
- actionSteps: ${input:actionSteps}

Repo facts to use:

- Multi-tenant scoping key is org_id; missing org_id often causes “looks saved then disappears” behavior.
- Dropdown caching TTL/prefetch patterns exist in the app; stale caches are a common culprit.

Steps: 0) If chrome-devtools tools are not available, stop and say what’s missing.

1. list_pages → set_active_page(tabHint)
2. take_screenshot (captures the “wrong UI” state)
3. list_network_requests (last 40) as baseline
4. Follow the provided actionSteps. Then list_network_requests again (last 80).
5. Identify two requests:
   A) the “save” call (POST/PATCH)
   B) the subsequent “refresh/list” call (GET) that should reflect the change
6. Pull full request/response for both A and B.
7. evaluate_script to gather client clues (return as JSON):
   - location.href
   - a small subset of localStorage keys/values that look like cache/org/session (filter by substrings: "org", "cache", "supabase", "telemetry")
   - whether a hard reload would likely bypass caching

8. Decide which bucket it is:

- Stale cache: refresh call returns correct data but UI shows old → cache/selector bug.
- Missing refetch: save succeeds but refresh never fires → invalidation missing.
- Optimistic update bug: UI updates then reverts when refresh returns different shape.
- Server inconsistency: save response differs from list response (or missing org_id filtering).

9. Provide smallest fix + proof step.

Return:

- What happened (save vs refresh)
- Root cause bucket
- Smallest fix (exact code-level suggestion)
- Proof step
