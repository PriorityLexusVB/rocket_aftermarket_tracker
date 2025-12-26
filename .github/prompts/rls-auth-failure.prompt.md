```prompt
---
name: rls-auth-failure
agent: agent
description: Diagnose Supabase auth/RLS failures (401/403/400) for Rocket Aftermarket Tracker using DevTools + Supabase context.
argument-hint: tabHint=<URL or tab title> urlContains=</rest/v1/... or keyword>
tools:
  - chrome-devtools/*
  - supabase/*
---

Goal: Explain why Supabase is rejecting this request (401/403/400) and propose the smallest safe fix.

Repo facts (use these):
- Stack: Vite + React (client) + Supabase Postgres/PostgREST + RLS.
- Tenant key: org_id (equivalent conceptually to dealership_id).
- Client code should NOT do ad-hoc Supabase CRUD in components; prefer service modules.
- If you think an RLS/policy change is needed, propose it explicitly as a migration plan (do not “just change prod”).

Inputs:
- tabHint: ${input:tabHint}
- urlContains: ${input:urlContains}

Workflow:

0) Tool availability
- If chrome-devtools tools are not available, stop and say what’s missing.
- If supabase tools are not available, continue with DevTools-only and provide manual Supabase steps (SQL/policy checks) as “Manual fallback”.

1) Capture the failing request (DevTools)
- list_pages → set_active_page using tabHint.
- list_network_requests (last 80).
- Find the most relevant failure where:
  - URL contains urlContains OR
  - status in [401, 403, 400] against Supabase domains (/rest/v1, /auth/v1, /storage/v1).
- Pull full request + response details:
  - method, full URL + query
  - request headers (especially Authorization, apikey, Prefer)
  - request body (if any)
  - response status + headers
  - response body (PostgREST error JSON is critical)
- list_console_messages: include only actionable auth/RLS clues.

2) Classify the failure quickly
- 401: auth/session missing or expired (missing/invalid Authorization).
- 403: RLS denied OR missing tenant scope (org_id) OR wrong role/claims.
- 400: invalid query, schema cache mismatch, or payload shape mismatch.

3) Derive the target table/view + operation
- If URL looks like /rest/v1/<table_or_view>: capture that identifier.
- Operation:
  - GET/HEAD = SELECT
  - POST = INSERT
  - PATCH = UPDATE
  - DELETE = DELETE

4) Check for tenant scoping (org_id)
- If it’s a SELECT/list request: confirm org_id is constrained (e.g., eq.<orgId>) OR constrained by a view/RLS.
- If it’s an INSERT/UPDATE: confirm org_id is included in payload (or derived server-side).
- If org_id is missing, treat that as the default likely root cause.

5) Determine effective identity from the request
- From Authorization header (Bearer JWT) and/or Supabase client behavior:
  - Identify whether this is anon vs logged-in.
  - If possible, decode JWT claims (sub, role) and note them.
- If request has no Authorization but should: identify where the session should come from in the app.

6) Smallest safe fix (choose ONE primary)
Provide exactly one primary fix with an exact change:
- Client payload fix: add org_id (or correct org_id) and/or correct filters.
- Session fix: ensure Authorization is sent; fix session restore; refresh token flow.
- Policy fix (only if necessary): propose minimal RLS adjustment that preserves tenant isolation.

7) Proof step
- Give a single “prove it” step: what to click/redo and what success looks like (status 200/201, expected rows).

Health wedge (fast sanity checks)
- If the problem might be env/config rather than RLS, instruct to run `scripts/dev-verify.sh` and/or hit `/api/health/*` endpoints to confirm app/Supabase connectivity.

Return format:
- Root cause (1 paragraph)
- Fix (exact change)
- Proof step (retest)
- Manual fallback (only if supabase tools unavailable)
```
