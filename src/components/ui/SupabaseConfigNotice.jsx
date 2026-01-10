import React from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function SupabaseConfigNotice({ className = '' }) {
  const navigate = useNavigate()
  const configured = !!isSupabaseConfigured?.()

  if (configured) return null

  return (
    <div
      role="alert"
      className={`rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 ${className}`}
      data-testid="supabase-config-notice"
    >
      <div className="text-sm font-medium">Supabase isn’t configured for this dev server.</div>
      <div className="mt-1 text-xs text-amber-900">
        These screens will be empty until you set{' '}
        <span className="font-mono">VITE_SUPABASE_URL</span> and{' '}
        <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> in{' '}
        <span className="font-mono">.env.local</span>, then restart the dev server.
      </div>
      {import.meta.env.DEV ? (
        <button
          type="button"
          className="mt-2 text-xs font-medium underline underline-offset-2"
          onClick={() => navigate('/debug-auth')}
        >
          Open debug-auth
        </button>
      ) : null}
    </div>
  )
}
