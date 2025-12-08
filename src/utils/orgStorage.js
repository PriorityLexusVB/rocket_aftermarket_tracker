export function persistOrgId(orgId, ownerId) {
  try {
    if (typeof localStorage === 'undefined') return
    if (orgId) {
      localStorage.setItem('orgId', orgId)
      if (ownerId) localStorage.setItem('orgOwnerId', ownerId)
    } else {
      localStorage.removeItem('orgId')
      localStorage.removeItem('orgOwnerId')
    }
  } catch {
    // non-fatal
  }
}

export function readOrgId(expectedUserId) {
  try {
    if (typeof localStorage === 'undefined') return null
    const stored = localStorage.getItem('orgId')
    const storedOwner = localStorage.getItem('orgOwnerId')
    if (expectedUserId && storedOwner && storedOwner !== expectedUserId) return null
    return stored && stored.trim() ? stored : null
  } catch {
    return null
  }
}
