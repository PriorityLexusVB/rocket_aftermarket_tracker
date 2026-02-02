---
name: debug-router
agent: 'agent'
description: Choose the right debug prompt for the problem (network vs RLS/auth vs CORS vs UI desync vs perf vs console-only) and run the minimum evidence-gathering steps.
argument-hint: tabHint=<URL or tab title> symptom=<one sentence> urlContains=<optional>
---

Goal: Quickly classify the issue and point to the best specialized prompt + the exact args to use.

Inputs:

- tabHint: ${input:tabHint}
- symptom: ${input:symptom}
- urlContains: ${input:urlContains}

Steps:
1) Open the browser tab matching tabHint and open DevTools.
2) Console: scan for actionable errors/warnings.
3) Network: scan the last ~50 requests and summarize:
   - how many failures (>= 400)
   - whether any are Supabase (/rest/v1, /auth/v1, /storage/v1)
   - whether any are OPTIONS/preflight

Decision (pick ONE):

- If you see 401/403 to Supabase: recommend `/rls-auth-failure` with `urlContains` set to the failing endpoint.
- If you see CORS/preflight errors: recommend `/cors-cookies-session`.
- If “saved but UI stale/reverted”: recommend `/ui-state-desync`.
- If page is slow without obvious failures: recommend `/perf-slow-page`.
- If console is noisy and you just need signal: recommend `/console-issues-only`.
- If you already know the endpoint: recommend `/why-request-failed` with `urlContains`.
- Otherwise: recommend `/network-failure-triage`.

Return:

- Classification (1 sentence)
- Which prompt to run next + exact argument string
