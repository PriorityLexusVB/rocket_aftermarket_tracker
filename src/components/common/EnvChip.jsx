import React from 'react'
import { isTest } from '../../lib/env'

const PROD_REF = 'ogjtmtndgiqqdtwatsue'

const getSupabaseRef = (supabaseUrl) => {
  if (!supabaseUrl) return { ref: '', suffix: '' }

  try {
    const host = new URL(supabaseUrl).hostname
    const match = host.match(/^([a-z0-9]{20})\./i)
    const ref = match ? match[1] : ''
    return { ref, suffix: ref ? ref.slice(-6) : '' }
  } catch {
    return { ref: '', suffix: '' }
  }
}

const resolveEnvLabel = ({ hasUrl, ref }) => {
  if (!hasUrl) return 'LOCAL'
  if (ref === PROD_REF) return 'PROD'
  if (import.meta.env.PROD) return 'PREVIEW'
  return 'TEST'
}

const toneByLabel = {
  PROD: 'bg-red-100 text-red-800 border-red-200',
  PREVIEW: 'bg-blue-100 text-blue-800 border-blue-200',
  TEST: 'bg-amber-100 text-amber-900 border-amber-200',
  LOCAL: 'bg-gray-100 text-gray-700 border-gray-200',
}

const EnvChip = ({ className = '' }) => {
  if (isTest) return null

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const { ref, suffix } = getSupabaseRef(supabaseUrl)
  const label = resolveEnvLabel({ hasUrl: !!supabaseUrl, ref })
  const tone = toneByLabel[label] || toneByLabel.TEST
  const suffixLabel = suffix ? `…${suffix}` : '…local'

  return (
    <div
      className={`pointer-events-none inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone} ${className}`}
      aria-label={`Environment ${label}`}
      title={`Environment ${label}`}
    >
      <span>ENV</span>
      <span>{label}</span>
      <span className="normal-case">{suffixLabel}</span>
    </div>
  )
}

export default EnvChip
