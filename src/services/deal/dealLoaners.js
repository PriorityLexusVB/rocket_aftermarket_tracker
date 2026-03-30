// src/services/deal/dealLoaners.js
// All loaner-related functions
import {
  supabase,
  isRlsError,
  isMissingReturnedAtError,
  isMissingColumnError,
  applyReturnedAtIsNullFilter,
  loanerAssignmentsHasDealerId,
  setLoanerAssignmentsDealerIdCapability,
  loanerAssignmentsHasReturnedAt,
  setLoanerAssignmentsReturnedAtCapability,
  getOrgContext,
} from './dealHelpers.js'

// A3: Enhanced UPSERT loaner assignment function
export async function upsertLoanerAssignment(jobId, loanerData, orgId) {
  if (!loanerData?.loaner_number?.trim()) {
    return // No loaner number provided, skip assignment
  }

  try {
    // Check for existing active assignment for this job
    // Use maybeSingle() instead of single() to handle RLS gracefully
    // The RLS policy on loaner_assignments checks through the jobs table
    let existing = null
    let selectError = null

    {
      const base = supabase?.from('loaner_assignments')?.select('id')?.eq('job_id', jobId)
      const withReturnedAt = applyReturnedAtIsNullFilter(base)
      const res =
        withReturnedAt && typeof withReturnedAt.maybeSingle === 'function'
          ? await withReturnedAt.maybeSingle()
          : null
      existing = res?.data || null
      selectError = res?.error || null

      // Some E2E/staging DBs may not have loaner_assignments.returned_at yet.
      // Retry without the filter so loaner persistence can still work.
      if (selectError && isMissingReturnedAtError(selectError)) {
        setLoanerAssignmentsReturnedAtCapability(false)
        const { data, error } = await supabase
          ?.from('loaner_assignments')
          ?.select('id')
          ?.eq('job_id', jobId)
          ?.limit(1)

        selectError = error || null
        if (!selectError && Array.isArray(data) && data.length > 0) {
          existing = { id: data[0]?.id }
        }
      }
    }

    // Handle RLS errors on SELECT gracefully
    if (selectError) {
      if (isRlsError(selectError)) {
        console.warn(
          '[dealService:upsertLoanerAssignment] RLS blocked SELECT - attempting INSERT with job context:',
          selectError?.message
        )
        // Fall through to INSERT path - RLS may allow INSERT even if SELECT is blocked
      } else {
        console.warn('[dealService:upsertLoanerAssignment] SELECT failed:', selectError?.message)
        // Fall through to INSERT path
      }
    }

    const resolvedDealerId = orgId ?? loanerData?.dealer_id ?? loanerData?.org_id ?? null
    // Default to omitting dealer_id to avoid PGRST204 when the column does not exist.
    // Only include when we have positive capability evidence.
    let didUseDealerId = loanerAssignmentsHasDealerId === true && !!resolvedDealerId

    const assignmentData = {
      job_id: jobId,
      // Some RLS policies require tenant scoping on the row itself.
      ...(didUseDealerId ? { dealer_id: resolvedDealerId } : {}),
      loaner_number: loanerData?.loaner_number?.trim(),
      eta_return_date: loanerData?.eta_return_date || null,
      notes: loanerData?.notes?.trim() || null,
    }

    const assignmentDataWithoutDealerId = { ...assignmentData }
    delete assignmentDataWithoutDealerId.dealer_id

    const shouldRetryWithoutDealerId = (err) => {
      if (!err) return false
      // Some environments may not have loaner_assignments.dealer_id yet.
      // If so, retry without that column to preserve backward compatibility.
      const haystack = [err?.message, err?.details, err?.hint].filter(Boolean).join(' ')
      return isMissingColumnError(err) && /\bdealer_id\b/i.test(haystack)
    }

    const shouldRetryWithDealerId = (err) => {
      if (!err) return false
      if (!resolvedDealerId) return false
      if (loanerAssignmentsHasDealerId === false) return false
      const haystack = [err?.message, err?.details, err?.hint].filter(Boolean).join(' ')
      return (
        isRlsError(err) ||
        (/\bdealer_id\b/i.test(haystack) && /not[-\s]?null|violates|null value/i.test(haystack))
      )
    }

    const updateById = async (data) =>
      await supabase?.from('loaner_assignments')?.update(data)?.eq('id', existing?.id)?.select('id')

    const updateByJobId = async (data) => {
      const base = supabase?.from('loaner_assignments')?.update(data)?.eq('job_id', jobId)
      const withReturnedAt = applyReturnedAtIsNullFilter(base)
      const res =
        withReturnedAt && typeof withReturnedAt.select === 'function'
          ? await withReturnedAt.select('id')
          : null

      if (res?.error && isMissingReturnedAtError(res.error)) {
        setLoanerAssignmentsReturnedAtCapability(false)
        return await supabase
          ?.from('loaner_assignments')
          ?.update(data)
          ?.eq('job_id', jobId)
          ?.select('id')
      }

      return res
    }

    const insertRow = async (data) =>
      await supabase?.from('loaner_assignments')?.insert([data])?.select('id')

    if (existing?.id) {
      // Update existing assignment
      let { data: updated, error } = await updateById(assignmentDataWithoutDealerId)

      if (error && shouldRetryWithDealerId(error)) {
        didUseDealerId = true
        ;({ data: updated, error } = await updateById(assignmentData))
      }

      if (error && shouldRetryWithoutDealerId(error)) {
        setLoanerAssignmentsDealerIdCapability(false)
        didUseDealerId = false
        ;({ data: updated, error } = await updateById(assignmentDataWithoutDealerId))
      }

      if (error) {
        if (isRlsError(error)) {
          console.warn(
            '[dealService:upsertLoanerAssignment] RLS blocked UPDATE (non-fatal):',
            error?.message
          )
          return // Silently degrade - loaner data won't be saved but deal save continues
        }
        throw error
      }

      // PostgREST can return 200 OK with 0 rows affected under some RLS/policy setups.
      // Keep behavior non-fatal, but attempt a job-scoped fallback update.
      if (!Array.isArray(updated) || updated.length === 0) {
        let { data: updatedByJobId, error: updByJobErr } = await updateByJobId(
          assignmentDataWithoutDealerId
        )

        if (updByJobErr && shouldRetryWithDealerId(updByJobErr)) {
          didUseDealerId = true
          ;({ data: updatedByJobId, error: updByJobErr } = await updateByJobId(assignmentData))
        }
        if (updByJobErr && shouldRetryWithoutDealerId(updByJobErr)) {
          setLoanerAssignmentsDealerIdCapability(false)
          didUseDealerId = false
          ;({ data: updatedByJobId, error: updByJobErr } = await updateByJobId(
            assignmentDataWithoutDealerId
          ))
        }
        if (updByJobErr) {
          if (isRlsError(updByJobErr)) {
            console.warn(
              '[dealService:upsertLoanerAssignment] RLS blocked fallback UPDATE by job_id (non-fatal):',
              updByJobErr?.message
            )
            return
          }
          throw updByJobErr
        }
        if (!Array.isArray(updatedByJobId) || updatedByJobId.length === 0) {
          console.warn('[dealService:upsertLoanerAssignment] UPDATE affected 0 rows (non-fatal)')
          return
        }
      }
    } else {
      // Create new assignment
      let { data: inserted, error } = await insertRow(assignmentDataWithoutDealerId)

      if (error && shouldRetryWithDealerId(error)) {
        didUseDealerId = true
        ;({ data: inserted, error } = await insertRow(assignmentData))
      }

      if (error && shouldRetryWithoutDealerId(error)) {
        setLoanerAssignmentsDealerIdCapability(false)
        didUseDealerId = false
        ;({ data: inserted, error } = await insertRow(assignmentDataWithoutDealerId))
      }

      if (!error && didUseDealerId) {
        setLoanerAssignmentsDealerIdCapability(true)
      }

      if (!error && (!Array.isArray(inserted) || inserted.length === 0)) {
        console.warn('[dealService:upsertLoanerAssignment] INSERT affected 0 rows (non-fatal)')
        return
      }

      if (error) {
        // Handle duplicate constraint error specifically
        if (error?.code === '23505') {
          // 23505 means the UNIQUE constraint ux_loaner_active was violated
          // This constraint is on (loaner_number) WHERE returned_at IS NULL
          // Two possible causes:
          // 1. This loaner_number is already assigned to THIS job (row exists but SELECT was blocked by RLS)
          // 2. This loaner_number is already assigned to a DIFFERENT job (true conflict)

          // Check the error message to distinguish between the two cases
          const errorMsg = error?.message || ''
          if (errorMsg.includes('ux_loaner_active')) {
            // This is a true duplicate - the loaner is assigned to another job
            // Re-throw as a user-friendly error
            throw new Error(
              `Loaner ${assignmentData.loaner_number} is already assigned to another active job`
            )
          }

          // If it's not the ux_loaner_active constraint, it might be a different constraint
          // Try fallback UPDATE in case row exists for this job_id but SELECT was blocked
          console.warn(
            '[dealService:upsertLoanerAssignment] Duplicate key error, attempting fallback UPDATE by job_id'
          )
          let { data: updatedByJobId, error: updateError } = await updateByJobId(
            assignmentDataWithoutDealerId
          )

          if (updateError && shouldRetryWithDealerId(updateError)) {
            didUseDealerId = true
            ;({ data: updatedByJobId, error: updateError } = await updateByJobId(assignmentData))
          }

          if (updateError && shouldRetryWithoutDealerId(updateError)) {
            setLoanerAssignmentsDealerIdCapability(false)
            didUseDealerId = false
            ;({ data: updatedByJobId, error: updateError } = await updateByJobId(
              assignmentDataWithoutDealerId
            ))
          }

          if (updateError && !isRlsError(updateError)) {
            // If UPDATE also fails, re-throw the original error
            throw error
          }

          if (!updateError && (!Array.isArray(updatedByJobId) || updatedByJobId.length === 0)) {
            console.warn(
              '[dealService:upsertLoanerAssignment] Fallback UPDATE (duplicate) affected 0 rows (non-fatal)'
            )
            return
          }
          return
        }

        if (isRlsError(error)) {
          console.warn(
            '[dealService:upsertLoanerAssignment] RLS blocked INSERT (non-fatal):',
            error?.message
          )
          return // Silently degrade - loaner data won't be saved but deal save continues
        }
        throw error
      }
    }
  } catch (error) {
    // Handle uniqueness constraint error gracefully
    if (error?.code === '23505') {
      console.warn(
        '[dealService:upsertLoanerAssignment] Loaner number already in use (caught at outer level):',
        error?.message
      )
      throw new Error(
        `Loaner ${loanerData?.loaner_number} is already assigned to another active job`
      )
    }
    // Handle RLS errors at the top level
    if (isRlsError(error)) {
      console.warn('[dealService:upsertLoanerAssignment] RLS error (non-fatal):', error?.message)
      return // Silently degrade
    }
    throw error
  }
}

// A3: New function to mark loaner as returned
export async function markLoanerReturned(loanerAssignmentId) {
  try {
    if (!loanerAssignmentId) {
      throw new Error('Missing loaner assignment id')
    }

    // Use direct update instead of RPC function if it doesn't exist
    const nowIso = new Date()?.toISOString()
    const res = await supabase
      ?.from('loaner_assignments')
      ?.update({ returned_at: nowIso })
      ?.eq('id', loanerAssignmentId)
      // IMPORTANT: PostgREST/Supabase can return 200 OK with 0 rows affected (especially under RLS).
      // Selecting a column forces row return so we can detect no-op updates.
      ?.select('id')

    if (res?.error) throw res.error

    const updated = res?.data
    if (!Array.isArray(updated) || updated.length === 0) {
      const err = new Error(
        'Loaner return did not persist (0 rows updated). This usually means the record was not found or access was denied.'
      )
      // Shadow any ambient/prototype `code` (some test/mocks may set it globally)
      // so this local error is never treated as a Postgres/PostgREST RLS error.
      err.code = null
      throw err
    }

    return true
  } catch (error) {
    console.error('Failed to mark loaner as returned:', error)

    // Only treat as an RLS denial when we have a real Postgres/PostgREST error code.
    // (Synthetic/local errors should not be remapped.)
    if (isRlsError(error) && error?.code) {
      throw new Error(
        'Permission denied while marking loaner returned. Ask an admin to verify your access / org assignment.'
      )
    }

    throw new Error(`Failed to mark loaner as returned: ${error?.message}`)
  }
}

// A3: Loaner Management Drawer helpers
// - Centralize Supabase reads so React pages don't import the client directly.
export async function listLoanerAssignmentsForDrawer() {
  try {
    const selectWithReturnedAt = `
      id,
      job_id,
      loaner_number,
      eta_return_date,
      returned_at,
      notes,
      created_at,
      jobs (
        id,
        title,
        customer_needs_loaner,
        transactions (
          customer_name,
          customer_phone
        )
      )
    `

    const selectWithoutReturnedAt = `
      id,
      job_id,
      loaner_number,
      eta_return_date,
      notes,
      created_at,
      jobs (
        id,
        title,
        customer_needs_loaner,
        transactions (
          customer_name,
          customer_phone
        )
      )
    `

    let res = await supabase
      ?.from('loaner_assignments')
      ?.select(selectWithReturnedAt)
      ?.order('created_at', { ascending: false })

    if (res?.error && isMissingReturnedAtError(res.error)) {
      res = await supabase
        ?.from('loaner_assignments')
        ?.select(selectWithoutReturnedAt)
        ?.order('created_at', { ascending: false })

      if (!res?.error) {
        const rows = Array.isArray(res?.data) ? res.data : []
        return rows.map((row) => ({ ...row, returned_at: null }))
      }
    }

    if (res?.error) {
      throw normalizeError(res.error)
    }

    return Array.isArray(res?.data) ? res.data : []
  } catch (error) {
    console.error('[dealService:listLoanerAssignmentsForDrawer] Failed:', error)
    throw new Error(error?.message || 'Failed to load loaner assignments')
  }
}

export async function listJobsNeedingLoanersForDrawer() {
  try {
    const selectWithReturnedAt = `
      id,
      title,
      customer_needs_loaner,
      job_status,
      transactions (
        customer_name,
        customer_phone
      ),
      loaner_assignments (
        id,
        returned_at
      )
    `

    const selectWithoutReturnedAt = `
      id,
      title,
      customer_needs_loaner,
      job_status,
      transactions (
        customer_name,
        customer_phone
      ),
      loaner_assignments (
        id
      )
    `

    let res = null
    if (loanerAssignmentsHasReturnedAt !== false) {
      res = await supabase
        ?.from('jobs')
        ?.select(selectWithReturnedAt)
        ?.eq('customer_needs_loaner', true)
        ?.in('job_status', ['pending', 'in_progress'])
    }

    if (res?.error && isMissingReturnedAtError(res.error)) {
      setLoanerAssignmentsReturnedAtCapability(false)
      res = await supabase
        ?.from('jobs')
        ?.select(selectWithoutReturnedAt)
        ?.eq('customer_needs_loaner', true)
        ?.in('job_status', ['pending', 'in_progress'])

      if (!res?.error) {
        const jobs = Array.isArray(res?.data) ? res.data : []
        const jobsWithoutActiveLoaners = jobs.filter((job) => {
          const assignments = Array.isArray(job?.loaner_assignments) ? job.loaner_assignments : []
          // If we can't read returned_at, treat any assignment as active to avoid double-assigning.
          return assignments.length === 0
        })
        return jobsWithoutActiveLoaners
      }
    }

    if (!res) {
      // returned_at is absent or we skipped the returned_at select; use the no-returned_at selector.
      res = await supabase
        ?.from('jobs')
        ?.select(selectWithoutReturnedAt)
        ?.eq('customer_needs_loaner', true)
        ?.in('job_status', ['pending', 'in_progress'])
    }

    if (res?.error) {
      throw normalizeError(res.error)
    }

    const jobs = Array.isArray(res?.data) ? res.data : []
    const jobsWithoutActiveLoaners = jobs.filter((job) => {
      const assignments = Array.isArray(job?.loaner_assignments) ? job.loaner_assignments : []
      const hasActiveLoaner = assignments.some((la) => !la?.returned_at)
      return !hasActiveLoaner
    })

    return jobsWithoutActiveLoaners
  } catch (error) {
    console.error('[dealService:listJobsNeedingLoanersForDrawer] Failed:', error)
    throw new Error(error?.message || 'Failed to load jobs needing loaners')
  }
}

// A3: Fetch returned loaner assignments for a job (history)
// - Used by the Loaner drawer "Returned" tab.
// - Best-effort: returns [] on RLS denial or missing returned_at column.
export async function getReturnedLoanerAssignmentsForJob(jobId, { limit = 25 } = {}) {
  if (!jobId) return []

  if (loanerAssignmentsHasReturnedAt === false) {
    return []
  }

  try {
    const safeLimit = Number.isFinite(Number(limit))
      ? Math.max(1, Math.min(100, Number(limit)))
      : 25

    let q = supabase
      ?.from('loaner_assignments')
      ?.select('id, loaner_number, eta_return_date, notes, returned_at')
      ?.eq('job_id', jobId)

    // Prefer server-side filtering for returned rows.
    if (q && typeof q.not === 'function') {
      q = q.not('returned_at', 'is', null)
    }

    if (q && typeof q.order === 'function') {
      q = q.order('returned_at', { ascending: false })
    }
    if (q && typeof q.limit === 'function') {
      q = q.limit(safeLimit)
    }

    const res = await q

    if (res?.error) {
      if (isMissingReturnedAtError(res.error)) {
        // Some environments may not have returned_at yet.
        setLoanerAssignmentsReturnedAtCapability(false)
        return []
      }

      if (isRlsError(res.error)) {
        console.warn(
          '[dealService:getReturnedLoanerAssignmentsForJob] RLS blocked loaner history query (non-fatal):',
          res.error?.message
        )
        return []
      }

      throw res.error
    }

    const rows = Array.isArray(res?.data) ? res.data : []

    // If .not() isn't available (some mocks), filter client-side.
    const filtered = q && typeof q.not === 'function' ? rows : rows.filter((r) => !!r?.returned_at)
    return filtered
  } catch (error) {
    console.warn(
      '[dealService:getReturnedLoanerAssignmentsForJob] Failed to load returned loaners (non-fatal):',
      error?.message
    )
    return []
  }
}

// A3: Strict helper for interactive loaner assignment saves
// - Unlike upsertLoanerAssignment() (which degrades silently to avoid blocking deal saves),
//   this version is intended for dedicated UI actions and MUST surface failures.
export async function saveLoanerAssignment(jobId, loanerData) {
  if (!jobId) throw new Error('Missing job id')
  if (!loanerData?.loaner_number?.trim()) throw new Error('Missing loaner number')

  const loanerNumber = loanerData.loaner_number.trim()
  const etaReturnDate = loanerData?.eta_return_date || null
  const notes = loanerData?.notes?.trim() || null

  try {
    const ctx = await getOrgContext('saveLoanerAssignment')

    const shouldRetryWithoutDealerId = (err) => {
      if (!err) return false
      if (!isMissingColumnError(err)) return false
      const haystack = [err?.message, err?.details, err?.hint].filter(Boolean).join(' ')
      return /\bdealer_id\b/i.test(haystack)
    }

    const shouldRetryWithDealerId = (err, resolvedDealerId) => {
      if (!err) return false
      if (!resolvedDealerId) return false
      if (loanerAssignmentsHasDealerId === false) return false
      const haystack = [err?.message, err?.details, err?.hint].filter(Boolean).join(' ')
      return (
        isRlsError(err) ||
        (/\bdealer_id\b/i.test(haystack) && /not[-\s]?null|violates|null value/i.test(haystack))
      )
    }

    // Find existing active assignment for this job
    let existingId = null
    {
      const base = supabase?.from('loaner_assignments')?.select('id')?.eq('job_id', jobId)
      const withReturnedAt = applyReturnedAtIsNullFilter(base)
      let res = await withReturnedAt?.limit?.(1)
      if (res?.error && isMissingReturnedAtError(res.error)) {
        setLoanerAssignmentsReturnedAtCapability(false)
        res = await supabase
          ?.from('loaner_assignments')
          ?.select('id')
          ?.eq('job_id', jobId)
          ?.limit(1)
      }

      if (res?.error) {
        if (isRlsError(res.error)) {
          throw new Error('Permission denied while looking up the loaner assignment.')
        }
        throw new Error(`Failed to look up loaner assignment: ${res.error.message}`)
      }

      const rows = res?.data
      if (Array.isArray(rows) && rows.length > 0) existingId = rows[0]?.id ?? null
    }

    const resolvedDealerId = ctx?.org_id ?? loanerData?.dealer_id ?? loanerData?.org_id ?? null
    let didUseDealerId = loanerAssignmentsHasDealerId === true && !!resolvedDealerId

    const payloadWithOptionalDealerId = {
      job_id: jobId,
      ...(didUseDealerId ? { dealer_id: resolvedDealerId } : {}),
      loaner_number: loanerNumber,
      eta_return_date: etaReturnDate,
      notes,
    }

    const payloadWithoutDealerId = {
      job_id: jobId,
      loaner_number: loanerNumber,
      eta_return_date: etaReturnDate,
      notes,
    }

    const normalizeError = (err) => {
      if (!err) return null
      if (err?.code === '23505') {
        return new Error(`Loaner ${loanerNumber} is already assigned to another active job`)
      }
      if (isRlsError(err)) {
        return new Error('Permission denied while saving the loaner assignment.')
      }
      return new Error(err?.message || String(err))
    }

    if (existingId) {
      // Try UPDATE without dealer_id first to avoid missing-column errors.
      let res = await supabase
        ?.from('loaner_assignments')
        ?.update(payloadWithoutDealerId)
        ?.eq('id', existingId)
        ?.select('id')

      if (res?.error && shouldRetryWithDealerId(res.error, resolvedDealerId)) {
        didUseDealerId = true
        res = await supabase
          ?.from('loaner_assignments')
          ?.update(payloadWithOptionalDealerId)
          ?.eq('id', existingId)
          ?.select('id')
      }

      if (res?.error && shouldRetryWithoutDealerId(res.error)) {
        setLoanerAssignmentsDealerIdCapability(false)
        didUseDealerId = false
        res = await supabase
          ?.from('loaner_assignments')
          ?.update(payloadWithoutDealerId)
          ?.eq('id', existingId)
          ?.select('id')
      }

      if (!res?.error && didUseDealerId) {
        setLoanerAssignmentsDealerIdCapability(true)
      }

      if (res?.error) throw normalizeError(res.error)
      if (!Array.isArray(res?.data) || res.data.length === 0) {
        throw new Error(
          'Loaner assignment save did not persist (0 rows updated). This usually means access was denied.'
        )
      }

      return true
    }

    // Insert new assignment
    let res = await supabase
      ?.from('loaner_assignments')
      ?.insert([payloadWithoutDealerId])
      ?.select('id')

    if (res?.error && shouldRetryWithDealerId(res.error, resolvedDealerId)) {
      didUseDealerId = true
      res = await supabase
        ?.from('loaner_assignments')
        ?.insert([payloadWithOptionalDealerId])
        ?.select('id')
    }

    if (res?.error && shouldRetryWithoutDealerId(res.error)) {
      setLoanerAssignmentsDealerIdCapability(false)
      didUseDealerId = false
      res = await supabase
        ?.from('loaner_assignments')
        ?.insert([payloadWithoutDealerId])
        ?.select('id')
    }

    if (!res?.error && didUseDealerId) {
      setLoanerAssignmentsDealerIdCapability(true)
    }

    if (res?.error) throw normalizeError(res.error)
    if (!Array.isArray(res?.data) || res.data.length === 0) {
      throw new Error(
        'Loaner assignment save did not persist (0 rows inserted). This usually means access was denied.'
      )
    }

    return true
  } catch (error) {
    console.error('[dealService:saveLoanerAssignment] Failed:', error)
    throw new Error(`Failed to save loaner assignment: ${error?.message}`)
  }
}
