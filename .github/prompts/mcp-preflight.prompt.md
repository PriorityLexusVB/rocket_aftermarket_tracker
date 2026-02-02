---
name: mcp-preflight
agent: 'agent'
description: Preflight check that chrome-devtools MCP is connected and can see the correct tab; screenshot + actionable console.
argument-hint: tabHint=<url-or-title>
tools:
  - chrome-devtools/*
---

1. list_pages and print a numbered list: title | url.

2. If you do NOT see a tab matching: ${input:tabHint}, stop and tell me exactly what’s missing:

- chrome-devtools server not started
- Chrome not launched with --remote-debugging-port=9222
- wrong Chrome profile/window
- wrong browser-url/port

3. set_active_page to the best match for ${input:tabHint}.
4. take_screenshot
5. list_console_messages (actionable only)
6. list_network_requests (last 20) and show failures (>=400) if any.
