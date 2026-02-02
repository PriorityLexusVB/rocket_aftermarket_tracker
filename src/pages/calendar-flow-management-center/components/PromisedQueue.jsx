import React, { useMemo } from 'react'
import { CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { formatEtDateLabel } from '@/utils/scheduleDisplay'

export default function PromisedQueue({
  jobs,
  onJobClick,
  onDragStart,
  onComplete,
  onReopen,
  isStatusInFlight,
  loading,
}) {
  const rows = useMemo(() => jobs ?? [], [jobs])

  return (
    <div className="w-80 shrink-0 rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900">Promised (Date Only)</h3>
          <span className="text-xs text-gray-500">({rows.length})</span>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {loading ? <div className="p-4 text-sm text-gray-500">Loading…</div> : null}
        {!loading && rows.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No promised date-only jobs.</div>
        ) : null}

        {rows.map((job) => {
          const isCompleted = String(job?.job_status || '').toLowerCase() === 'completed'
          const isBusy = Boolean(isStatusInFlight?.(job?.id))
          const promise = job?.next_promised_iso || job?.promised_date || job?.promisedAt || null

          return (
            <div
              key={job?.calendar_key || job?.id}
              className={`p-3 ${isBusy ? 'opacity-60' : ''}`}
              onClick={() => onJobClick?.(job)}
              draggable
              onDragStart={() => onDragStart?.(job)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {job?.job_number ? `${job.job_number} • ` : ''}
                      {job?.title || job?.vehicle_description || '(Untitled)'}
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-200/60 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      PROMISE
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    Promise: {formatEtDateLabel(promise) || '—'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isCompleted) onReopen?.(job)
                    else onComplete?.(job)
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
                  {isCompleted ? <RefreshCw className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
