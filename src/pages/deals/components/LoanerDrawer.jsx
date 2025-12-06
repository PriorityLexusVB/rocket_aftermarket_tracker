import React, { useEffect, useState } from 'react'
import Button from '../../../components/ui/Button'
import Icon from '../../../components/ui/Icon'
import { toDateInputValue } from '../../../utils/dateTimeUtils'

// Lightweight drawer to assign or update a loaner for a deal
// Props:
// - isOpen: boolean
// - onClose: () => void
// - deal: deal object (expects id and loaner fields if present)
// - onSave: (loanerData) => Promise<void> where loanerData = { job_id, loaner_number, eta_return_date, notes }
// - loading: boolean (saving state)
export default function LoanerDrawer({ isOpen, onClose, deal, onSave, loading }) {
  const [loanerNumber, setLoanerNumber] = useState('')
  const [etaReturnDate, setEtaReturnDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!isOpen) return
    // Prefill from current deal when available
    setLoanerNumber(deal?.loaner_number || '')
    // Use toDateInputValue helper to convert ISO to YYYY-MM-DD format
    setEtaReturnDate(toDateInputValue(deal?.loaner_eta_return_date) || '')
    setNotes('')
  }, [isOpen, deal])

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

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Loaner Number</label>
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
            <label className="block text-xs font-medium text-slate-600 mb-1">ETA Return Date</label>
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
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="h-11 flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              aria-label="Save loaner"
              disabled={loading || !loanerNumber.trim()}
            >
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
