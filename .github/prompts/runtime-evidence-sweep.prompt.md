---
name: runtime-evidence-sweep
agent: 'agent'
description: Evidence-first runtime sweep using ONLY Chrome DevTools MCP (tab select → screenshot → console → network → responsive screenshots).
argument-hint: tabHint=<url-or-title>
tools:
  - 'chrome-devtools/*'
---

Use ONLY chrome-devtools MCP.

Hard rules:

- Do NOT use Playwright.
- Do NOT use any non-chrome browser MCP tools (including any `mcp_microsoft_pla_*` / Microsoft browser tools).
- Console + network evidence must come from chrome-devtools MCP only.

0. Preconditions:

- If chrome-devtools tools are unavailable, STOP and tell me exactly what to start (LocalProcess chrome-devtools MCP + Chrome debug on 9223).
- If the app tab is not reachable/visible, STOP and tell me the exact URL to open in the ChromeMCP window.

1. Select tab:

- list_pages
- set_active_page to the best match for ${input:tabHint}

2. Baseline proof:

- take_screenshot
- list_console_messages (actionable only)
- Explicitly confirm whether “process is not defined” exists. If yes, STOP and summarize top 3 errors.

3. Network sweep:

- list_network_requests for the last 80 requests
- Output a compact table: status | method | url(trim)
- For the top 1–3 failures (>=400), pull full details:
  - request headers + request body
  - response status + response headers + response body

4. Responsive screenshots (label them clearly):

- Desktop: resize_page width=1440 height=900 → take_screenshot
- iPad: resize_page width=1024 height=768 → take_screenshot
- Mobile: resize_page width=390 height=844 → take_screenshot

5. Output format:

- Console: PASS/FAIL (with key lines if FAIL)
- Network: PASS/FAIL (with failing request summaries)
- Screenshots: captured (desktop/iPad/mobile)
- Next action: smallest fix + proof step (only if FAIL)
