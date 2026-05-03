import React, { useEffect, useMemo, useRef, useState } from 'react'
import X from 'lucide-react/dist/esm/icons/x.js'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js'
import jobService from '@/services/jobService'

// ─── helpers ────────────────────────────────────────────────────────────────

function getDealTitle(deal) {
  if (!deal) return 'Deal Details'
  const identifier = deal?.job_number || deal?.id || ''
  return identifier ? `Deal ${identifier}` : 'Deal Details'
}

function getFocusableElements(container) {
  if (!container) return []
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute('disabled'))
}

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  quality_check: 'bg-purple-100 text-purple-700',
  qc: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
}

function StatusBadge({ status }) {
  const label = status
    ? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown'
  const colorClass = STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
      {label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatTime(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ─── component ──────────────────────────────────────────────────────────────

export default function DealDrawer({ open, deal, onClose, onStatusChange }) {
  const panelRef = useRef(null)
  const closeButtonRef = useRef(null)
  const lastActiveElementRef = useRef(null)

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  const title = useMemo(() => getDealTitle(deal), [deal])
  const dealId = deal?.id
  const dealStatus = String(deal?.job_status || deal?.status || '').toLowerCase()

  // vehicle line
  const vehicleLine = useMemo(() => {
    const v = deal?.vehicle
    if (v?.year || v?.make || v?.model) {
      return [v.year, v.make, v.model].filter(Boolean).join(' ')
    }
    return deal?.vehicle_description || null
  }, [deal])

  // promised date
  const promisedDisplay = useMemo(() => {
    const raw = deal?.next_promised_iso || deal?.promised_date || deal?.promisedAt
    return raw ? formatDate(raw) : null
  }, [deal])

  // scheduled window
  const scheduledDisplay = useMemo(() => {
    const start = deal?.scheduled_start_time
    const end = deal?.scheduled_end_time
    if (!start) return null
    const startStr = formatTime(start)
    const endStr = end ? formatTime(end) : null
    return endStr ? `${startStr} – ${endStr}` : startStr
  }, [deal])

  // primary action definition
  const primaryAction = useMemo(() => {
    if (!dealStatus) {
      return { label: 'Select action', disabled: true }
    }
    if (dealStatus === 'scheduled') {
      return { label: 'Mark In Progress', targetStatus: 'in_progress' }
    }
    if (dealStatus === 'in_progress') {
      return { label: 'Move to QC', targetStatus: 'quality_check' }
    }
    if (dealStatus === 'quality_check' || dealStatus === 'qc') {
      return { label: 'Mark Complete', targetStatus: 'completed' }
    }
    if (
      dealStatus === 'unscheduled' ||
      dealStatus === 'promised' ||
      dealStatus === 'pending' ||
      dealStatus === 'draft'
    ) {
      return { label: 'Open deal to schedule', disabled: true }
    }
    return { label: 'Select action', disabled: true }
  }, [dealStatus])

  // focus trap + ESC
  useEffect(() => {
    if (!open) return

    lastActiveElementRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (closeButtonRef.current) closeButtonRef.current.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
        return
      }
      if (event.key === 'Tab') {
        const focusables = getFocusableElements(panelRef.current)
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      const lastActive = lastActiveElementRef.current
      if (lastActive && document.contains(lastActive) && typeof lastActive.focus === 'function') {
        lastActive.focus()
      }
    }
  }, [open, onClose])

  // reset error when deal changes
  useEffect(() => {
    setActionError(null)
  }, [dealId])

  const handlePrimaryAction = async () => {
    if (!primaryAction.targetStatus || !dealId) return
    setActionLoading(true)
    setActionError(null)
    try {
      await jobService.updateStatus(dealId, primaryAction.targetStatus)
      onStatusChange?.()
      onClose?.()
    } catch (err) {
      setActionError(err?.message || 'Status update failed.')
    } finally {
      setActionLoading(false)
    }
  }

  if (!open) return null

  const jobParts = Array.isArray(deal?.job_parts) ? deal.job_parts : []

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        role="presentation"
        aria-hidden="true"
        data-testid="deal-drawer-backdrop"
        className="absolute inset-0 bg-black/40"
        onClick={() => onClose?.()}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-drawer-title"
        className="absolute right-0 top-16 h-[calc(100%-4rem)] w-full max-w-xl overflow-hidden bg-white shadow-xl md:top-0 md:h-full flex flex-col"
      >
        {/* ── header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4">
          <div className="space-y-1">
            <h2 id="deal-drawer-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            <StatusBadge status={dealStatus} />
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close deal drawer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── scrollable body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 p-4 text-sm text-slate-700 md:space-y-6 md:p-6">

          {/* Summary */}
          <section className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Summary
            </h3>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-0.5">
              <div className="font-medium text-slate-900">{deal?.title || 'Deal details'}</div>
              <div className="text-xs text-slate-500">
                {deal?.customer_name || deal?.vehicle?.owner_name || 'Customer'}
              </div>
              {vehicleLine && (
                <div className="text-xs text-slate-400">{vehicleLine}</div>
              )}
            </div>
          </section>

          {/* Line Items */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Line Items
            </h3>
            {jobParts.length > 0 ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50">
                {jobParts.map((part) => {
                  const partName =
                    part?.product?.name || part?.name || part?.description || `Part ${part.id}`
                  const partStatus = part?.status
                    ? part.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                    : null
                  return (
                    <li key={part.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {part.is_off_site && (
                          <span
                            title="Off-site"
                            className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-amber-400"
                          />
                        )}
                        <span className="truncate text-xs text-slate-700">{partName}</span>
                      </div>
                      {partStatus && (
                        <span className="flex-shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          {partStatus}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">
                No line items on record.
              </div>
            )}
          </section>

          {/* Schedule */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Schedule
            </h3>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Promised</span>
                <span className="text-xs font-medium text-slate-700">
                  {promisedDisplay ?? 'No promise date set.'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Window</span>
                <span className="text-xs font-medium text-slate-700">
                  {scheduledDisplay ?? 'Not yet scheduled.'}
                </span>
              </div>
            </div>
          </section>

          {/* Notes — only if present */}
          {deal?.notes ? (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </h3>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {deal.notes}
              </div>
            </section>
          ) : null}
        </div>

        {/* ── footer ── */}
        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-3 md:px-6">
          {actionError && (
            <p className="mb-2 text-[11px] font-medium text-red-600">{actionError}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onClose?.()}
              aria-label="Dismiss drawer"
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Dismiss
            </button>
            <div className="flex items-center gap-2">
              {dealId ? (
                <a
                  href={`/deals/${dealId}/edit`}
                  className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Open deal
                </a>
              ) : null}
              <button
                type="button"
                disabled={primaryAction.disabled || actionLoading}
                onClick={handlePrimaryAction}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${
                  primaryAction.disabled || actionLoading
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'bg-slate-900 text-white hover:bg-slate-700'
                }`}
              >
                {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                {primaryAction.label}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
