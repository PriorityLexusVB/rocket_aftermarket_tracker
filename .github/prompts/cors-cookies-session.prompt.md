```prompt
---
name: cors-cookies-session
agent: agent
description: Diagnose CORS / cookie / session issues (blocked requests, missing auth header, SameSite/Secure warnings) for a Vite+Supabase SPA.
argument-hint: tabHint=<URL or tab title>
tools:
  - chrome-devtools/*
---

Goal: Explain why requests are blocked or unauthenticated due to CORS/session handling and propose the smallest fix.

Inputs:
- tabHint: ${input:tabHint}

Notes for this repo:
- This is Vite + React. Most Supabase auth in SPAs is via Authorization header (Bearer JWT) managed by supabase-js, not cookies.
- Cookie warnings can still matter if you’re using an auth helper, an iframe flow, or mixing origins.

Steps:
0) If chrome-devtools tools are not available, stop and say what’s missing.

1) list_pages → set_active_page(tabHint)
2) list_console_messages and extract ONLY:
   - CORS errors
   - cookie warnings (SameSite, Secure, domain/path)
   - mixed content
   - blocked by client
3) list_network_requests (last 80). Identify:
   - failed/blocked preflights (OPTIONS)
   - the request immediately after the preflight
   - any Supabase requests missing Authorization
4) Pull full details for:
   - preflight request/response (if present)
   - the failed request/response
5) Provide the smallest fix (choose the one that fits the evidence):
   - CORS headers change (server/proxy)
   - request `credentials` mode / fetch settings
   - ensure Authorization header is present (session restore)
   - ensure correct Supabase URL (VITE_SUPABASE_URL) and keys

Return:
- Evidence: exact console error/warning + failing request summary
- Root cause
- Smallest fix
- Proof step
```
