```prompt
---
name: debug-router
agent: agent
description: Choose the right debug prompt for the problem (network vs RLS/auth vs CORS vs UI desync vs perf vs console-only) and run the minimum evidence-gathering steps.
argument-hint: tabHint=<URL or tab title> symptom=<one sentence> urlContains=<optional>
tools:
  - chrome-devtools/*
---

Goal: Quickly classify the issue and point to the best specialized prompt + the exact args to use.

Inputs:
- tabHint: ${input:tabHint}
- symptom: ${input:symptom}
- urlContains: ${input:urlContains}

Steps:
0) If chrome-devtools tools are not available, stop and say what’s missing.

1) list_pages → set_active_page(tabHint)
2) list_console_messages (actionable only)
3) list_network_requests (last 50) and summarize:
   - how many failures (>= 400)
   - whether any are Supabase (/rest/v1, /auth/v1, /storage/v1)
   - whether any are OPTIONS/preflight

Decision (pick ONE):
- If you see 401/403 to Supabase: recommend `rls-auth-failure.prompt.md` with `urlContains` set to the failing endpoint.
- If you see CORS/preflight errors: recommend `cors-cookies-session.prompt.md`.
- If “saved but UI stale/reverted”: recommend `ui-state-desync.prompt.md`.
- If page is slow without obvious failures: recommend `perf-slow-page.prompt.md`.
- If console is noisy and you just need signal: recommend `console-issues-only.prompt.md`.
- Otherwise: recommend `network-failure-triage.prompt.md`.

Return:
- Classification (1 sentence)
- Which prompt to run next + exact argument string
- One immediate sanity check for this repo: mention tenant key org_id and the health wedge (`scripts/dev-verify.sh`, `/api/health/*`) when relevant.
```
