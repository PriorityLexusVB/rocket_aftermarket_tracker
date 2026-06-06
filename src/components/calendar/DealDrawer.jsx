import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import X from 'lucide-react/dist/esm/icons/x.js'
import Copy from 'lucide-react/dist/esm/icons/copy.js'
import Check from 'lucide-react/dist/esm/icons/check.js'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js'
import jobService from '@/services/jobService'
import { getPromiseIso } from '@/services/scheduleItemsService'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'

// Wave XXX-L: useLocation throws when rendered outside a Router. The drawer
// is used in production inside the AppLayout (Router context guaranteed), but
// unit tests render it bare. Returning null when no Router context keeps the
// eyebrow hidden in tests without forcing every test file to wrap in a Router.
function useOptionalLocation() {
  try {
    return useLocation()
  } catch {
    return null
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function getDealTitle(deal) {
  if (!deal) return 'Deal Details'
  // Hero should lead with customer / vehicle (the human identity), not the
  // database job_number. Identifier is rendered separately as a small label.
  return (
    deal?.customer_name ||
    deal?.customerName ||
    deal?.vehicle?.owner_name ||
    deal?.title ||
    deal?.vehicle_description ||
    'Deal Details'
  )
}

function getDealIdentifierLabel(deal) {
  const id = deal?.job_number || deal?.id || ''
  return id ? `Deal · Job # ${id}` : ''
}

function getFocusableElements(container) {
  if (!container) return []
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute('disabled'))
}

// Wave XXX-V: 5-state model — quality_check/qc removed, reversed added.
const STATUS_COLORS = {
  pending: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  reversed: 'bg-red-100 text-red-700',
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
  const [mounted, setMounted] = useState(false)
  // Wave XXX-M: Copy Job Number affordance (prep for JobDrawer retirement)
  const [jobNumberCopied, setJobNumberCopied] = useState(false)
  // Wave XXX-S: useRef guard for action concurrency. useState alone has a
  // stale-closure window — rapid double-click can see actionLoading=false
  // twice before the first render commits. useRef is synchronous.
  const actionInFlightRef = useRef(false)

  const location = useOptionalLocation()
  const fromOverdue = location?.pathname === '/overdue'
  // Wave XXX-W F-3: toast feedback for QC + reverse. Optional-chained so test
  // renders without a ToastProvider don't crash.
  const toast = useToast?.()

  useEffect(() => {
    if (!open) { setMounted(false); return }
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  const title = useMemo(() => getDealTitle(deal), [deal])
  const identifierLabel = useMemo(() => getDealIdentifierLabel(deal), [deal])
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
    const raw = getPromiseIso(deal)
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

  // primary action definition — Wave XXX-V: 5-state model.
  // quality_check is now a timestamp (quality_checked_at), not a status.
  // Flow: pending → (needs scheduling) | scheduled → in_progress → [QC stamp] → completed
  const primaryAction = useMemo(() => {
    if (!dealStatus) {
      return { label: 'Select action', disabled: true }
    }
    if (dealStatus === 'scheduled') {
      return { label: 'Mark In Progress', targetStatus: 'in_progress' }
    }
    if (dealStatus === 'in_progress' && !deal?.quality_checked_at) {
      return { label: 'Mark QC Checked', targetStatus: null, markQC: true }
    }
    if (dealStatus === 'in_progress' && deal?.quality_checked_at) {
      return { label: 'Mark Complete', targetStatus: 'completed' }
    }
    // Wave XXX-Z stale-reference cleanup: 'unscheduled', 'promised', 'draft'
    // are all retired or never-real status strings. job_status is now constrained
    // to the 5-state enum (pending/scheduled/in_progress/completed/reversed).
    // Only 'pending' is a real status that means "not scheduled yet."
    if (dealStatus === 'pending') {
      return { label: 'Not scheduled yet', disabled: true, needsScheduling: true }
    }
    return { label: 'Select action', disabled: true }
  }, [dealStatus, deal?.quality_checked_at])

  // Wave XXX-L: secondary actions reachable from chip click on the calendar
  // board. Previously No-Show was only in the heavy JobDrawer surface which
  // isn't reachable from chip click (browser-tester finding). The compact
  // secondary row keeps the simplified drawer (less button overload than
  // opening the full JobDrawer) while making No-Show + Reschedule reachable.
  const showNoShow = ['pending', 'scheduled', 'in_progress'].includes(dealStatus)
  // Wave XXX-V: no_show retired; reversed deals are terminal and not reschedulable
  const showReschedule = ['scheduled', 'in_progress'].includes(dealStatus)
  // Wave XXX-W F-5: general Reverse affordance for any non-terminal state.
  // No-Show stays as a fast-path; Reverse covers everything else.
  const showReverse = ['pending', 'scheduled', 'in_progress', 'completed'].includes(dealStatus)
  const isReversed = dealStatus === 'reversed'

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
    if (!dealId) return
    // Wave XXX-S: synchronous ref guard prevents double-fire on rapid clicks
    if (actionInFlightRef.current) return
    actionInFlightRef.current = true
    setActionLoading(true)
    setActionError(null)
    try {
      // Wave XXX-V: markQC writes quality_checked_at timestamp, keeps in_progress status
      if (primaryAction.markQC) {
        // Wave XXX-W Codex catch: supabase .update() does NOT throw — it returns
        // {data, error}. Without checking error, a DB-rejected write (RLS,
        // constraint) would falsely toast "QC check recorded". Destructure + throw.
        const { error: updErr } = await supabase
          .from('jobs')
          .update({ quality_checked_at: new Date().toISOString() })
          .eq('id', dealId)
        if (updErr) throw updErr
        // Wave XXX-W F-3: confirm to user that QC was logged (silent action was confusing)
        toast?.success?.('QC check recorded')
        onStatusChange?.()
        // Stay open — primary action now becomes "Mark Complete"
      } else if (primaryAction.targetStatus) {
        await jobService.updateStatus(dealId, primaryAction.targetStatus)
        onStatusChange?.()
        onClose?.()
      }
    } catch (err) {
      setActionError(err?.message || 'Status update failed.')
    } finally {
      setActionLoading(false)
      actionInFlightRef.current = false
    }
  }

  // Wave XXX-L: No-Show is reachable from chip click on the calendar board.
  // Previously only in JobDrawer (unreachable from chip). Confirmation prevents
  // an accidental status flip from a misplaced click.
  const handleNoShow = async () => {
    if (!dealId || actionInFlightRef.current) return
    // Wave XXX-W: lock the ref BEFORE the confirm dialog opens. Verifier
    // caught that 5 rapid clicks open 5 sequential confirms (because the
    // ref wasn't set until AFTER confirm resolved). Now: first click locks
    // the ref + opens the dialog; subsequent clicks return immediately
    // because ref is true. Cancel resets the ref so the user can try again.
    actionInFlightRef.current = true
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm(
        'Mark this deal as No-Show? This permanently reverses the deal — the customer did not show up. This action cannot be undone.'
      )
    if (!confirmed) {
      actionInFlightRef.current = false
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      // Wave XXX-V: no_show → reverse_deal RPC with reason 'No-Show'
      // Wave XXX-W Codex catch: supabase.rpc() does NOT throw on error — destructure.
      const { error: rpcErr } = await supabase.rpc('reverse_deal', {
        p_deal_id: dealId,
        p_reason: 'No-Show',
      })
      if (rpcErr) throw rpcErr
      toast?.success?.('Deal reversed: No-Show')
      onStatusChange?.()
      onClose?.()
    } catch (err) {
      setActionError(err?.message || 'Could not set No-Show.')
      toast?.error?.(err?.message || 'Could not set No-Show.')
    } finally {
      setActionLoading(false)
      actionInFlightRef.current = false
    }
  }

  // Wave XXX-W F-5: general-purpose Reverse with custom reason. Lets coordinators
  // unwind a deal for any reason (customer changed mind, financing fell through,
  // dealership backed out) without forcing them through the No-Show shortcut.
  const handleReverse = async () => {
    if (!dealId || actionInFlightRef.current) return
    actionInFlightRef.current = true
    // eslint-disable-next-line no-alert
    const reason = typeof window !== 'undefined' ? window.prompt(
      'Reverse this deal — reason (required, e.g. "Customer changed mind", "Financing fell through"):'
    ) : null
    if (!reason || !reason.trim()) {
      actionInFlightRef.current = false
      toast?.error?.('Reversal cancelled — reason is required.')
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      // Wave XXX-W Codex catch: supabase.rpc() does NOT throw on error — destructure.
      const { error: rpcErr } = await supabase.rpc('reverse_deal', {
        p_deal_id: dealId,
        p_reason: reason.trim(),
      })
      if (rpcErr) throw rpcErr
      toast?.success?.('Deal reversed')
      onStatusChange?.()
      onClose?.()
    } catch (err) {
      setActionError(err?.message || 'Could not reverse this deal.')
      toast?.error?.(err?.message || 'Could not reverse this deal.')
    } finally {
      setActionLoading(false)
      actionInFlightRef.current = false
    }
  }

  const handleReschedule = () => {
    if (!dealId) return
    // Send the user to the deal edit surface where date/time fields live.
    // Calendar drag-and-drop is the faster path; the edit page is the
    // reliable fallback if the user isn't sure where the job belongs.
    if (typeof window !== 'undefined') {
      window.location.href = `/deals/${dealId}/edit`
    }
  }

  // Wave XXX-M: copy job number to clipboard (parity with JobDrawer for the
  // simplified DealDrawer to fully replace it).
  const handleCopyJobNumber = async () => {
    const text = deal?.job_number
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(String(text))
      setJobNumberCopied(true)
      window.setTimeout(() => setJobNumberCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy job number:', err)
    }
  }

  if (!open) return null

  const jobParts = Array.isArray(deal?.job_parts) ? deal.job_parts : []

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div
        role="presentation"
        aria-hidden="true"
        data-testid="deal-drawer-backdrop"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-150 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => onClose?.()}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-drawer-title"
        className={`absolute right-0 top-16 h-[calc(100%-4rem)] w-full max-w-xl overflow-hidden bg-white shadow-xl md:top-0 md:h-full flex flex-col transition-transform duration-150 ease-out ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* ── header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4">
          <div className="space-y-1 min-w-0">
            {fromOverdue && (
              <div className="text-[10px] font-semibold uppercase tracking-wide text-red-500">
                From Overdue Inbox
              </div>
            )}
            {identifierLabel && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-slate-400">
                <span>{identifierLabel}</span>
                {deal?.job_number ? (
                  <button
                    type="button"
                    onClick={handleCopyJobNumber}
                    aria-label="Copy job number"
                    title="Copy job number"
                    className="inline-flex items-center justify-center rounded p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    {jobNumberCopied ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                ) : null}
              </div>
            )}
            <h2 id="deal-drawer-title" className="text-lg font-semibold text-slate-900 truncate">
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
              {/* Wave XXX-W F-3: surface quality_checked_at when present so the
                  coordinator can see QC was logged without opening the DB. */}
              {deal?.quality_checked_at && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">QC Checked</span>
                  <span className="text-xs font-medium text-green-700">
                    {new Date(deal.quality_checked_at).toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Wave XXX-W F-2: reversal audit trail — surfaced only on reversed
              deals so coordinators / managers can answer "why did this fall
              through, when, by whom" without querying the DB. Fields render
              only if present on the deal prop (graceful if parent's select
              doesn't yet include the columns). */}
          {isReversed && deal?.reversed_at && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Reversal Details
              </h3>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-red-700 shrink-0">Reason</span>
                  <span className="text-xs font-medium text-red-900 text-right">
                    {deal.reversed_reason || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-red-700 shrink-0">Reversed</span>
                  <span className="text-xs font-medium text-red-900">
                    {new Date(deal.reversed_at).toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {deal.pre_reverse_status && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-red-700 shrink-0">Was</span>
                    <span className="text-xs font-medium text-red-900 capitalize">
                      {String(deal.pre_reverse_status).replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

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

          {/* Wave XXX-L: secondary actions reachable from chip click — No-Show
              and Reschedule. Wave XXX-W F-5 adds general Reverse for any
              non-terminal state. Hidden when not applicable. */}
          {(showNoShow || showReschedule || showReverse) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {showReschedule && (
                <button
                  type="button"
                  onClick={handleReschedule}
                  disabled={actionLoading}
                  aria-label="Reschedule this job"
                  className="rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-medium text-orange-800 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reschedule
                </button>
              )}
              {showNoShow && (
                <button
                  type="button"
                  onClick={handleNoShow}
                  disabled={actionLoading}
                  aria-label="Mark as No-Show"
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  No-Show
                </button>
              )}
              {showReverse && (
                <button
                  type="button"
                  onClick={handleReverse}
                  disabled={actionLoading}
                  aria-label="Reverse this deal with reason"
                  title="Reverse this deal (requires reason)"
                  className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reverse Deal
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onClose?.()}
              aria-label="Close drawer"
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Close
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
              {primaryAction.needsScheduling ? (
                <a
                  href="/calendar?view=board&range=day"
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Schedule on Board →
                </a>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  )
}
