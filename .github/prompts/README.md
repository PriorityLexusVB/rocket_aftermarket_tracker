# Debug Prompts (Rocket Aftermarket Tracker)

Start here:

- `debug-router` → triages the symptom and tells you which prompt to run next.

## Quick map

- **RLS/auth failures (401/403/400 to Supabase)**
  - Use: `rls-auth-failure`
  - When: `/rest/v1/*` calls failing, “permission denied”, missing/incorrect tenant scope.
  - Repo fact: tenant key is `org_id`.

- **Single failing request, unknown cause**
  - Use: `network-failure-triage`
  - When: UI is broken/blank/spinning and you want the one request that matters.

- **CORS / preflight / session header missing**
  - Use: `cors-cookies-session`
  - When: console shows CORS errors, OPTIONS failures, blocked requests.

- **Saved but UI stale/reverted**
  - Use: `ui-state-desync`
  - When: save returns 200/201 but list/detail view doesn’t reflect it.

- **Slow page**
  - Use: `perf-slow-page`
  - When: page is sluggish without obvious errors.

- **Console-only cleanup**
  - Use: `console-issues-only`
  - When: you need actionable errors/warnings without noise.

- **Turn repro into bug report**
  - Use: `repro-script-from-devtools`
  - When: you want crisp steps + evidence (console + network) + suggested fix.

## Fast sanity checks (Health wedge)

If you suspect env/config/schema cache issues rather than pure UI state:

- Run `scripts/dev-verify.sh`
- Hit `/api/health/*` endpoints
