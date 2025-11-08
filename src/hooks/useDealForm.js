// src/hooks/useDealForm.js
// Minimal local draft state helpers for forms with controlled inputs
import { useCallback, useState } from 'react'

export default function useDealForm(initial = {}) {
  const [form, setForm] = useState({ ...initial })

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const bindField = useCallback(
    (key) => ({
      value: form?.[key] ?? '',
      onChange: (e) => setField(key, e?.target ? e.target.value : e),
    }),
    [form, setField]
  )

  const update = useCallback((updater) => {
    setForm((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }))
  }, [])

  return { form, setForm, setField, bindField, update }
}
