// src/lib/supabase/safeSelect.js
/**
 * Wrap a Postgrest query and make failures loud.
 * @param {any} q Postgrest query builder
 * @param {string} label optional label for logging
 */
export async function safeSelect(q, label) {
  try {
    const res = await q.throwOnError()
    // q.throwOnError() usually returns { data, error, count }
    return res.data ?? res
  } catch (e) {
    // Keep an informative, searchable log
    // eslint-disable-next-line no-console
    console.error(`[safeSelect] ${label ?? 'query'} failed`, e)
    throw e
  }
}

export default safeSelect
