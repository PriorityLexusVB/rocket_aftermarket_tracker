// Wave XXX-AA: KanbanColumn — visual column for one status in the deal kanban board.
// Receives isOver so it can glow when a card is dragged over it.
import React from 'react'
import { AnimatePresence } from 'framer-motion'
import KanbanCard from './KanbanCard'

// KanbanColumn props:
//   column          — { status, title, borderColor } from kanbanColumns.js
//   deals           — deal[] for this column
//   draggedDealId   — id of the currently dragged deal (or null)
//   isOver          — bool; true when a drag is hovering this column
//   onDragOver      — (e) => void
//   onDragLeave     — () => void
//   onDrop          — (e) => void
//   onCardDragStart — (deal) => void
//   onCardDragEnd   — () => void
//   onCardClick     — (deal) => void
const KanbanColumn = ({
  column,
  deals = [],
  draggedDealId,
  isOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardDragEnd,
  onCardClick,
}) => {
  return (
    <div
      className={[
        // Wave XXX-AB hotfix-5 (Codex BLOCKER): hotfix-4's `lg:w-72 xl:w-80`
        // was math-wrong — Tailwind `xl` starts at 1280px so a 1366px laptop
        // hits xl:w-80 (320px). 5 × 320 + gaps = 1680px which OVERFLOWS the
        // parent's max-w-7xl (1280px) cap. Pin to w-64 (256px) at all
        // breakpoints; 5 × 256 = 1280px = exactly the cap, plus gap → minor
        // horizontal scroll on ALL desktop widths but at least consistent.
        'flex flex-col w-64 flex-shrink-0 bg-slate-50 rounded-lg',
        'border-l-4',
        column.borderColor,
        'transition-all duration-150',
        // Wave XXX-AB hotfix-4 fix #5 (fun-checker REQUIRED):
        // Drop-target column glow stronger + subtle scale for "I will catch this"
        isOver ? 'ring-2 ring-blue-500 ring-offset-1 shadow-lg scale-[1.005]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Column header */}
      <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-600">
          {column.title}
        </span>
        <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
          {deals.length}
        </span>
      </div>

      {/* Column body — drop target */}
      <div
        className={[
          'flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]',
          'transition-colors duration-150',
          isOver ? 'bg-blue-50/50' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <AnimatePresence>
          {deals.map((deal) => (
            <KanbanCard
              key={deal.id}
              deal={deal}
              isDragging={deal.id === draggedDealId}
              onDragStart={(e) => {
                // Wave XXX-AA hotfix-2 (Codex finding G): Firefox-defensive setData
                // moved into KanbanBoard.handleDragStart — pass event through.
                onCardDragStart?.(e, deal)
              }}
              onDragEnd={onCardDragEnd}
              onClick={() => onCardClick?.(deal)}
            />
          ))}
        </AnimatePresence>

        {/* Empty state — Wave XXX-AB hotfix-4 (fun-checker RECOMMENDED):
            per-column voice instead of generic "No deals" */}
        {deals.length === 0 && !draggedDealId && (
          <div className="flex items-center justify-center h-20 text-xs text-slate-400 italic">
            {column.emptyHint ?? 'No deals'}
          </div>
        )}

        {/* Drop hint when dragging over this column */}
        {isOver && draggedDealId && (
          <div className="border-2 border-dashed border-blue-400 rounded-lg py-3 text-center text-[11px] text-blue-500 bg-blue-50/80">
            Drop to move here
          </div>
        )}
      </div>
    </div>
  )
}

export default KanbanColumn
