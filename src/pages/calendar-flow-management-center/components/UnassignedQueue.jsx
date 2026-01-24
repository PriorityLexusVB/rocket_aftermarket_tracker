import React from 'react'
import { Car, Clock, Calendar, AlertTriangle, Package, CheckCircle, RefreshCw } from 'lucide-react'
import { formatTime, isOverdue, getStatusBadge } from '../../../lib/time'
import { formatEtDateLabel } from '@/utils/scheduleDisplay'

function summarizeOpCodesFromParts(parts, max = 5) {
  const list = Array.isArray(parts) ? parts : []
  const byCode = new Map()

  for (const p of list) {
    const code = String(p?.product?.op_code || p?.product?.opCode || '')
      .trim()
      .toUpperCase()
    if (!code) continue

    const qtyRaw = p?.quantity_used ?? p?.quantity ?? 1
    const qtyNum = Number(qtyRaw)
    const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1

    const existing = byCode.get(code)
    if (!existing) byCode.set(code, qty)
    else byCode.set(code, existing + qty)
  }

  const tokens = Array.from(byCode.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, qty]) => (qty > 1 ? `${code}×${qty}` : code))

  const clipped = tokens.slice(0, max)
  return { tokens: clipped, extraCount: Math.max(0, tokens.length - clipped.length) }
}

const UnassignedQueue = ({ jobs, onJobClick, onDragStart, loading, onComplete, onReopen }) => {
  const renderUnassignedJob = (job) => {
    const promise = job?.next_promised_iso || job?.promised_date || job?.promisedAt || null
    const overdue = isOverdue(promise)
    const rawStatus = String(job?.job_status || '').toLowerCase()
    const hasTimeWindow = !!job?.scheduled_start_time
    const statusForBadge =
      !hasTimeWindow &&
      promise &&
      (rawStatus === 'pending' || rawStatus === 'new' || rawStatus === '')
        ? 'scheduled'
        : rawStatus
    const statusBadge = getStatusBadge(statusForBadge)
    const vehicle = job?.vehicle || job?.vehicles || null
    const stock = vehicle?.stock_number || job?.stock_no || job?.stockNumber || ''
    const customer = job?.customer_name || job?.customerName || vehicle?.owner_name || ''
    const ops = summarizeOpCodesFromParts(job?.job_parts, 6)
    const isCompleted = String(job?.job_status || '').toLowerCase() === 'completed'

    return (
      <div
        key={job?.id}
        className="bg-white rounded-lg border border-gray-200 p-3 mb-2 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300"
        onClick={() => onJobClick?.(job)}
        draggable
        onDragStart={() => onDragStart?.(job)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Car className="h-4 w-4 text-gray-600 mr-2" />
            <span className="font-medium text-gray-900">{job?.job_number?.split('-')?.pop()}</span>
            {overdue && <AlertTriangle className="h-4 w-4 text-red-500 ml-2" />}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e?.stopPropagation?.()
                if (isCompleted) onReopen?.(job)
                else onComplete?.(job)
              }}
              className={
                isCompleted
                  ? 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }
              aria-label={isCompleted ? 'Reopen' : 'Complete'}
              title={isCompleted ? 'Reopen deal' : 'Mark completed'}
            >
              {isCompleted ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
            </button>

            <div
              className={`
            px-2 py-1 rounded-full text-xs font-medium
            ${statusBadge?.bg || 'bg-gray-100'} 
            ${statusBadge?.textColor || 'text-gray-800'}
          `}
            >
              {statusBadge?.label ||
                statusForBadge?.toUpperCase?.() ||
                job?.job_status?.toUpperCase?.()}
            </div>
          </div>
        </div>

        {/* Job Title */}
        <div className="text-sm font-medium text-gray-900 mb-1 flex items-center">
          <Package className="h-3 w-3 text-gray-500 mr-1" />
          <span className="truncate">{job?.title || job?.job_number || '—'}</span>
        </div>

        <div className="text-xs text-gray-600 mb-2 truncate">
          {[customer, job?.vehicle_info, stock ? `Stock ${stock}` : null]
            .filter(Boolean)

            .filter(Boolean)
            .join(' • ')}
        </div>

        {ops.tokens.length ? (
          <div className="mb-2 flex flex-wrap items-center gap-1" aria-label="Products">
            {ops.tokens.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                title={t}
              >
                {t}
              </span>
            ))}
            {ops.extraCount ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                +{ops.extraCount}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Time and Promise Info */}
        <div className="space-y-1">
          {job?.scheduled_start_time && (
            <div className="flex items-center text-xs text-gray-600">
              <Clock className="h-3 w-3 mr-1" />
              {formatTime(job?.scheduled_start_time)}–{formatTime(job?.scheduled_end_time)}
            </div>
          )}

          <div
            className={`flex items-center text-xs ${overdue ? 'text-red-600' : 'text-gray-600'}`}
          >
            <Calendar className="h-3 w-3 mr-1" />
            Promise: {formatEtDateLabel(promise) || '—'}
            {overdue && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                Overdue
              </span>
            )}
          </div>

          {/* Estimated Hours */}
          {job?.estimated_hours && (
            <div className="flex items-center text-xs text-gray-600">
              <Clock className="h-3 w-3 mr-1" />
              {job?.estimated_hours}h estimated
            </div>
          )}
        </div>

        {/* Drag Indicator */}
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500 text-center">
            Drag to a time slot or vendor lane
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-gray-900">All-day</h2>
          <div className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full font-medium">
            {jobs?.length || 0}
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Promised date is set; drag onto the calendar to assign a time/vendor.
        </p>
      </div>

      {/* Job List */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          </div>
        ) : jobs?.length > 0 ? (
          <div className="space-y-3">{jobs?.map(renderUnassignedJob)}</div>
        ) : (
          <div className="text-center py-8">
            <Car className="h-8 w-8 text-gray-400 mx-auto mb-3" />
            <div className="text-sm text-gray-600">No all-day items</div>
            <div className="text-xs text-gray-500 mt-1">Everything has a time window</div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-3 bg-white border-t border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Drop on calendar for On-Site
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
            Drop on vendor lane for Off-Site
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnassignedQueue
