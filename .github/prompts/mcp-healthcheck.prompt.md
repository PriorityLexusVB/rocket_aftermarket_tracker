---
name: mcp-healthcheck
agent: 'agent'
description: Quick PASS/FAIL for MCP servers (Chrome DevTools, Supabase, GitHub).
argument-hint: tabHint=<url-or-title>
tools:
  - 'chrome-devtools/*'
  - 'supabase/*'
  - 'github/github-mcp-server/*'
---

Goal: produce a deterministic PASS/FAIL healthcheck across this repo’s MCP servers.

Rules:

- Evidence-first: every PASS must include at least one successful tool call result.
- If something fails, report FAIL with the observed error + the smallest remediation.
- Don’t guess; don’t propose code changes until evidence is collected.

A) chrome-devtools (runtime evidence)

- list_pages
- set_active_page (best match for ${input:tabHint})
- take_screenshot
- list_console_messages (summarize actionable only)
- list_network_requests (last 60–80)
- For top 1–3 failures (>= 400): pull full request/response (headers + body + response body)

PASS criteria: can list pages, select the app tab, screenshot, and enumerate console + network.

B) supabase (read-only proof)

- List schemas/tables/policies/extensions (any one read-only operation that proves auth)

PASS criteria: can perform a read-only MCP operation successfully.

C) github (read-only proof)

- Verify identity/auth with a basic call
- Run one small repo query (list branches or search for "AGENTS.md")

PASS criteria: can read repo metadata and complete one query.

Output format:

Server | PASS/FAIL | Evidence (tool call + key snippet) | Smallest fix steps
