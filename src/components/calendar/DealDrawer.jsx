import React, { useEffect, useMemo, useRef } from 'react'
import { X } from 'lucide-react'

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

export default function DealDrawer({ open, deal, onClose }) {
  const panelRef = useRef(null)
  const closeButtonRef = useRef(null)
  const lastActiveElementRef = useRef(null)
  const title = useMemo(() => getDealTitle(deal), [deal])
  const dealId = deal?.id
  const dealStatus = String(deal?.job_status || deal?.status || '').toLowerCase()

  const primaryAction = useMemo(() => {
    if (!dealStatus) {
      return { label: 'Select action', disabled: true, helper: 'Select a deal to take action.' }
    }

    if (dealStatus === 'unscheduled') {
      return { label: 'Set promise date', helper: 'Coming soon' }
    }

    if (dealStatus === 'promised' || dealStatus === 'pending') {
      return { label: 'Set time', helper: 'Coming soon' }
    }

    if (dealStatus === 'scheduled') {
      return { label: 'Mark In Progress', helper: 'Coming soon' }
    }

    if (dealStatus === 'in_progress') {
      return { label: 'Move to QC', helper: 'Coming soon' }
    }

    if (dealStatus === 'qc') {
      return { label: 'Complete', helper: 'Coming soon' }
    }

    return { label: 'Select action', disabled: true, helper: 'Action unavailable.' }
  }, [dealStatus])

  useEffect(() => {
    if (!open) return

    lastActiveElementRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTarget = closeButtonRef.current
    if (focusTarget) focusTarget.focus()

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

  if (!open) return null

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
        className="absolute right-0 top-16 h-[calc(100%-4rem)] w-full max-w-xl overflow-y-auto bg-white shadow-xl md:top-0 md:h-full"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4">
          <div>
            <h2 id="deal-drawer-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            <p className="text-xs text-slate-500">Deal Drawer (preview)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => onClose?.()}
              aria-label="Close deal drawer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
            {dealId ? (
              <a
                href={`/deals/${dealId}/edit`}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Open deal
              </a>
            ) : null}
          </div>
        </div>

        <div className="space-y-5 p-4 pb-24 text-sm text-slate-700 md:space-y-6 md:p-6 md:pb-6">
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Primary action
                </div>
                <div className="text-xs text-slate-500">{primaryAction.helper}</div>
              </div>
              <button
                type="button"
                disabled={primaryAction.disabled}
                className={`rounded-md px-3 py-2 text-xs font-semibold ${
                  primaryAction.disabled
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'bg-slate-900 text-white'
                }`}
              >
                {primaryAction.label}
              </button>
            </div>
          </section>
          <section className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Summary
            </h3>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="font-medium text-slate-900">{deal?.title || 'Deal details'}</div>
              <div className="text-xs text-slate-500">
                {deal?.customer_name || deal?.vehicle?.owner_name || 'Customer'}
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Line Items
            </h3>
            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-slate-500">
              Line item details coming soon.
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Schedule
            </h3>
            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-slate-500">
              Scheduling controls coming soon.
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              History / Notes
            </h3>
            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-slate-500">
              Activity history coming soon.
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
