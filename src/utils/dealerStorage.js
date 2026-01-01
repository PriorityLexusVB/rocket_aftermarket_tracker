export function persistDealerId(dealerId, ownerId) {
  try {
    if (typeof localStorage === 'undefined') return
    if (dealerId) {
      localStorage.setItem('dealerId', dealerId)
      if (ownerId) localStorage.setItem('dealerOwnerId', ownerId)
    } else {
      localStorage.removeItem('dealerId')
      localStorage.removeItem('dealerOwnerId')
    }
  } catch {
    // non-fatal
  }
}

export function readDealerId(expectedUserId) {
  try {
    if (typeof localStorage === 'undefined') return null
    const stored = localStorage.getItem('dealerId')
    const storedOwner = localStorage.getItem('dealerOwnerId')
    if (expectedUserId && storedOwner && storedOwner !== expectedUserId) return null
    return stored && stored.trim() ? stored : null
  } catch {
    return null
  }
}
