---
name: console-issues-only
agent: 'agent'
description: Pull only actionable console issues (ignore noise) and propose smallest fixes.
argument-hint: tabHint=<URL or tab title>
tools:
  - chrome-devtools/*
---

Goal: Extract only the console output that matters and map each to a minimal fix.

Inputs:

- tabHint: ${input:tabHint}

Steps: 0) If chrome-devtools tools are not available, stop and say what’s missing.

1. list_pages → set_active_page(tabHint)
2. list_console_messages
3. Group into:
   - Errors (must fix)
   - Warnings (likely fix)
   - Ignorable noise (explain why it’s ignorable)
4. For each error/warning, provide:
   - The most likely source area (auth/session, RLS/org_id scoping, rendering/state, network)
   - The smallest fix (exact change)
   - One proof step

Return:

- Grouped console summary
- Smallest fixes + proof steps
