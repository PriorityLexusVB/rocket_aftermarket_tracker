AFTERMARKET TRACKER — WORKSPACE INSTRUCTIONS (Vite + React + Supabase)

Goal: fix dropdowns losing values and stop data overwrites WITHOUT changing stack or design.

Stack (LOCKED)
- React 18 + Vite + TailwindCSS + Supabase. Recharts present; Framer Motion optional.
- Routing via App.jsx/Routes.jsx. SPA deploy with Vercel rewrites (keep vercel.json as-is).
- CSS: keep all @imports at the TOP of tailwind.css (Vite ordering).

Data rules (LOCKED)
- Never import Supabase in components for DB I/O. Health pings (e.g., testSupabaseConnection) are OK.
- All reads/writes must include org/tenant scope (tenantService / orgId).
- Optimistic concurrency: include version (or updatedAt) in writes; return 409 on conflict.

UI rules (LOCKED)
- All inputs are controlled (no defaultValue). Use a shared Select component.
- Local draft state via hooks/useDealForm; debounced autosave via hooks/useAutosave(600ms).
- Keep existing dropdownService TTL cache (5m) and prefetch in App.jsx.

Safety
- New branch: fix/dropdowns-guarded. Touch ≤ 10 files. Minimal diffs. No styling changes.
- Run: pnpm run build before/after edits. If failing, revert the last change.
- Do not change package.json deps or env keys. If absolutely required, STOP and output TODO.
- Stage changes; do not push.
