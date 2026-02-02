---
name: repro-script-from-devtools
agent: 'agent'
description: Convert a browser repro into a crisp bug report with evidence (network + console) and a suggested fix.
argument-hint: tabHint=<URL or tab title> actionSteps=<short repro steps>
tools:
  - chrome-devtools/*
---

Goal: Produce a high-signal bug report that a developer can fix quickly.

Inputs:

- tabHint: ${input:tabHint}
- actionSteps: ${input:actionSteps}

Steps: 0) If chrome-devtools tools are not available, stop and say what’s missing.

1. list_pages → set_active_page(tabHint)
2. take_screenshot
3. list_console_messages (actionable only)
4. list_network_requests (last 100)
5. Identify failures (status >= 400). For each failure, pull full request/response.
6. Identify the single most likely root cause and smallest fix.

Output a bug report:

- Title
- Environment (URL, approximate time, whether logged in, which org_id / tenant context if known)
- Steps to reproduce (from actionSteps)
- Expected vs actual
- Evidence
  - Console: short excerpt
  - Network: failing request summaries + full response bodies when meaningful
- Suspected root cause
- Suggested fix (smallest possible)
- Proof step
