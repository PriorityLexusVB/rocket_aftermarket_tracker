import { useEffect } from 'react'

// Minimal client-side guard to warn on internal link clicks and back/forward nav
export default function UnsavedChangesGuard({ isDirty, isSubmitting }) {
  useEffect(() => {
    if (!isDirty || isSubmitting) return

    const onClickCapture = (e) => {
      // Only intercept left-clicks without modifier keys
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)
        return
      // Find closest anchor
      const a = e.target.closest ? e.target.closest('a[href]') : null
      if (!a) return
      // Ignore new-tab or external
      if (a.target === '_blank') return
      const href = a.getAttribute('href') || ''
      if (!href) return
      // Same origin heuristic
      const isExternal = /^(https?:)?\/\//i.test(href)
      if (isExternal) return
      // Prompt
      const ok = window.confirm('You have unsaved changes. Discard them?')
      if (!ok) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const onPopState = (e) => {
      // Prompt on back/forward
      const ok = window.confirm('You have unsaved changes. Discard them?')
      if (!ok) {
        // revert navigation
        history.go(1)
      }
    }

    document.addEventListener('click', onClickCapture, true)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('popstate', onPopState)
    }
  }, [isDirty, isSubmitting])

  return null
}
