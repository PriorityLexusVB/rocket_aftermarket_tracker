# Design Toolkit: Calendar (design.dev mapping)

This document maps common calendar UI tasks to lightweight design tools. Use these before merging calendar UI changes.

## Tools + How-To

### Grid Area Mapper (3-pane layout)

- Use for: shell layout (board/calendar/list + queue + drawer)
- Steps:
  1. Sketch the 3-pane layout with named regions: header, main, queue, drawer.
  2. Validate responsive collapse (single column on small screens).
  3. Confirm sticky header and scroll containers align.

Suggested tools: design.dev grid mappers or CSS grid visualizers.

### Z-Index Visualizer (popovers/sticky headers)

- Use for: popovers, sticky headers, drawer layering
- Steps:
  1. Capture a screenshot of the calendar view.
  2. Use a z-index visualizer to verify popovers render above sticky headers.
  3. Confirm drawer overlays do not obscure critical controls.

Suggested tools: design.dev z-index visualizer or browser extensions.

### Contrast Checker / OKLCH Converter

- Use for: status badges, legend chips, overdue states
- Steps:
  1. Run badge colors through a contrast checker (WCAG AA for text).
  2. Normalize color ramps in OKLCH for consistent perception.
  3. Record any adjustments in docs/design-tokens/calendar-tokens.md.

Suggested tools: design.dev contrast checker, OKLCH converter.

### CSS Loader Library

- Use for: loading states that convey progress without distraction
- Steps:
  1. Choose a subtle loader (no constant motion in steady state).
  2. Verify prefers-reduced-motion support.
  3. Keep loader durations <= 600ms for micro-feedback.

Suggested tools: design.dev CSS loader catalog.

### Tokens Guide

- Use for: consistent calendar colors and status semantics
- Steps:
  1. Map calendar statuses to semantic tokens.
  2. Update docs/design-tokens/calendar-tokens.md (no global theme changes).
  3. Adopt tokens gradually in UI components.

Suggested tools: design.dev tokens guide.

## UI QA Checklist (Calendar)

- Overlays: popovers appear above sticky headers and list controls.
- Z-index: drawer overlays do not hide the primary CTA.
- Contrast: status chips and legend labels meet WCAG AA.
- Motion: all transitions honor prefers-reduced-motion.
- Density: text truncation does not hide critical identifiers.
- Navigation: keyboard focus order is consistent in header and list.

## Notes

- This repo uses Tailwind and a custom calendar scheduler; keep tokens and tooling lightweight.
- No Supabase calls in React components.
