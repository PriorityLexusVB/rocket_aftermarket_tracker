---
name: mcp-preflight
agent: 'agent'
description: Preflight checklist to capture DevTools evidence for the correct tab; screenshot + actionable console.
argument-hint: tabHint=<url-or-title>
---

Goal: Capture the minimum high-signal evidence from browser DevTools.

Inputs:
- tabHint: ${input:tabHint}

Steps:
1) Open the browser tab matching tabHint.
2) Open DevTools.
3) Take a screenshot of the current UI state.
4) Console: capture only actionable errors/warnings (ignore noise).
5) Network: look at the last ~20 requests and note any failures (status >= 400), especially Supabase endpoints.

Return:
- Tab identified (title + URL)
- Screenshot captured (yes/no)
- Console: actionable items
- Network: failing request summary (method, status, URL)
