---
name: network-failure-triage
agent: 'agent'
description: Find the single most consequential failing network request and explain it with full payloads (Rocket Aftermarket Tracker).
argument-hint: tabHint=<URL or tab title>
---


Goal: Identify the highest-impact failing request and give the smallest fix + retest step.

Inputs:
- tabHint: ${input:tabHint}

Steps:
1) Open the browser tab matching tabHint and open DevTools.
2) Network tab: look at the last ~80 requests.
3) Build a compact failure table (status >= 400):
   status | method | url (trim) | type/initiator (if available)
4) Pick ONE failure that is most consequential:
   - blocks the UI (spinner/blank state)
   - is repeated
   - is most recent during the repro
5) Pull full request+response details from DevTools:
   - method + full URL + query
   - request headers
   - request body
   - response headers
   - response body
6) Classify and fix minimally:
   - If 401/403 and Supabase: route to RLS/auth cause; likely missing org_id tenant scope.
   - If 404: wrong route/path or dev proxy mismatch.
   - If 400: payload/query shape mismatch.
   - If 500: server bug; identify the likely crashing handler and the smallest code fix.
7) Provide one proof step: what to retry and what success looks like.

Return:
- Failure table (compact)
- Chosen failure (why this one)
- Root cause + smallest fix
- Proof step
