# Rocket Aftermarket Tracker — Design Rules

Single source of truth for visual consistency. Read this before adding new
pages or refactoring existing ones.

## The 3 token systems (use ONE, don't mix)

We have three token systems in the codebase that all resolve to the same RGB
in light mode. Pick ONE per surface and don't mix:

| Token | Resolves to | Use for |
|---|---|---|
| `bg-card` / `text-foreground` / `border-border` | white / slate-900 / slate-200 | Semantic (preferred for new code) |
| `bg-white` / `text-slate-900` / `border-slate-200` | white / slate-900 / slate-200 | Hard slate (legacy, used by Claims) |
| `bg-lex-brand` / `text-lex-ink-inv` | #0E1418 / #F8FAFC | Navbar/masthead ONLY |

Pages currently on each system:
- Semantic: /admin, /how-it-works
- Hard slate: /claims, /deals, /guest-claims, /kanban
- Lex brand: navbar/masthead/hero strips

## Page header pattern

```jsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
  <div>
    <h1 className="text-2xl md:text-3xl font-bold text-foreground">Page Title</h1>
    <p className="text-sm text-muted-foreground mt-1">Subtitle.</p>
  </div>
  {/* Optional actions */}
</div>
```

Always `text-2xl md:text-3xl` for h1. ALWAYS `md:` breakpoint (768px), not `sm:`.

## Tab pill group pattern

```jsx
<div className="overflow-x-auto">
  <div role="tablist" aria-label="Section name" className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 min-w-max">
    {tabs.map((tab) => (
      <button
        role="tab"
        aria-selected={active}
        aria-controls={`panel-${tab.id}`}
        id={`tab-${tab.id}`}
        className={`whitespace-nowrap inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          active ? 'bg-slate-900 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
</div>
```

NEVER use underline tabs. NEVER use `aria-pressed` for tabs (use `role="tab"` + `aria-selected`).
NEVER use `inline-flex flex-wrap` for tabs — use horizontal scroll (`overflow-x-auto` + `min-w-max`) so tabs always stay on one row.

## Card pattern

```jsx
className="bg-card rounded-lg shadow-sm border border-border p-5 sm:p-6"
```

- Radius: `rounded-lg` (8px) standard. `rounded-xl` (12px) for hero/feature cards. NEVER `rounded-2xl` or `rounded-0`.
- Shadow: `shadow-sm` standard. `shadow-md` on hover. `shadow-lg` for modals only.
- Border: always `border border-border` to keep edges defined.

## Button hierarchy

```jsx
// PRIMARY CTA — main action
className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md px-4 py-2 transition-colors"

// DESTRUCTIVE — delete / reverse
className="bg-white border border-red-300 text-red-700 hover:bg-red-50 text-sm font-medium rounded-md px-4 py-2 transition-colors"

// COMPLETE / RESOLVE — terminal success action
className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md px-4 py-2 transition-colors"

// GHOST / CANCEL
className="bg-white border border-border text-foreground hover:bg-muted text-sm font-medium rounded-md px-4 py-2 transition-colors"
```

NEVER use `bg-slate-900` for a primary action (only for tab-active state and dark hero bands).
NEVER use `bg-green-600` (use `bg-emerald-600`).

## Responsive breakpoints

- 375px: must work without horizontal overflow
- 640px (`sm:`): layout column-to-row transitions
- 768px (`md:`): h1 grows to `text-3xl` here, NOT before
- 1024px (`lg:`): standard desktop
- 1366px+: tab nav stays single-row

## What NOT to do

- Don't use 2+ token systems on the same page
- Don't use `pt-20`/`pt-24` on page wrappers — AppLayout already handles fixed-nav offset
- Don't render `<Link>` without `inline-flex items-center justify-center` inside an actions row with `<button>` siblings (baseline mismatch)
- Don't use `rounded-2xl`/`rounded-3xl` outside of hero/feature surfaces
- Don't use generic `<a>` color tokens like `blue-100` on a white card (creates non-coherent tints)
- Don't use `flex-wrap` on a tab row — use `overflow-x-auto` scroll instead
