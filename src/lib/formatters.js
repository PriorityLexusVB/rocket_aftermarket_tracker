// src/lib/formatters.js
// Currency and number formatting utilities

/**
 * Format currency with no decimal places
 * @param {number|null|undefined} n - The number to format
 * @returns {string} Formatted currency string or '—' for null/undefined
 */
export function formatCurrency0(n) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/**
 * Format currency with 2 decimal places
 * @param {number|null|undefined} n - The number to format
 * @returns {string} Formatted currency string or '—' for null/undefined
 */
export function formatCurrency2(n) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format number with commas
 * @param {number|null|undefined} n - The number to format
 * @returns {string} Formatted number string or '—' for null/undefined
 */
export function formatNumber(n) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-US')
}
