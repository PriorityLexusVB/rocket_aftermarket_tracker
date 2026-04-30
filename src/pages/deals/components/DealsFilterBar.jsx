// src/pages/deals/components/DealsFilterBar.jsx
// Status tabs, search input, month filter, advanced filter dropdowns, and view toggle.

import React from 'react'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'

const DealsFilterBar = ({
  filters,
  updateFilter,
  clearAllFilters,
  showSheetView,
  setShowSheetView,
  // These are only used inside the hidden advanced filter block (false && ...).
  // Kept as props for backward compatibility if the block is re-enabled.
  vendorOptions,
  salesOptions,
  deliveryOptions,
  financeOptions,
  allWorkTags,
}) => (
  <div className="mb-6 bg-card rounded-lg border border-border p-4">
    {/* Status Tabs */}
    <div className="flex flex-wrap gap-2 mb-4">
      {[
        { value: 'All', label: 'All' },
        { value: 'Open', label: 'Open' },
        { value: 'Draft', label: 'Draft' },
        { value: 'Pending', label: 'Needs Work (time TBD)' },
        { value: 'Scheduled', label: 'Scheduled' },
        { value: 'Active', label: 'Active' },
        { value: 'Completed', label: 'Completed' },
      ]?.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => updateFilter('status', value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${
              filters?.status === value
                ? 'bg-blue-600 text-white border border-blue-600'
                : 'bg-transparent border border-border text-muted-foreground hover:bg-card'
            }`}
        >
          {label}
        </button>
      ))}
    </div>

    {/* Preset Views (hidden per request) */}
    {false && (
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          'All',
          'Today',
          'Past Due',
          'Unscheduled',
          'Off-site Today',
          'Awaiting Vendor/Parts',
          'Completed—awaiting pickup',
          'My Deals',
          'Loaners Out',
          'Loaners Due',
          'Loaners Overdue',
        ]?.map((view) => (
          <button
            key={view}
            onClick={() => updateFilter('presetView', view)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border
              ${
                filters?.presetView === view
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-card'
              }`}
          >
            {view}
          </button>
        ))}
      </div>
    )}

    <div className="flex flex-col lg:flex-row gap-4">
      {/* Search box */}
      <div className="flex-1">
        <div className="relative">
          <Icon
            name="Search"
            size={16}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search deals, customers, vehicles..."
            value={filters?.search}
            onChange={(e) => updateFilter('search', e?.target?.value)}
            className="bg-background border border-border rounded-lg w-full h-11 pl-9 pr-3 text-foreground placeholder:text-gray-500 focus:ring-2 focus:ring-[rgb(var(--ring)/0.35)] focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="deals-month-filter">
          Month
        </label>
        <input
          id="deals-month-filter"
          type="month"
          value={filters?.createdMonth || ''}
          onChange={(e) => updateFilter('createdMonth', e?.target?.value || '')}
          className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => updateFilter('createdMonth', '')}
          className="text-muted-foreground hover:text-foreground"
        >
          All months
        </Button>
      </div>

      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <Icon name="Filter" size={14} /> Filters
        </summary>
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground shadow-lg">
          <label
            className="block text-[11px] font-semibold text-muted-foreground"
            htmlFor="deals-location-filter"
          >
            Location
          </label>
          <select
            id="deals-location-filter"
            className="mt-2 h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            value={filters?.location || 'All'}
            onChange={(e) => updateFilter('location', e?.target?.value || 'All')}
          >
            <option value="All">All</option>
            <option value="In-House">In-House</option>
            <option value="Off-Site">Off-Site</option>
            <option value="Mixed">Mixed</option>
          </select>

          <label
            className="mt-3 block text-[11px] font-semibold text-muted-foreground"
            htmlFor="deals-loaner-filter"
          >
            Loaner
          </label>
          <select
            id="deals-loaner-filter"
            className="mt-2 h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            value={filters?.loanerStatus || 'All'}
            onChange={(e) => updateFilter('loanerStatus', e?.target?.value || 'All')}
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Due Today">Due Today</option>
            <option value="Overdue">Overdue</option>
            <option value="None">None</option>
          </select>
        </div>
      </details>

      {/* Clear Filters */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Clear all filters"
        >
          <Icon name="X" size={16} className="mr-1" />
          Clear
        </Button>
      </div>

      {/* View Toggle (desktop) */}
      <div className="hidden md:flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSheetView(false)}
          className={`h-9 px-3 rounded-md text-xs font-medium border transition-colors ${
            showSheetView
              ? 'bg-card text-muted-foreground border-border'
              : 'bg-blue-600 text-white border-blue-600'
          }`}
          aria-pressed={!showSheetView}
        >
          Card View
        </button>
        <button
          type="button"
          onClick={() => setShowSheetView(true)}
          className={`h-9 px-3 rounded-md text-xs font-medium border transition-colors ${
            showSheetView
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-card text-muted-foreground border-border'
          }`}
          aria-pressed={showSheetView}
        >
          Sheet View
        </button>
      </div>
    </div>

    {/* Advanced filter dropdowns removed; search covers all filtering needs */}
    {false && (
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Vendor */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor</label>
          <select
            className="bg-background border border-border rounded-lg w-full h-11 px-3 text-foreground"
            value={filters.vendor || ''}
            onChange={(e) => updateFilter('vendor', e.target.value || null)}
          >
            <option value="">All</option>
            {vendorOptions.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sales */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Sales</label>
          <select
            className="bg-background border border-border rounded-lg w-full h-11 px-3 text-foreground"
            value={filters.salesAssigned || ''}
            onChange={(e) => updateFilter('salesAssigned', e.target.value || null)}
          >
            <option value="">All</option>
            {salesOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Finance */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Finance</label>
          <select
            className="bg-background border border-border rounded-lg w-full h-11 px-3 text-foreground"
            value={filters.financeAssigned || ''}
            onChange={(e) => updateFilter('financeAssigned', e.target.value || null)}
          >
            <option value="">All</option>
            {financeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Delivery */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Delivery</label>
          <select
            className="bg-background border border-border rounded-lg w-full h-11 px-3 text-foreground"
            value={filters.deliveryAssigned || ''}
            onChange={(e) => updateFilter('deliveryAssigned', e.target.value || null)}
          >
            <option value="">All</option>
            {deliveryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
          <select
            className="bg-background border border-border rounded-lg w-full h-11 px-3 text-foreground"
            value={filters.location}
            onChange={(e) => updateFilter('location', e.target.value)}
          >
            {['All', 'In-House', 'Off-Site', 'Mixed'].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Loaner */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Loaner</label>
          <select
            className="bg-background border border-border rounded-lg w-full h-11 px-3 text-foreground"
            value={filters.loanerStatus}
            onChange={(e) => updateFilter('loanerStatus', e.target.value)}
          >
            {['All', 'Active', 'Due Today', 'Overdue', 'None'].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Promise Date Range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Promise from
            </label>
            <input
              type="date"
              className="bg-background border border-border rounded-lg w-full h-11 px-3 text-foreground"
              value={filters.promiseStartDate}
              onChange={(e) => updateFilter('promiseStartDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Promise to
            </label>
            <input
              type="date"
              className="bg-background border border-border rounded-lg w-full h-11 px-3 text-foreground"
              value={filters.promiseEndDate}
              onChange={(e) => updateFilter('promiseEndDate', e.target.value)}
            />
          </div>
        </div>

        {/* Work tags (multi-select) */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Work tags</label>
          <select
            multiple
            className="bg-background border border-border rounded-lg w-full min-h-[44px] px-3 py-2 text-foreground"
            value={filters.workTags}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
              updateFilter('workTags', selected)
            }}
          >
            {allWorkTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
    )}
  </div>
)

export default DealsFilterBar
