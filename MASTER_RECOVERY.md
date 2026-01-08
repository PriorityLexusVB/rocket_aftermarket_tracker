# Master Recovery — Aftermarket Tracker

This is the quick, high-signal recovery guide for the common failure modes we’ve seen in this repo.

## 1) Vite Browser Crash: `process is not defined`

**Symptom**
- Browser console shows: `Uncaught ReferenceError: process is not defined` and the app spins/blank-screens.

**Root cause**
- A module executed in the browser referenced `process` or `process.env`. In Vite client bundles, Node globals like `process` do not exist.

**Smallest fix (code)**
- In any code path that can run in the browser (usually under `src/**`), do not access `process`.
- Use Vite-safe env access:
  - `import.meta.env.VITE_*` for variables
  - `import.meta.env.DEV` / `import.meta.env.MODE` for environment checks

**Allowed exception (Node-only paths)**
- If a file must read Node env vars and is truly server-only, use:
  - `globalThis.process?.env?.SOME_KEY`

**Verification**
- `pnpm dev` then hard refresh → no crash
- `pnpm test` → all pass

## 2) PostgREST Schema Cache Drift

**Symptom**
- “Could not find a relationship … in the schema cache”
- “column … does not exist” right after a migration

**Fix**
```sql
NOTIFY pgrst, 'reload schema';
```

## 3) Quick Checklist

- Env vars present (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- No client code references `process` / `process.env`
- Schema cache reloaded after relationship migrations
