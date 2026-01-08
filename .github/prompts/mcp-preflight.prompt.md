---
name: mcp-preflight
agent: 'agent'
description: Confirm chrome-devtools MCP is connected and can see the correct app tab; screenshot + actionable console.
argument-hint: tabHint=<url-or-title>
tools:
  - 'chrome-devtools/*'
---

1. list_pages and print a numbered list: title | url.
2. If no tab matches ${input:tabHint}, STOP and tell me what to open (URL) and what prerequisite is missing (Chrome debug port, wrong profile, dev server not reachable).
3. set_active_page to the best match for ${input:tabHint}.
4. take_screenshot.
5. list_console_messages and summarize only actionable errors/warnings.
