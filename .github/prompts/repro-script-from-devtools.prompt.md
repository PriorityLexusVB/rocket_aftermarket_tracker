---
name: repro-script-from-devtools
agent: 'agent'
description: Convert a browser repro into a crisp bug report with evidence (network + console) and a suggested fix.
argument-hint: tabHint=<URL or tab title> actionSteps=<short repro steps>
---


Goal: Produce a high-signal bug report that a developer can fix quickly.

Inputs:
- tabHint: ${input:tabHint}
- actionSteps: ${input:actionSteps}

Steps:
1) Open the browser tab matching tabHint and open DevTools.
2) Take a screenshot.
3) Console: capture actionable messages only.
4) Network: scan the last ~100 requests.
5) Identify failures (status >= 400). For each failure, pull full request/response.
6) Identify the single most likely root cause and smallest fix.

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
