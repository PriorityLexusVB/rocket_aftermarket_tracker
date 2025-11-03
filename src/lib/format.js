// Formatting helpers for currency and percentages
export const money0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

export const money2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export const pct1 = (v) => `${(Number(v) * 100).toFixed(1)}%`

// Title case transformation for names and vehicle descriptions
// Unicode-aware, handles apostrophes and hyphens properly
export const titleCase = (s = '') => {
  if (!s) return ''
  return String(s)
    .toLowerCase()
    .replace(/\b[\p{L}'']+[\p{L}'']*/gu, w => w[0].toUpperCase() + w.slice(1))
}
