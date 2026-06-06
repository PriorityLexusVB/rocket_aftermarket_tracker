// Wave XXX-AA: KanbanCard — adapted from kanban-status-board/components/JobCard.jsx
// Fields sourced from getAllDeals (via sortedDeals), not getAllJobsForKanban.
// Defensive ?? fallbacks for all joined fields.
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import User from 'lucide-react/dist/esm/icons/user.js'
// Wave XXX-AB hotfix-4 fix #3 + clarity-auditor RECOMMENDED:
// Wrench icon for vehicle was semantically odd. Swapped to Car.
// GripVertical added as drag-handle affordance — Ashley can't discover
// drag without a visible cue.
import Car from 'lucide-react/dist/esm/icons/car.js'
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical.js'

// Priority dot colors
const PRIORITY_DOT = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
}

// Priority badge colors
const PRIORITY_BADGE = {
  low: 'bg-green-50 text-green-700 border border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  high: 'bg-orange-50 text-orange-700 border border-orange-200',
  urgent: 'bg-red-50 text-red-700 border border-red-200',
}

function formatScheduledDate(dateString) {
  if (!dateString) return null
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// KanbanCard — single deal card rendered inside a KanbanColumn
// Props:
//   deal        — deal object from sortedDeals (getAllDeals shape)
//   isDragging  — bool; true when this card's id === draggedDealId
//   onDragStart — (e) => void
//   onDragEnd   — (e) => void
//   onClick     — () => void  (opens DealDetailDrawer)
const KanbanCard = ({ deal, isDragging, onDragStart, onDragEnd, onClick }) => {
  // customer_name resolved by withCustomerFields in kanbanService (or dealService equivalent)
  // getAllDeals shape: customer_name, vehicle, job_number, job_parts, scheduled_start_time
  const customerName =
    deal?.customer_name ?? deal?.vehicle?.owner_name ?? null

  const vehicleLabel = deal?.vehicle
    ? [deal.vehicle.year, deal.vehicle.make, deal.vehicle.model]
        .filter(Boolean)
        .join(' ')
    : null

  const dealNumber = deal?.job_number ?? deal?.deal_number ?? null

  // Product count from job_parts
  const productCount =
    Array.isArray(deal?.job_parts) && deal.job_parts.length > 0
      ? deal.job_parts.length
      : null

  // Scheduled time — getAllDeals uses scheduled_start_time or appt_start
  const scheduledDate =
    formatScheduledDate(deal?.scheduled_start_time ?? deal?.appt_start ?? null)

  const priority = deal?.priority ?? 'medium'
  const dotColor = PRIORITY_DOT[priority] ?? PRIORITY_DOT.medium
  const badgeColor = PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.medium

  return (
    <motion.div
      layout
      layoutId={String(deal?.id)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className={[
        'group bg-white rounded-lg border border-slate-200 p-3 shadow-sm',
        'cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-shadow duration-150',
        // Wave XXX-AB hotfix-4 fix #5 (fun-checker REQUIRED):
        // Drag had no lift. Now: rotate-1 + shadow-xl + scale-1.03
        // signals "you're holding something" instead of "item disappeared".
        isDragging ? 'opacity-95 rotate-1 shadow-xl scale-[1.03] ring-2 ring-blue-300 z-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      title="Click to open · drag to move"
    >
      {/* Header row: priority dot + deal number + drag handle */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
          {dealNumber && (
            <span className="text-[11px] text-slate-400 font-mono truncate">RO #{dealNumber}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeColor}`}>
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </span>
          {/* Wave XXX-AB hotfix-4 fix #3 (sense-check + clarity-auditor REQUIRED):
              Visible drag-handle affordance so Ashley discovers drag without
              a hover-cursor change. */}
          <GripVertical
            className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors"
            aria-label="Drag to move"
          />
        </div>
      </div>

      {/* Customer name — primary field */}
      <p className="font-semibold text-slate-900 text-sm truncate leading-snug mb-1">
        {customerName ?? '—'}
      </p>

      {/* Vehicle stub — Car icon (was Wrench, semantically wrong) */}
      {vehicleLabel && (
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-1.5 min-w-0">
          <Car className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{vehicleLabel}</span>
        </div>
      )}

      {/* Chips row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {/* Product count chip */}
        {productCount !== null && (
          <span className="text-[11px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-medium">
            {productCount} item{productCount !== 1 ? 's' : ''}
          </span>
        )}

        {/* Scheduled time chip */}
        {scheduledDate && (
          <span className="text-[11px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            {scheduledDate}
          </span>
        )}

        {/* Assigned user chip */}
        {(deal?.assigned_user?.display_name ?? deal?.sales_consultant_name) && (
          <span className="text-[11px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 flex items-center gap-1 truncate max-w-[120px]">
            <User className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">
              {deal?.assigned_user?.display_name ??
                deal?.sales_consultant_name}
            </span>
          </span>
        )}
      </div>
    </motion.div>
  )
}

export default KanbanCard
