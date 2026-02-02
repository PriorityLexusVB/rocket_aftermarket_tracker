# Prompt Index (Rocket Aftermarket Tracker)

Type `/` in Copilot Chat to run any prompt. Most prompts take `tabHint=<url-or-title>`.

## Start here
- **mcp-preflight** — preflight DevTools evidence capture (tab match, screenshot, console, recent network failures)
- **debug-router** — classify the issue and tell you which prompt to run next

## Network / API
- **network-failure-triage** — pick the *single* most consequential failure (>=400), pull full request/response
- **why-request-failed** — deep dive one endpoint quickly (urlContains=...)

## Auth / RLS
- **rls-auth-failure** — 401/403/400 against Supabase; focuses on org_id tenant scoping + session/JWT evidence

## CORS / cookies / session
- **cors-cookies-session**

## UI / state
- **ui-state-desync**

## Console / perf
- **console-issues-only**
- **perf-slow-page**

## Repo Doctor (code changes)
- **fix-dropdowns-auto** — guided repo changes with guardrails (touch ≤10 files)
