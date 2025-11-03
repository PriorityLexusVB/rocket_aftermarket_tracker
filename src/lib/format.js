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
// Preserves acronyms (all-caps words with 2+ letters)
export const titleCase = (s = '') => {
  if (!s) return ''
  const original = String(s).trim()
  
  return original
    .split(/\s+/)
    .map(word => {
      // Preserve acronyms (2+ uppercase letters, no lowercase)
      if (word.length >= 2 && word === word.toUpperCase()) {
        return word
      }
      // Apply title case to normal words
      return word.toLowerCase().replace(/\b[\p{L}'']+/gu, w => w[0].toUpperCase() + w.slice(1))
    })
    .join(' ')
}
