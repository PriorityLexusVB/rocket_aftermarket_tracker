---
mode: agent
---

You are my Repo Doctor. Apply fixes automatically under the workspace Instructions.

Tasks (auto-apply):
1) Create components/Select.jsx (controlled <select> wrapper).
2) Create hooks/useDealForm.js (local draft state) and hooks/useAutosave.js (600ms debounce).
3) Update DealForm.jsx + any inline editors to use value+onChange (no defaultValue). Replace uncontrolled <select>.
4) Add/modify dealService.updateDeal to enforce optimistic concurrency (version/updatedAt). If update count = 0, surface 409 to UI.
5) Ensure orgId filters exist on all queries and write paths touched.

Constraints:
- Follow workspace Instructions verbatim (Vite + React + Supabase).
- Touch ≤ 10 files. Minimal diffs. No styling rewrites.
- Before edits: create branch fix/dropdowns-guarded; run pnpm run build.
- After edits: run pnpm run build. If failing, revert last change and try a smaller diff.

Deliverables (after applying):
- Summary of files edited/created.
- Commands to run: pnpm run dev
- Manual test checklist:
  (a) Change dropdown → persists after re-render/reload
  (b) Rapid double edits → newer wins (no silent revert)
  (c) Toggle Loaner + set Loaner # → persists
  (d) Switch org → data scoped correctly
