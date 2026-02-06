# Calendar Engine Spike Plan (No Rewrite)

## Goal

Explore a scheduler engine behind an adapter boundary without affecting production code paths.

## Non-Goals

- No dependency additions in this track.
- No production route changes.
- No replacement of existing calendar views.

## Adapter Boundary (Types Only)

Define a scheduler engine interface (types only) to describe the minimal integration surface:

```ts
// docs-only sketch (not compiled)
export type SchedulerEvent = {
  id: string
  title: string
  start: Date
  end?: Date | null
  resourceId?: string | null
  status?: string | null
}

export type SchedulerResource = {
  id: string
  label: string
  type?: 'vendor' | 'onsite'
}

export type SchedulerEngine = {
  render(container: HTMLElement, options: {
    events: SchedulerEvent[]
    resources?: SchedulerResource[]
    onMove?: (eventId: string, nextStart: Date, nextEnd?: Date | null) => void
    onResize?: (eventId: string, nextEnd: Date) => void
    onSelect?: (eventId: string) => void
  }): () => void
}
```

## Spike Harness Plan (Dev-Only)

1. Create a dev-only harness route (for example: `/dev/calendar-engine-spike`).
2. Gate it behind `import.meta.env.DEV` and a local-only flag.
3. Mock event/resource data from fixtures (no Supabase calls in components).
4. Measure basic interactions:
   - External drag from queue to calendar
   - Resize and move semantics
   - Resource lane density
   - Render performance for 200-500 events

## Success Criteria

- The engine can model resource lanes and external drag/drop with acceptable a11y and perf.
- The adapter boundary remains small and does not leak engine-specific concepts.

## Decision Output

If the spike meets success criteria, open a dedicated PR to add optional dependencies and the dev-only harness. Otherwise, continue with the current stack.
