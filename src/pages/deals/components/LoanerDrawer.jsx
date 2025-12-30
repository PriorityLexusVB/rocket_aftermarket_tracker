import React, { useEffect, useState } from 'react'
import Button from '../../../components/ui/Button'
import Icon from '../../../components/ui/Icon'
import { toDateInputValue } from '../../../utils/dateTimeUtils'
import { getReturnedLoanerAssignmentsForJob } from '../../../services/dealService'

// Lightweight drawer to assign or update a loaner for a deal
// Props:
// - isOpen: boolean
// - onClose: () => void
// - deal: deal object (expects id and loaner fields if present)
// - onSave: (loanerData) => Promise<void> where loanerData = { job_id, loaner_number, eta_return_date, notes }
// - onRemove: (loanerAssignmentId) => Promise<void> (optional)
// - loading: boolean (saving state)
export default function LoanerDrawer({
  isOpen,
  onClose,
  deal,
  onSave,
  onRemove,
  loading,
  removing,
  tab,
  onTabChange,
}) {
  const [internalTab, setInternalTab] = useState('active')
  const activeTab = typeof tab === 'string' ? tab : internalTab
  const setActiveTab = (next) => {
    if (typeof onTabChange === 'function') onTabChange(next)
    else setInternalTab(next)
  }

  const [loanerNumber, setLoanerNumber] = useState('')
  const [etaReturnDate, setEtaReturnDate] = useState('')
  const [notes, setNotes] = useState('')

  const [returnedLoading, setReturnedLoading] = useState(false)
  const [returnedAssignments, setReturnedAssignments] = useState([])

  useEffect(() => {
    if (!isOpen) return
    // Default to Active tab on open unless parent controls it.
    if (typeof tab !== 'string') setInternalTab('active')
    // Prefill from current deal when available
    setLoanerNumber(deal?.loaner_number || '')
    // Use toDateInputValue helper to convert ISO to YYYY-MM-DD format
    setEtaReturnDate(toDateInputValue(deal?.loaner_eta_return_date) || '')
    setNotes('')
  }, [isOpen, deal, tab])

  useEffect(() => {
    if (!isOpen) return
    if (activeTab !== 'returned') return
    if (!deal?.id) return

    let cancelled = false

    ;(async () => {
      try {
        setReturnedLoading(true)
        const rows = await getReturnedLoanerAssignmentsForJob(deal.id, { limit: 25 })
        if (cancelled) return
        setReturnedAssignments(Array.isArray(rows) ? rows : [])
      } finally {
        if (!cancelled) setReturnedLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, activeTab, deal?.id])

  if (!isOpen) return null

  const handleSave = async () => {
    const payload = {
      job_id: deal?.id,
      loaner_number: (loanerNumber || '').trim(),
      eta_return_date: etaReturnDate || null,
      notes: (notes || '').trim() || null,
    }
    await onSave?.(payload)
  }

  const handleRemove = async () => {
    if (!deal?.loaner_id) return
    await onRemove?.(deal.loaner_id)
  }

  const hasActiveLoaner = !!deal?.loaner_id

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full md:w-[420px] bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-5 border-b bg-white sticky top-0 z-10 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">
              {deal?.job_number || `Job-${String(deal?.id || '').slice(0, 8)}`}
            </div>
            <div className="text-lg font-semibold text-slate-900">
              {deal?.customer_name ? `Loaner for ${deal.customer_name}` : 'Assign Loaner'}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close drawer">
            <Icon name="X" size={20} />
          </Button>
        </div>

        <div className="p-5">
          <div className="flex gap-2 mb-4">
            <Button
              variant={activeTab === 'active' ? 'default' : 'outline'}
              onClick={() => setActiveTab('active')}
              className="h-10 flex-1"
              aria-label="Show active loaner"
              disabled={loading || removing}
            >
              Active
            </Button>
            <Button
              variant={activeTab === 'returned' ? 'default' : 'outline'}
              onClick={() => setActiveTab('returned')}
              className="h-10 flex-1"
              aria-label="Show return tab"
              disabled={loading || removing}
            >
              Return
            </Button>
          </div>

          {activeTab === 'active' ? (
            <div className="space-y-4">
              {!hasActiveLoaner && (
                <div className="text-sm text-slate-600">No active loaner assigned to this job.</div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Loaner Number
                </label>
                <input
                  data-testid="loaner-number-input"
                  type="text"
                  value={loanerNumber}
                  onChange={(e) => setLoanerNumber(e.target.value)}
                  placeholder="#123"
                  className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  ETA Return Date
                </label>
                <input
                  data-testid="loaner-eta-input"
                  type="date"
                  value={etaReturnDate}
                  onChange={(e) => setEtaReturnDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  data-testid="loaner-notes-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="bg-white border border-slate-200 rounded-lg w-full px-3 py-2"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="h-11 flex-1"
                  aria-label="Cancel loaner edit"
                  disabled={loading || removing}
                >
                  Cancel
                </Button>
                {deal?.loaner_id && typeof onRemove === 'function' && (
                  <Button
                    variant="destructive"
                    onClick={handleRemove}
                    className="h-11 flex-1"
                    aria-label="Remove loaner"
                    disabled={loading || removing}
                  >
                    {removing ? 'Removing…' : 'Remove'}
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  className="h-11 flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  aria-label="Save loaner"
                  disabled={loading || removing || !loanerNumber.trim()}
                >
                  {loading ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {returnedLoading ? (
                <div className="text-sm text-slate-600">Loading returned loaners…</div>
              ) : returnedAssignments.length === 0 ? (
                <div className="text-sm text-slate-600">No returned loaners yet.</div>
              ) : (
                <div className="space-y-2">
                  {returnedAssignments.map((row) => {
                    const returnedLabel = row?.returned_at
                      ? new Date(row.returned_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : ''

                    const etaLabel = row?.eta_return_date
                      ? new Date(row.eta_return_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : null

                    return (
                      <div
                        key={row?.id}
                        className="border border-slate-200 rounded-lg p-3 bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-slate-900">
                            {row?.loaner_number ? `#${row.loaner_number}` : 'Loaner'}
                          </div>
                          <div className="text-xs text-slate-500">Returned {returnedLabel}</div>
                        </div>
                        {(etaLabel || row?.notes) && (
                          <div className="mt-1 text-xs text-slate-600">
                            {etaLabel ? `ETA was ${etaLabel}` : null}
                            {etaLabel && row?.notes ? ' • ' : null}
                            {row?.notes ? String(row.notes) : null}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
