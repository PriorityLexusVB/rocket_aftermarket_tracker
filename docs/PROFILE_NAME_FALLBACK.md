# User Profile Display Name Fallback and Capabilities

This app adapts to schema drift in `user_profiles` by selecting the best available name column at runtime and resolving a consistent display name for UI.

## Capability flags

- Stored in `sessionStorage` as strings: `"true" | "false"`
  - `cap_userProfilesName`
  - `cap_userProfilesFullName`
  - `cap_userProfilesDisplayName`
- Set by:
  - Client preflight at boot (`preflightCapabilities()`): fetches `/api/health-user-profiles`.
  - On-demand probe (`ensureUserProfileCapsLoaded()`): best-effort health fetch; falls back to defaults.
  - Error downgrade (`downgradeCapForErrorMessage()`): turns off a column when PostgREST reports missing column in error text.

## Select fragment builder

`buildUserProfileSelectFragment()` returns a PostgREST fragment for `user_profiles` that always includes `id` and `email`, plus the best column based on flags:

Priority order: `name` → `full_name` → `display_name` → only `email` when none available.

Examples:

- `(id, name, email)`
- `(id, full_name, email)`
- `(id, display_name, email)`
- `(id, email)`

## Display name resolver

`resolveUserProfileName(profile)` produces a friendly label with this cascade:

1. `profile.name`
2. `profile.full_name`
3. `profile.display_name`
4. `email` local-part (substring before `@`)

Returns `null` if no usable fields.

## Where it’s used

- Deal, Job, Vehicle, Kanban, Claims, Staff, Sales Tracker, Photo Docs services now import the fragment and resolver, ensuring consistent behavior and safety across the app.

## Diagnostics

- Serverless endpoint: `/api/health-user-profiles` returns `{ columns: { name, full_name, display_name, email } }`.
- Client flags reflect columns present; health probes run at boot and on demand.

## E2E coverage

`e2e/profile-name-fallback.spec.ts` verifies capability downgrades and SPA stability by seeding flags in sessionStorage before app code runs.

## Notes

- Flags are per-session; a hard refresh recalculates from the health endpoint.
- Services may still downgrade on a per-request error to avoid repeated failures.
