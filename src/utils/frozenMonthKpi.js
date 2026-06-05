// Wave XXX-V frozen-month KPI math, extracted for unit testability.
// Codex post-XXX-V test-gap analysis: dashboard inline math was untestable;
// writing the test surfaced a real bug — the original code excluded cross-month
// reversed deals from the gross count, breaking frozen-month accounting.
//
// Wave XXX-Y browser-tester catch: the original dashboard query referenced
// `canonical_date` and `deal_date` as if they were real columns on `jobs`.
// THEY ARE NOT. The design doc spec described canonical_date as a CONCEPT:
// COALESCE(promised_date, scheduled_start_time, created_at).
// Helper now accepts either pre-computed canonical_date OR raw component
// columns and computes it inline via the same COALESCE rule.
//
// THE FROZEN-MONTH MODEL:
//   A deal sold on Oct 28, reversed on Nov 3, must:
//     - Stay in October's gross at 1 (the sale is FROZEN against future reversal)
//     - Show as a -1 reversal LINE in November (the reversal HAPPENED in Nov)
//     - October's net = 1; November's net = (Nov gross) - 1
//
//   This matches CDK/Reynolds/dealer accounting: chargebacks hit the next pay
//   period, never retroactive. October's commission paystub doesn't get rewritten
//   because a Nov 3 reversal happened.
//
// MATH:
//   For the queried month [monthStart, monthEnd):
//   - gross = count of rows where canonical_date in month, AND
//             EITHER status != 'reversed'
//             OR (status = 'reversed' AND reversed_at NOT in month — cross-month)
//   - reversalsThisMonth = count of rows where status='reversed' AND reversed_at in month
//                          (regardless of which month they were originally sold)
//   - net = gross - reversalsThisMonth
//
// PARENT QUERY (see dashboard/index.jsx):
//   Fetches rows where canonical_date in month OR reversed_at in month, so both
//   the same-month-reversal subtraction AND the cross-month-reversal preservation
//   land in the same row set.

/**
 * @typedef {Object} JobLikeRow
 * @property {string|null} [canonical_date]
 * @property {string|null} [promised_date]
 * @property {string|null} [scheduled_start_time]
 * @property {string|null} [created_at]
 * @property {string|null} [reversed_at]
 * @property {string} [job_status]
 */

/**
 * Compute the canonical-sale-date for a job row.
 * Matches the design doc spec: COALESCE(promised_date, scheduled_start_time, created_at).
 * If the row already has a canonical_date (e.g., synthesized server-side), use it.
 * @param {JobLikeRow} r
 * @returns {string|null}
 */
export function canonicalDateOf(r) {
  if (!r) return null
  return r.canonical_date || r.promised_date || r.scheduled_start_time || r.created_at || null
}

/**
 * @param {Array<JobLikeRow>} rows
 * @param {Date} monthStart  inclusive ET-month start
 * @param {Date} monthEnd    exclusive ET-month end
 * @returns {{gross: number, reversalsThisMonth: number, net: number}}
 */
export function calculateMtdFrozenKpi(rows, monthStart, monthEnd) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { gross: 0, reversalsThisMonth: 0, net: 0 }
  }
  const startMs = monthStart instanceof Date ? monthStart.getTime() : new Date(monthStart).getTime()
  const endMs = monthEnd instanceof Date ? monthEnd.getTime() : new Date(monthEnd).getTime()

  const inMonth = (raw) => {
    if (!raw) return false
    const t = new Date(raw).getTime()
    return Number.isFinite(t) && t >= startMs && t < endMs
  }

  const gross = rows.reduce((acc, r) => {
    const cd = canonicalDateOf(r)
    if (!inMonth(cd)) return acc
    // Sold this month, NOT reversed → count.
    if (r.job_status !== 'reversed') return acc + 1
    // Sold this month, reversed — only count if the reversal landed in a
    // DIFFERENT month (frozen-month preservation). Same-month reversals
    // subtract via the reversalsThisMonth path; preserving them here would
    // double-count.
    if (!r.reversed_at) return acc + 1  // edge case: reversed but no audit
    return inMonth(r.reversed_at) ? acc : acc + 1
  }, 0)

  const reversalsThisMonth = rows.reduce((acc, r) => {
    if (r?.job_status !== 'reversed') return acc
    if (!inMonth(r?.reversed_at)) return acc
    return acc + 1
  }, 0)

  return {
    gross,
    reversalsThisMonth,
    net: gross - reversalsThisMonth,
  }
}
