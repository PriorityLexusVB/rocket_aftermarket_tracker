---
name: why-request-failed
agent: 'agent'
description: Explain one failing request with full request/response evidence and the smallest fix.
argument-hint: tabHint=<url-or-title> urlContains=<partial-url> status=<optional>
tools:
  - chrome-devtools/*
---

Goal: explain the failing request (what happened, why, and what to change) with the smallest possible fix.

0. If chrome-devtools tools are not available, stop and say what’s missing.

1. list_pages → set_active_page matching ${input:tabHint}
2. list_network_requests (last 60)
3. Find the request where:
   - URL contains ${input:urlContains}
   - OR status matches ${input:status} (if provided)
4. Pull full request + response:
   - method, full URL + query
   - request headers
   - request body
   - response status + headers
   - response body
5. Explain root cause in 2–4 bullets.
6. Provide the smallest fix and exactly where it goes (frontend vs backend).
7. Provide a single proof step (what to retry + expected success).
