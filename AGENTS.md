# AGENTS.md — APP CREATION

These instructions apply to all agents working in this repo.

## Operating mode (never skip)
1) Read-only audit first: identify drift, risks, and quick wins.
2) Plan: list files to touch + exact verification commands.
3) Implement smallest diff possible (PR-sized).
4) Verify after every change; stop and fix if any command fails.

## Non-breaking rules
- Do not rename public APIs/routes without compatibility.
- Do not change database/RLS behavior without explicitly listing impacts.
- Prefer additive migrations; avoid destructive schema changes.

## Verification defaults (use repo scripts if they exist)
- pnpm install
- pnpm lint (if present)
- pnpm test (if present)
- pnpm run typecheck (if present)
- pnpm build (if present)

---

# Aftermarket Tracker — Runtime Debug Policy (DevTools MCP)

When a user message indicates a runtime/browser issue, you MUST use browser evidence before proposing code changes.

Trigger words (any): error, failed, 4xx/5xx, 401, 403, 409, CORS, cookie, blank screen, UI overlap, stale list, didn't save, console, network, request.

## Evidence-first workflow (MANDATORY)
1) If chrome-devtools tools are available:
   - list_pages → set_active_page (pick the app tab)
   - take_screenshot
   - list_console_messages (summarize actionable only)
   - list_network_requests (last 60–80)
   - For top 1–3 failures (>= 400): pull full request/response (headers + body + response body)
2) Decide lane and smallest fix:
   - Network/API mismatch → exact payload/headers to change
   - Auth/RLS → exact token/cookie/claim mismatch
   - UI/state desync → correlate mutation vs refresh/list call (cache/optimistic update)
   - CORS/cookies → preflight/cookie attributes and required headers
3) Output format (always):
   - Root cause (bullets)
   - Smallest fix (exact file + minimal diff)
   - Proof step (how to retest)

## Security
DevTools remote debugging exposes full control of the attached browser instance.

- Do **not** attach DevTools / MCP to production browsers or profiles that handle real users or sensitive data.
- Use a dedicated, non-sensitive Chrome profile for debugging (no saved passwords, tokens, banking, email, or admin sessions).
- Assume all network activity from that profile (requests, headers, bodies, responses, cookies) is visible via the MCP interface and may be logged by tooling.
- Never reuse an existing personal or production profile for debugging; create a fresh profile and delete it when you are done.
- If an issue involves sensitive data, reproduce it in a sanitized test environment with scrubbed fixtures instead of real user data.
