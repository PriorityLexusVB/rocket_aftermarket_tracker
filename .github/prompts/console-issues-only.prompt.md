---
name: console-issues-only
agent: 'agent'
description: Pull only actionable console issues (ignore noise) and propose smallest fixes.
argument-hint: tabHint=<URL or tab title>
---


Goal: Extract only the console output that matters and map each to a minimal fix.

Inputs:
- tabHint: ${input:tabHint}

Steps:
1) Open the browser tab matching tabHint and open DevTools.
2) Console: capture the relevant error/warning output.
3) Group into:
   - Errors (must fix)
   - Warnings (likely fix)
   - Ignorable noise (explain why it’s ignorable)
4) For each error/warning, provide:
   - The most likely source area (auth/session, RLS/org_id scoping, rendering/state, network)
   - The smallest fix (exact change)
   - One proof step

Return:
- Grouped console summary
- Smallest fixes + proof steps
