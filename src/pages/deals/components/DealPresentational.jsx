// src/pages/deals/components/DealPresentational.jsx
// Small, self-contained presentational components extracted from the deals index page.

import React, { useState } from 'react'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import { formatEtMonthDay } from '../../../utils/scheduleDisplay'
import { getDealFinancials } from '../../../utils/dealKpis'
import {
  formatMoney0OrDash,
  getDealVehicleDisplay,
  getDealNumberDisplay,
  getDealDateDisplay,
  getDealProductLabelSummary,
  getSheetCategoryFlags,
  getSheetDateLabel,
  getSheetSalesLabel,
  getSheetTrackingRef,
} from './dealHelpers'

// ── StatusPill ──────────────────────────────────────────────────────

export const StatusPill = ({ status }) => {
  const statusColors = {
    draft: 'bg-accent/50 text-foreground',
    pending: 'bg-blue-500/10 text-blue-200',
    in_progress: 'bg-amber-500/10 text-amber-200',
    completed: 'bg-emerald-500/10 text-emerald-200',
    cancelled: 'bg-red-500/10 text-red-200',
  }
  const color = statusColors?.[status] || 'bg-accent/50 text-foreground'
  const displayStatus = status?.replace('_', ' ')?.toUpperCase() || 'UNKNOWN'

  return <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>{displayStatus}</span>
}

// ── LoanerBadge ─────────────────────────────────────────────────────

export const LoanerBadge = ({ deal }) => {
  const dueShort = deal?.loaner_eta_return_date
    ? formatEtMonthDay(deal.loaner_eta_return_date)
    : null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/50 text-foreground border border-border">
      <Icon name="Car" size={12} className="mr-1" />
      {deal?.loaner_number ? `#${deal.loaner_number}` : 'Loaner'}
      {dueShort ? ` • Due ${dueShort}` : ''}
    </span>
  )
}

// ── Pill ────────────────────────────────────────────────────────────

export const Pill = ({ children, className = '' }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-accent/50 text-foreground ${className}`}
  >
    {children}
  </span>
)

// ── CustomerDisplay ─────────────────────────────────────────────────

export const CustomerDisplay = ({ deal }) => {
  if (!deal) return <span className="text-sm text-muted-foreground">—</span>

  const rawName =
    deal?.customer_name ||
    deal?.customerName ||
    deal?.vehicle?.owner_name ||
    deal?.customer_email ||
    deal?.customerEmail ||
    '—'
  const name = rawName
  const email = deal?.customer_email || deal?.customerEmail || deal?.vehicle?.owner_email || ''
  const tags = Array.isArray(deal?.work_tags) ? deal.work_tags : []
  const title = [name, email, tags.length ? `Tags: ${tags.join(', ')}` : null]
    .filter(Boolean)
    .join(' • ')

  return (
    <div className="flex flex-col gap-1" title={title}>
      <span
        className="text-sm font-medium text-foreground"
        data-testid={deal?.id ? `deal-customer-name-${deal.id}` : 'deal-customer-name'}
      >
        {name}
      </span>
      {email ? (
        <span
          className="text-xs text-gray-500"
          data-testid={deal?.id ? `deal-customer-email-${deal.id}` : 'deal-customer-email'}
        >
          {email}
        </span>
      ) : null}
      {tags.length ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-accent/50 px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ── ServiceLocationTag ──────────────────────────────────────────────

export const ServiceLocationTag = ({ jobParts }) => {
  const hasOffSiteItems = jobParts?.some((part) => part?.is_off_site)
  const hasOnSiteItems = jobParts?.some((part) => !part?.is_off_site)

  if (hasOffSiteItems && hasOnSiteItems) {
    return (
      <div className="flex flex-col space-y-1">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-accent/50 text-foreground border border-border">
          Off-Site
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-accent/50 text-foreground border border-border">
          On-Site
        </span>
      </div>
    )
  }

  if (hasOffSiteItems) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-accent/50 text-foreground border border-border">
        Off-Site
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-accent/50 text-foreground border border-border">
      On-Site
    </span>
  )
}

// ── DraftReminderBanner ─────────────────────────────────────────────

export const DraftReminderBanner = ({ draftsCount, onViewDrafts }) => {
  const [dismissed, setDismissed] = useState(false)

  if (draftsCount === 0 || dismissed) return null

  return (
    <div
      className="mb-6 p-4 rounded-lg border"
      style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)', color: '#FCD34D' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Icon name="AlertCircle" size={20} style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <p className="font-medium">Draft – needs details</p>
            <p className="text-sm">
              You have {draftsCount} draft deal{draftsCount > 1 ? 's' : ''} to complete.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onViewDrafts}
            style={{ color: '#FCD34D' }}
            className="hover:bg-yellow-500/10"
            aria-label="View draft deals"
          >
            View drafts
          </Button>
          <button onClick={() => setDismissed(true)} className="p-1" style={{ color: '#FCD34D' }}>
            <Icon name="X" size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ErrorAlert ──────────────────────────────────────────────────────

export const ErrorAlert = ({ message, onClose }) => {
  if (!message) return null

  return (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex justify-between items-start">
        <div className="flex">
          <Icon name="AlertCircle" size={20} className="text-red-500 mr-2 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-red-800">Error</h4>
            <p className="text-sm text-red-700 mt-1">{message}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-red-400 hover:text-red-600"
            aria-label="Dismiss error"
          >
            <Icon name="X" size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── DealCoreSnapshot ────────────────────────────────────────────────

export const DealCoreSnapshot = ({ deal }) => {
  if (!deal) return null

  const fin = getDealFinancials(deal)
  const vehicle = getDealVehicleDisplay(deal)
  const customer =
    deal?.customer_name || deal?.customerName || deal?.vehicle?.owner_name || deal?.customer_email || '—'
  const dealNumber = getDealNumberDisplay(deal)
  const dateLabel = getDealDateDisplay(deal)
  const productSummary = getDealProductLabelSummary(deal, 4)
  const itemsBought =
    productSummary.labels.length > 0
      ? `${productSummary.labels.join(', ')}${productSummary.extraCount ? ` +${productSummary.extraCount}` : ''}`
      : '—'

  return (
    <div
      className="rounded-lg border border-border bg-card px-3 py-2"
      data-testid={deal?.id ? `deal-core-snapshot-${deal.id}` : 'deal-core-snapshot'}
    >
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Customer</div>
          <div className="truncate font-semibold text-foreground" title={customer}>
            {customer}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Vehicle</div>
          <div className="truncate font-semibold text-foreground" title={vehicle?.title || ''}>
            {vehicle?.isMissing ? '—' : vehicle?.main}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Date</div>
          <div className="font-semibold tabular-nums text-foreground">{dateLabel}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Deal #</div>
          <div className="truncate font-semibold tabular-nums text-foreground" title={dealNumber}>
            {dealNumber}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Profit</div>
          <div className="font-semibold tabular-nums text-foreground">
            {formatMoney0OrDash(fin?.profit)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Items Bought</div>
          <div className="truncate font-semibold text-foreground" title={itemsBought}>
            {itemsBought}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SheetSummaryRow ─────────────────────────────────────────────────

export const SheetSummaryRow = ({ deal, dense = false }) => {
  const { flags, additionalLabel } = getSheetCategoryFlags(deal)
  const fin = getDealFinancials(deal)
  const dateLabel = getSheetDateLabel(deal)
  const salesLabel = getSheetSalesLabel(deal)
  const trackingRef = getSheetTrackingRef(deal)

  const flagBadge = (isOn, label) => (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        isOn
          ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30'
          : 'bg-card text-gray-500 border-border'
      }`}
    >
      {label}
    </span>
  )

  return (
    <div
      className={`grid gap-2 text-xs text-muted-foreground ${
        dense
          ? 'grid-cols-2 sm:grid-cols-3'
          : 'grid-cols-12 items-start rounded-lg border border-border bg-card px-3 py-2'
      }`}
      data-testid={deal?.id ? `deal-core-snapshot-${deal.id}` : 'deal-core-snapshot'}
    >
      <div className={dense ? 'min-w-0' : 'col-span-2'}>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">Date</div>
        <div className="font-semibold tabular-nums">{dateLabel}</div>
      </div>
      <div className={dense ? 'min-w-0' : 'col-span-3'}>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">Categories</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {flagBadge(flags.exterior, 'Ext')}
          {flagBadge(flags.interior, 'Int')}
          {flagBadge(flags.windshield, 'WS')}
          {flagBadge(flags.rg, 'RG')}
        </div>
      </div>
      <div className={dense ? 'min-w-0' : 'col-span-3'}>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">Additional</div>
        <div className="truncate" title={additionalLabel}>
          {additionalLabel}
        </div>
      </div>
      <div className={dense ? 'min-w-0' : 'col-span-2'}>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">Sales</div>
        <div className="truncate" title={salesLabel}>
          {salesLabel}
        </div>
      </div>
      <div className={dense ? 'min-w-0' : 'col-span-2'}>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">Tracking</div>
        <div className="truncate" title={trackingRef}>
          {trackingRef}
        </div>
      </div>
      <div className={dense ? 'min-w-0' : 'col-span-12'}>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">
          Price / Cost / Gross
        </div>
        <div className="flex flex-wrap gap-2 font-semibold tabular-nums">
          <span>S {formatMoney0OrDash(fin.sale)}</span>
          <span>C {formatMoney0OrDash(fin.cost)}</span>
          <span>P {formatMoney0OrDash(fin.profit)}</span>
        </div>
      </div>
    </div>
  )
}

// ── SheetViewTable ──────────────────────────────────────────────────

export const SheetViewTable = ({ deals = [], onRowClick }) => {
  const renderCheck = (value) => (value ? '✓' : '—')

  return (
    <div className="bg-card rounded-lg border border-border overflow-x-auto">
      <table className="min-w-[1100px] w-full text-xs">
        <thead className="bg-card text-muted-foreground uppercase text-[11px] tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Date</th>
            <th className="px-3 py-2 text-left font-semibold">Customer</th>
            <th className="px-3 py-2 text-left font-semibold">Vehicle</th>
            <th className="px-3 py-2 text-center font-semibold">Exterior</th>
            <th className="px-3 py-2 text-center font-semibold">Interior</th>
            <th className="px-3 py-2 text-center font-semibold">Windshield</th>
            <th className="px-3 py-2 text-center font-semibold">RG</th>
            <th className="px-3 py-2 text-left font-semibold">Additional Package</th>
            <th className="px-3 py-2 text-right font-semibold">Price</th>
            <th className="px-3 py-2 text-right font-semibold">Cost</th>
            <th className="px-3 py-2 text-right font-semibold">Gross</th>
            <th className="px-3 py-2 text-left font-semibold">Sales</th>
            <th className="px-3 py-2 text-left font-semibold">Tracking</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {deals.map((deal) => {
            const fin = getDealFinancials(deal)
            const { flags, additionalLabel } = getSheetCategoryFlags(deal)
            const vehicle = getDealVehicleDisplay(deal)
            const customer =
              deal?.customer_name || deal?.vehicle?.owner_name || deal?.customerEmail || '—'

            return (
              <tr
                key={deal?.id}
                data-testid={`sheet-row-${deal?.id}`}
                className="hover:bg-accent/10 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => onRowClick?.(deal)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onRowClick?.(deal)
                  }
                }}
              >
                <td className="px-3 py-2 text-muted-foreground tabular-nums">{getSheetDateLabel(deal)}</td>
                <td className="px-3 py-2 text-foreground" title={customer}>
                  {customer}
                </td>
                <td className="px-3 py-2 text-muted-foreground" title={vehicle?.title || ''}>
                  {vehicle?.main || '—'}
                </td>
                <td className="px-3 py-2 text-center" data-testid={`sheet-${deal?.id}-exterior`}>
                  {renderCheck(flags.exterior)}
                </td>
                <td className="px-3 py-2 text-center" data-testid={`sheet-${deal?.id}-interior`}>
                  {renderCheck(flags.interior)}
                </td>
                <td className="px-3 py-2 text-center" data-testid={`sheet-${deal?.id}-windshield`}>
                  {renderCheck(flags.windshield)}
                </td>
                <td className="px-3 py-2 text-center" data-testid={`sheet-${deal?.id}-rg`}>
                  {renderCheck(flags.rg)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{additionalLabel}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {formatMoney0OrDash(fin.sale)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {formatMoney0OrDash(fin.cost)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {formatMoney0OrDash(fin.profit)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{getSheetSalesLabel(deal)}</td>
                <td className="px-3 py-2 text-muted-foreground tabular-nums">
                  {getSheetTrackingRef(deal)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── DeleteConfirmModal ──────────────────────────────────────────────

export const DeleteConfirmModal = ({ deleteConfirm, error, deletingDeal, onDelete, onCancel }) => {
  if (!deleteConfirm) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto p-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Delete Deal</h3>
          <p className="text-muted-foreground mb-6">
            Delete deal and its line items? This cannot be undone.
          </p>
          {!!error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded">
              <div className="text-sm text-red-200">{error}</div>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 h-11 bg-card border border-border text-foreground 0"
              aria-label="Cancel deletion"
              disabled={deletingDeal}
            >
              Cancel
            </Button>
            <Button
              onClick={() => onDelete(deleteConfirm?.id)}
              className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
              aria-label="Confirm deletion"
              disabled={deletingDeal}
            >
              {deletingDeal ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
