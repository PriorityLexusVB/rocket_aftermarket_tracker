export function withTimeout(promise, ms, { label } = {}) {
  const timeoutMs = Number(ms)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.resolve(promise)

  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`${label || 'operation'} timed out after ${timeoutMs}ms`)
      err.name = 'TimeoutError'
      reject(err)
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}
