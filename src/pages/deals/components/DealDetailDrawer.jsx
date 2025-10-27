import React, { useMemo, useState } from 'react'
import Button from '../../../components/ui/Button'
import Icon from '../../../components/ui/Icon'

// Read-only Deal Detail Drawer with 8 tabs and quick actions
export default function DealDetailDrawer({ isOpen, onClose, deal }) {
  const [activeTab, setActiveTab] = useState('Customer')
  const [copied, setCopied] = useState('')

  const tabs = useMemo(
    () => [
      'Customer',
      'Vehicle',
      'Deal & Pricing',
      'Scheduling',
      'Vendor',
      'Files',
      'Activity',
      'Alerts/Holds',
    ],
    []
  )

  if (!isOpen || !deal) return null

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('Copied!')
      setTimeout(() => setCopied(''), 1500)
    } catch (_) {
      setCopied('Copy failed')
      setTimeout(() => setCopied(''), 1500)
    }
  }

  const Section = ({ title, children }) => (
    <div className="mb-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        {title}
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-800">
        {children || <span className="text-slate-400">—</span>}
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'Customer':
        return (
          <>
            <Section title="Customer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{deal?.customer_name || '—'}</div>
                  <div className="text-slate-600">{deal?.customer_email || '—'}</div>
                  <div className="text-slate-600">{deal?.customer_phone || '—'}</div>
                </div>
                <div className="flex gap-2">
                  {deal?.customer_phone && (
                    <a href={`tel:${deal?.customer_phone}`} onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-9">
                        <Icon name="Phone" size={16} className="mr-1" /> Call
                      </Button>
                    </a>
                  )}
                  {deal?.customer_phone && (
                    <a href={`sms:${deal?.customer_phone}`} onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-9">
                        <Icon name="MessageSquare" size={16} className="mr-1" /> SMS
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() =>
                      copy(`${deal?.customer_name || ''} ${deal?.customer_phone || ''}`.trim())
                    }
                  >
                    <Icon name="Copy" size={16} className="mr-1" /> Copy
                  </Button>
                </div>
              </div>
            </Section>
          </>
        )
      case 'Vehicle':
        return (
          <>
            <Section title="Vehicle">
              <div>
                <div>
                  {deal?.vehicle
                    ? `${deal?.vehicle?.year || ''} ${deal?.vehicle?.make || ''} ${deal?.vehicle?.model || ''}`.trim()
                    : '—'}
                </div>
                {deal?.vehicle?.stock_number && (
                  <div className="text-slate-600">Stock: {deal?.vehicle?.stock_number}</div>
                )}
              </div>
            </Section>
          </>
        )
      case 'Deal & Pricing':
        return (
          <>
            <Section title="Totals">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-slate-500">Value</div>
                  <div className="font-medium">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      parseFloat(deal?.total_amount) || 0
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Est. Margin</div>
                  <div className="font-medium">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      (parseFloat(deal?.total_amount) || 0) * 0.25
                    )}
                  </div>
                </div>
              </div>
            </Section>
          </>
        )
      case 'Scheduling':
        return (
          <>
            <Section title="Appointment">
              {deal?.appt_start ? (
                <div className="text-sm">
                  {new Date(deal?.appt_start).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' • '}
                  {new Date(deal?.appt_start).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {'–'}
                  {deal?.appt_end
                    ? new Date(deal?.appt_end).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </div>
              ) : (
                '—'
              )}
            </Section>
            <Section title="Next Promise">
              {deal?.next_promised_iso ? new Date(deal?.next_promised_iso).toLocaleString() : '—'}
            </Section>
          </>
        )
      case 'Vendor':
        return (
          <>
            <Section title="Vendor">
              <div>{deal?.vendor_name || 'Unassigned'}</div>
            </Section>
          </>
        )
      case 'Files':
        return (
          <>
            <Section title="Files">No files yet.</Section>
          </>
        )
      case 'Activity':
        return (
          <>
            <Section title="Activity">Activity timeline coming soon.</Section>
          </>
        )
      case 'Alerts/Holds':
        return (
          <>
            <Section title="Alerts/Holds">No alerts.</Section>
          </>
        )
      default:
        return null
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full md:w-[520px] bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-5 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">
                {deal?.job_number || `Job-${String(deal?.id || '').slice(0, 8)}`}
              </div>
              <div className="text-lg font-semibold text-slate-900">
                {deal?.customer_name || 'Deal Details'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {copied && <span className="text-xs text-slate-500">{copied}</span>}
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close drawer">
                <Icon name="X" size={20} />
              </Button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {deal?.customer_phone && (
              <a href={`tel:${deal?.customer_phone}`} onClick={(e) => e.stopPropagation()}>
                <Button size="sm" className="h-9">
                  <Icon name="Phone" size={16} className="mr-1" /> Call
                </Button>
              </a>
            )}
            {deal?.customer_phone && (
              <a href={`sms:${deal?.customer_phone}`} onClick={(e) => e.stopPropagation()}>
                <Button size="sm" className="h-9">
                  <Icon name="MessageSquare" size={16} className="mr-1" /> SMS
                </Button>
              </a>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => copy(deal?.customer_phone || '')}
            >
              <Icon name="Copy" size={16} className="mr-1" /> Copy Phone
            </Button>
            <Button size="sm" variant="outline" className="h-9" disabled>
              <Icon name="Calendar" size={16} className="mr-1" /> Schedule
            </Button>
            <Button size="sm" variant="outline" className="h-9" disabled>
              <Icon name="FileText" size={16} className="mr-1" /> Note
            </Button>
            <Button size="sm" variant="outline" className="h-9" disabled>
              <Icon name="CheckCircle" size={16} className="mr-1" /> Complete
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap border ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">{renderContent()}</div>
      </div>
    </>
  )
}
