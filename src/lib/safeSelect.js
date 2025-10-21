// src/lib/safeSelect.js
// Wrapper helpers around Supabase queries to make error handling loud and consistent.
export function safeSelect(query) {
  if (!query) {
    throw new Error('safeSelect: query is required')
  }

  // Provide a fluent helper that calls .throwOnError() and surfaces errors.
  const wrapped = {
    async exec() {
      try {
        const res = await query
        // If underlying SDK returns error in object, rethrow for consistency
        if (res?.error) {
          console.error('safeSelect: supabase error', res.error)
          throw res.error
        }
        return res
      } catch (err) {
        // Log and rethrow so callers can .catch or let it bubble
        console.error('safeSelect caught error:', err)
        throw err
      }
    },
    // convenience passthrough for existing callsites that expect .throwOnError()
    throwOnError() {
      // return a promise that either resolves data or throws the error
      return (async () => {
        const { data, error } = await query
        if (error) {
          console.error('safeSelect.throwOnError supabase error:', error)
          throw error
        }
        return { data }
      })()
    },
  }

  return wrapped
}

export default safeSelect
