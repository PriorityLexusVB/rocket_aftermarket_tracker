---
name: full-debug-sweep
agent: agent
description: End-to-end browser debug sweep using Chrome DevTools MCP (network + console + issues + failing request details).
argument-hint: tabHint=<URL or tab title>
tools:
  - chrome-devtools/*
---

Use chrome-devtools MCP.

0) If chrome-devtools tools are not available, stop and tell me exactly what is missing (server not started, Chrome remote debugging not running, wrong port, etc.).

1) list_pages and identify the page that matches this app/tab: ${input:tabHint}.
2) set_active_page to that page.

3) list_console_messages (include Issues/warnings if available). Summarize only actionable errors. Ignore noise.

4) list_network_requests for the last 50 requests. Return a compact table:
method | status | url (trim) | type.

5) For the most recent 1–3 failed requests (status >= 400), pull full details:
- method + full URL + query
- request headers
- request body
- response status + headers
- response body

6) Identify the single most likely root cause and the smallest fix:
- If auth/session: name the missing/mismatched header/cookie/token and where it should come from.
- If API mismatch: name the exact payload fields/shape that caused rejection.
- If CORS: quote the specific issue and which origin/header is blocked.

7) Give me one “prove it” step (what to click / what to retry) after the fix.
