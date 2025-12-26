```prompt
---
name: perf-slow-page
agent: agent
description: Identify top causes of a slow page (heavy network, large payloads, repeated calls) using DevTools.
argument-hint: tabHint=<URL or tab title>
tools:
  - chrome-devtools/*
---

Goal: Produce a short, prioritized list of fixes for a slow page with evidence.

Inputs:
- tabHint: ${input:tabHint}

Steps:
0) If chrome-devtools tools are not available, stop and say what’s missing.

1) list_pages → set_active_page(tabHint)
2) take_screenshot
3) list_network_requests (last 120)
4) Identify top 5 “heaviest” requests (by duration and/or size if available). For each:
   - method
   - status
   - URL (trim)
   - duration/size
5) Pull full details for the single heaviest request:
   - response body size indicators
   - query params (especially PostgREST select/order/limit)
6) list_console_messages for performance-related warnings/errors.

Fix guidance (keep it minimal and actionable):
- Reduce payloads: narrower select, pagination, avoid `select=*`.
- Avoid duplicate requests: dedupe triggers, stabilize dependencies.
- Add caching where safe (but beware tenant scoping by org_id).
- If it’s clearly a DB/query issue, recommend a follow-up: gather EXPLAIN before/after and add a covering index (only if explicitly requested in a dedicated perf PR).

Return:
- Top 5 heaviest requests (table)
- Single most likely root cause
- Prioritized fixes (3–5 bullets)
```
