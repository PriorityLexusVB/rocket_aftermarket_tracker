import React, { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Button, Input } from '@/components/ui'
import { isSupabaseConfigured } from '@/lib/supabase'
import { authService } from '@/services/authService'
import { useAuth } from '../../../contexts/AuthContext'

// Minimum new-password length — matches the recovery flow on /reset-password.
const MIN_PASSWORD_LENGTH = 12

// Lazily-created, module-level verification client. Created at most once so there
// is only ever a single GoTrueClient for the 'rocket-pw-verify' storageKey — this
// avoids the "Multiple GoTrueClient instances detected" console warning that a
// per-submit createClient would emit on retries. persistSession:false keeps it in
// isolated in-memory storage, so it never touches the main client's persisted
// session or fires the main onAuthStateChange listener.
let probeClient
function getProbeClient() {
  if (probeClient) return probeClient
  const url = import.meta?.env?.VITE_SUPABASE_URL
  const key = import.meta?.env?.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    probeClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'rocket-pw-verify',
      },
    })
  } catch {
    // Never let client construction throw into the submit handler.
    return null
  }
  return probeClient
}

// Verify the user's CURRENT password without disturbing the live session.
async function verifyCurrentPassword(email, password) {
  const probe = getProbeClient()
  if (!probe) {
    return { ok: false, error: 'Authentication is not configured.' }
  }
  try {
    const { error } = await probe.auth.signInWithPassword({ email, password })
    if (error) {
      // Don't mislabel a rate-limit as a wrong password.
      if (error.status === 429) {
        return { ok: false, error: 'Too many attempts. Wait a minute and try again.' }
      }
      return { ok: false, error: 'Current password is incorrect.' }
    }
    return { ok: true, error: null }
  } catch {
    return { ok: false, error: 'Could not verify your current password. Try again.' }
  } finally {
    // Never leave the probe session lingering in memory.
    try {
      await probe.auth.signOut({ scope: 'local' })
    } catch {
      /* best-effort cleanup */
    }
  }
}

export default function ChangePasswordCard() {
  const { user, userProfile } = useAuth()
  const email = user?.email || userProfile?.email || ''

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetSending, setResetSending] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success' | 'error' | 'info', text }

  const configured = isSupabaseConfigured?.() ?? true

  const resetFields = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setMessage(null)

    if (!configured) {
      setMessage({ type: 'error', text: 'Password changes are unavailable — Rocket is not configured.' })
      return
    }
    if (!email) {
      setMessage({ type: 'error', text: 'We could not determine your account email. Sign out and back in, then retry.' })
      return
    }
    if (!currentPassword) {
      setMessage({ type: 'error', text: 'Enter your current password.' })
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage({ type: 'error', text: `Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.` })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'The new passwords do not match.' })
      return
    }
    if (newPassword === currentPassword) {
      setMessage({ type: 'error', text: 'Your new password must be different from your current password.' })
      return
    }

    setSubmitting(true)
    try {
      // 1) Prove the person at the keyboard knows the current password.
      const verified = await verifyCurrentPassword(email, currentPassword)
      if (!verified.ok) {
        setMessage({ type: 'error', text: verified.error })
        return
      }

      // 2) Update the password on the live session.
      const { error } = await authService.updatePassword(newPassword)
      if (error) {
        setMessage({
          type: 'error',
          text: error.message || 'Unable to update your password. Try again.',
        })
        return
      }

      resetFields()
      setMessage({
        type: 'success',
        text: 'Password updated. Use your new password next time you sign in.',
      })
    } catch {
      // Any unexpected throw must not leave the form permanently disabled.
      setMessage({ type: 'error', text: 'Something went wrong. Try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendResetEmail = async () => {
    if (resetSending) return
    setMessage(null)

    if (!configured) {
      setMessage({ type: 'error', text: 'Password reset is unavailable — Rocket is not configured.' })
      return
    }
    if (!email) {
      setMessage({ type: 'error', text: 'We could not determine your account email.' })
      return
    }

    setResetSending(true)
    const { error } = await authService.resetPassword(email)
    setResetSending(false)

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Could not send the reset email. Try again.' })
      return
    }
    setMessage({ type: 'info', text: `We sent a password reset link to ${email}. Check your inbox.` })
  }

  const messageClass =
    message?.type === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : message?.type === 'error'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground'

  return (
    <section className="mt-6 rounded-xl border border-border bg-card shadow-sm">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose a new password for {email || 'your account'}.
        </p>
      </div>

      <form className="px-4 py-4 space-y-4" onSubmit={handleSubmit}>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          label="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          required
        />
        <Input
          id="confirm-new-password"
          name="confirmPassword"
          type="password"
          label="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        {message && (
          <p className={`text-sm ${messageClass}`} role="status" aria-live="polite">
            {message.text}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting || !configured}>
          {submitting ? 'Updating password…' : 'Update password'}
        </Button>
      </form>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">
          Forgot your current password? We can email you a secure reset link instead.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleSendResetEmail}
          disabled={resetSending || !configured}
        >
          {resetSending ? 'Sending reset link…' : 'Email me a reset link'}
        </Button>
      </div>
    </section>
  )
}
