// src/pages/deals/useDealForm.js
import { useCallback, useState, useEffect, useRef } from 'react'
import { dealService, mapDbDealToForm } from '../../services/dealService'

export function useDealForm({ mode = 'create', id = null, onSaved, onError }) {
  const [initial, setInitial] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(mode === 'edit')
  const savingRef = useRef(false)

  // Load existing deal for edit
  useEffect(() => {
    let alive = true
    async function run() {
      if (mode === 'edit' && id) {
        try {
          const d = await dealService?.getDeal(id)
          if (!alive) return
          setInitial(mapDbDealToForm(d))
        } catch (e) {
          console.error(e)
          onError?.(e)
        } finally {
          if (alive) setLoading(false)
        }
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [mode, id, onError])

  const handleSubmit = useCallback(
    async (formState) => {
      if (savingRef.current) {
        return Promise.resolve()
      }
      savingRef.current = true
      setSaving(true)
      try {
        if (mode === 'edit' && id) {
          const updated = await dealService?.updateDeal(id, formState)
          onSaved?.(updated)
        } else {
          const created = await dealService?.createDeal(formState)
          onSaved?.(created)
        }
      } catch (e) {
        console.error(e)
        onError?.(e)
      } finally {
        setSaving(false)
        savingRef.current = false
      }
    },
    [mode, id, onSaved, onError]
  )

  return { initial, loading, handleSubmit, saving }
}
