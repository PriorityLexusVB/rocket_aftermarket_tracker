import React from 'react'

const KpiRow = ({ active, revenue, profit, margin, pending }) => {
  // Sanitize values to prevent NaN/undefined display
  const sanitizeValue = (value, defaultValue = '0') => {
    if (value === null || value === undefined || value === '') {
      return defaultValue
    }
    if (Number?.isNaN(value) || value === 'NaN') {
      return defaultValue
    }
    if (value === Infinity || value === -Infinity) {
      return defaultValue
    }
    if (typeof value === 'string' && value?.toLowerCase() === 'undefined') {
      return defaultValue
    }
    return value?.toString?.() || defaultValue
  }

  // Format currency with commas, no decimals
  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  const Item = ({ label, value, suffix = '' }) => (
    <div className="kpi bg-gray-50 p-4 rounded-lg">
      <div className="label text-sm text-gray-600 font-medium mb-1">{label}</div>
      <div className="value text-2xl font-bold text-gray-900 tabular-nums">
        {sanitizeValue(value)}
        {suffix}
      </div>
    </div>
  )

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Item label="Active Jobs" value={sanitizeValue(active)} />
      <Item label="Revenue" value={`$${formatCurrency(revenue)}`} />
      <Item label="Profit" value={`$${formatCurrency(profit)}`} />
      <Item label="Margin" value={sanitizeValue(margin, '0')} suffix="%" />
      <Item label="Pending" value={sanitizeValue(pending)} />
    </div>
  )
}

export default KpiRow
