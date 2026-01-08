---
name: why-request-failed
agent: 'agent'
description: Locate a failing request and explain it with full request/response details (Chrome DevTools MCP only).
argument-hint: tabHint=<url-or-title> urlContains=<partial-url-or-endpoint> status=<optional>
tools:
  - 'chrome-devtools/*'
---

1. set_active_page matching ${input:tabHint}.
2. list_network_requests for the last 80.
3. Find the request whose URL contains ${input:urlContains} (or status matches ${input:status}).
4. Pull full request/response details: method/url/query, request headers, request body, response status/headers, response body.
5. Output: root cause (bullets) + smallest fix + proof step.
