// Wave XXX-AA: KanbanBoard — presentational kanban board for the Deals page.
// Extracted from kanban-status-board/index.jsx; adapted for getAllDeals shape.
// Owner: src/pages/deals/components/KanbanBoard.jsx
//
// Props:
//   deals            — deal[] from parent's sortedDeals (getAllDeals shape)
//   onOpenDetail     — (deal) => void — opens DealDetailDrawer
//   onReverseTrigger — (deal) => void — opens ReverseReasonModal in parent
//                     (do NOT call updateJobStatus for reversed here — parent's modal handles it)
import React, { useMemo, useState, useCallback } from 'react'
import { useToast } from '@/components/ui/ToastProvider'
import { kanbanService } from '@/services/kanbanService'
import { KANBAN_COLUMNS } from './kanban/kanbanColumns'
import KanbanColumn from './kanban/KanbanColumn'

// Memoize the grouping so it only recomputes when deals changes
function groupDealsByStatus(deals) {
  const grouped = {
    pending: [],
    scheduled: [],
    in_progress: [],
    completed: [],
    reversed: [],
  }
  for (const deal of deals ?? []) {
    const status = deal?.job_status
    if (Object.prototype.hasOwnProperty.call(grouped, status)) {
      grouped[status].push(deal)
    }
  }
  return grouped
}

// KanbanBoard — pure presentational + drag orchestration
// Does NOT own data loading. Receives sortedDeals from parent.
const KanbanBoard = ({ deals = [], onOpenDetail, onReverseTrigger }) => {
  const toast = useToast()
  const [draggedDealId, setDraggedDealId] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  // Memoized grouping: only recomputes when deals array reference changes
  const dealsByStatus = useMemo(() => groupDealsByStatus(deals), [deals])

  // handleStatusChange — the core routing logic.
  // Copied from kanban-status-board/index.jsx:215-249 validation pattern.
  // CRITICAL: reversed routes through onReverseTrigger (parent's modal + reverse_deal RPC).
  // DO NOT call updateJobStatus for reversed — enforce_reversal_audit trigger will reject it.
  const handleStatusChange = useCallback(
    async (deal, newStatus) => {
      if (!deal?.id) return false

      // Same-status drop → no-op
      if (deal.job_status === newStatus) return false

      // Reversed must go through parent ReverseReasonModal + reverse_deal RPC
      if (newStatus === 'reversed') {
        onReverseTrigger?.(deal)
        return false
      }

      // All other transitions: call kanbanService.updateJobStatus
      const { error } = await kanbanService.updateJobStatus(deal.id, newStatus)
      if (error) {
        // Wave XXX-AA hotfix-3 (browser-tester REQUIRED finding): surface
        // actual server error instead of swallowing with generic copy.
        // Browser-tester saw a silent snap-back when validate_vendor_job_scheduling
        // rejected a vendor-job drag-to-Scheduled without a start time. The
        // generic "Try again" message hid WHY the drop failed.
        const msg = error?.message || String(error)
        const lower = msg.toLowerCase()
        // Always log so dev console + production reports show the actual cause
        console.warn('[KanbanBoard] Drop rejected:', msg)
        // Wave XXX-AB hotfix-4 fix #4 (clarity-auditor BLOCKER):
        // "Status transition not allowed" was engineering jargon leaking
        // to a coordinator. Rewrote to plain English.
        if (msg.includes('Invalid status progression')) {
          toast?.error?.("Can't move this deal from here — some steps must happen in order.")
        } else if (lower.includes('vendor') && lower.includes('scheduled start time')) {
          toast?.error?.("Open the deal and add a start time before moving it to Scheduled.")
        } else if (lower.includes('start time') || lower.includes('scheduling')) {
          toast?.error?.("Set a start time first — open the deal and add scheduling.")
        } else {
          // Surface the actual server error so the user knows WHY it failed
          toast?.error?.(msg || "Couldn't update status. Try again.")
        }
        return false
      }

      return true
    },
    [onReverseTrigger, toast]
  )

  // Drag handlers
  // Wave XXX-AA hotfix-2 (Codex finding G): Firefox-defensive — some browsers
  // need dataTransfer.setData() called for native DnD to fire reliably.
  // Pass the deal id as the harmless drag payload.
  const handleDragStart = useCallback((e, deal) => {
    setDraggedDealId(deal?.id ?? null)
    try {
      e?.dataTransfer?.setData?.('text/plain', deal?.id ?? '')
      if (e?.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    } catch {
      /* swallow — some browsers throw on setData in synthetic events */
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedDealId(null)
    setDragOverColumn(null)
  }, [])

  const handleDragOver = useCallback((e, columnStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnStatus)
  }, [])

  // Wave XXX-AB hotfix-5 (Codex J): handleDragLeave was firing on every
  // child element crossing inside the column body, causing the highlight
  // to flicker as the cursor moved over cards inside the drop zone. Guard
  // by checking relatedTarget — only clear if leaving the column entirely.
  const handleDragLeave = useCallback((e) => {
    // relatedTarget is the element being entered; if it's null OR not
    // contained in the column, we're leaving the column for real.
    if (!e?.currentTarget?.contains?.(e?.relatedTarget)) {
      setDragOverColumn(null)
    }
  }, [])

  const handleDrop = useCallback(
    async (e, targetStatus) => {
      e.preventDefault()
      setDragOverColumn(null)

      if (!draggedDealId) return

      // Find the full deal object from any column
      const dragged = deals.find((d) => d?.id === draggedDealId)
      if (!dragged) return

      await handleStatusChange(dragged, targetStatus)
      setDraggedDealId(null)
    },
    [draggedDealId, deals, handleStatusChange]
  )

  return (
    // Wave XXX-AB hotfix-4 fix #6 (sense-check REQUIRED):
    // At 1366px (standard dealership laptop) 5 columns don't fit even with
    // narrower w-64 column width. Wrap in a relative container with a right-
    // edge gradient fade so the user knows there's more board to scroll to.
    <div className="relative">
      <div className="flex gap-3 px-4 pb-4 overflow-x-auto snap-x snap-mandatory lg:snap-none scroll-smooth">
        {KANBAN_COLUMNS.map((column) => (
          <div key={column.status} className="snap-start">
            <KanbanColumn
              column={column}
              deals={dealsByStatus[column.status] ?? []}
              draggedDealId={draggedDealId}
              isOver={dragOverColumn === column.status}
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
              onCardDragStart={handleDragStart}
              onCardDragEnd={handleDragEnd}
              onCardClick={onOpenDetail}
            />
          </div>
        ))}
      </div>
      {/* Wave XXX-AB hotfix-5 (Codex D): right-edge fade visible at ALL desktop
          widths (board overflows max-w-7xl at every width with 5 × w-64 columns
          + gaps). Narrower (w-8) + softer so it doesn't occlude column ring.
          Hidden only at 2xl (>1536px) where there's plenty of room. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-slate-50/95 to-transparent 2xl:hidden"
      />
    </div>
  )
}

export default KanbanBoard
