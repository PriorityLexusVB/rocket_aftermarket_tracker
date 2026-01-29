// Shared KPI computation for deals.
// Goal: keep KPI numbers consistent across Deals, Analytics, and future Dashboard.

const toFiniteNumberOrNull = (value) => {
  if (value == null) return null
  const num = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(num) ? num : null
}

const sumPartsTotal = (parts) => {
  if (!Array.isArray(parts)) return null
  const total = parts.reduce((sum, part) => {
    const totalPrice = toFiniteNumberOrNull(part?.total_price)
    if (totalPrice != null) return sum + totalPrice

    const qty = toFiniteNumberOrNull(part?.quantity_used ?? part?.quantity) ?? 0
    const unit = toFiniteNumberOrNull(part?.unit_price ?? part?.price) ?? 0
    return sum + qty * unit
  }, 0)

  return Number.isFinite(total) ? total : null
}

export const getDealFinancials = (deal) => {
  const sale =
    toFiniteNumberOrNull(deal?.total_amount) ??
    toFiniteNumberOrNull(deal?.transaction_total) ??
    sumPartsTotal(deal?.job_parts)

  const costDirect =
    toFiniteNumberOrNull(deal?.actual_cost) ??
    toFiniteNumberOrNull(deal?.estimated_cost) ??
    toFiniteNumberOrNull(deal?.total_cost)

  const profitDirect = toFiniteNumberOrNull(deal?.profit_amount)

  let cost = costDirect
  if (cost == null && sale != null && profitDirect != null) cost = sale - profitDirect

  let profit = sale != null && cost != null ? sale - cost : profitDirect

  if (typeof profit === 'number' && Math.abs(profit) < 0.005) profit = 0
  if (typeof cost === 'number' && Math.abs(cost) < 0.005) cost = 0

  return { sale, cost, profit }
}

export const calculateDealKPIs = (dealsData) => {
  const safeDeals = Array.isArray(dealsData) ? dealsData : []

  const activeJobs = safeDeals.filter((d) => d?.job_status === 'in_progress').length
  const pendingJobs = safeDeals.filter((d) => d?.job_status === 'pending').length
  const totalDrafts = safeDeals.filter((d) => d?.job_status === 'draft').length

  const totalRevenue = safeDeals.reduce((sum, deal) => {
    const revenue = toFiniteNumberOrNull(deal?.total_amount) ?? 0
    return sum + revenue
  }, 0)

  // Profit and margin are only meaningful when underlying deal profit is known.
  // If any deal has revenue but missing cost/profit inputs, surface as "unknown" (blank)
  // so UI can render as an em-dash instead of $0.
  let hasUnknownProfit = false
  const totalProfit = safeDeals.reduce((sum, deal) => {
    const fin = getDealFinancials(deal)
    const sale = toFiniteNumberOrNull(fin?.sale)
    const profit = toFiniteNumberOrNull(fin?.profit)

    if (sale != null && profit == null) {
      hasUnknownProfit = true
      return sum
    }

    return sum + (profit ?? 0)
  }, 0)

  const margin = !hasUnknownProfit && totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null

  return {
    active: activeJobs,
    revenue: Number.isFinite(totalRevenue) ? totalRevenue.toFixed(2) : '0.00',
    profit: hasUnknownProfit ? '' : Number.isFinite(totalProfit) ? totalProfit.toFixed(2) : '0.00',
    margin:
      hasUnknownProfit || margin == null ? '' : Number.isFinite(margin) ? margin.toFixed(1) : '0.0',
    pending: pendingJobs,
    drafts: totalDrafts,
  }
}
