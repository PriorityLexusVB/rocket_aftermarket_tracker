import React, { useMemo } from 'react'
import { CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { formatEtDateLabel } from '@/utils/scheduleDisplay'

export default function PromisedQueue({
  unscheduledJobs,
  needsTimeCount,
  overdueCount,
  highlightNeedsTime,
  showOverdueOnly,
  onToggleNeedsTime,
  onToggleOverdueOnly,
  onJobClick,
  onDragStart,
  onComplete,
  onReopen,
  isStatusInFlight,
  loading,
}) {
  const rows = useMemo(() => unscheduledJobs ?? [], [unscheduledJobs])
  const needsTimeTotal = Number.isFinite(needsTimeCount) ? needsTimeCount : 0
  const overdueTotal = Number.isFinite(overdueCount) ? overdueCount : 0

  return (
    <div className="w-80 shrink-0 rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-gray-900">Queue</h3>
          </div>
          <span className="text-xs text-gray-500">{rows.length} unscheduled</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleNeedsTime}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${
              highlightNeedsTime
                ? 'bg-amber-100 text-amber-900'
                : 'bg-slate-100 text-slate-700'
            }`}
            aria-pressed={highlightNeedsTime}
          >
            Needs Time
            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold">
              {needsTimeTotal}
            </span>
          </button>
          <button
            type="button"
            onClick={onToggleOverdueOnly}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${
              showOverdueOnly ? 'bg-red-100 text-red-900' : 'bg-slate-100 text-slate-700'
            }`}
            aria-pressed={showOverdueOnly}
          >
            Overdue
            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold">
              {overdueTotal}
            </span>
          </button>
        </div>
        <div className="text-[11px] text-gray-500">
          Needs Time items render all-day on the board.
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {loading ? <div className="p-4 text-sm text-gray-500">Loading…</div> : null}
        {!loading && rows.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No unscheduled jobs.</div>
        ) : null}

        {rows.map((job) => {
          const raw = job?.raw || job
          const isCompleted = String(raw?.job_status || '').toLowerCase() === 'completed'
          const isBusy = Boolean(isStatusInFlight?.(raw?.id))
          const promise = raw?.next_promised_iso || raw?.promised_date || raw?.promisedAt || null

          return (
            <div
              key={job?.calendarKey || job?.calendar_key || raw?.id}
              className={`p-3 ${isBusy ? 'opacity-60' : ''}`}
              onClick={() => onJobClick?.(raw)}
              draggable
              onDragStart={() => onDragStart?.(raw)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {raw?.job_number ? `${raw.job_number} • ` : ''}
                      {raw?.title || raw?.vehicle_description || '(Untitled)'}
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-200/60 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      UNSCHEDULED
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {promise ? `Promise: ${formatEtDateLabel(promise) || '—'}` : 'No promised day'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isCompleted) onReopen?.(raw)
                    else onComplete?.(raw)
                  }}
                  disabled={isBusy}
                  className={
                    isCompleted
                      ? `inline-flex h-8 w-8 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-800 ${
                          isBusy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-100'
                        }`
                      : `inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 ${
                          isBusy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-100'
                        }`
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
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
