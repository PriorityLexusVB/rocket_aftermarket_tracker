import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Button, Input } from '@/components/ui'

const ResetPassword = () => {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState('Checking your reset link…')
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    const verifyRecoverySession = async () => {
      if (!isSupabaseConfigured?.()) {
        if (active) setStatus('Password reset is unavailable because Rocket is not configured.')
        return
      }
      const { data, error } = await supabase.auth.getSession()
      if (!active) return
      if (error || !data?.session) {
        setStatus('This reset link is invalid or has expired. Request a new password reset email.')
        return
      }
      setReady(true)
      setStatus('Choose a new password for your Rocket account.')
    }
    verifyRecoverySession()
    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting || !ready) return
    if (password.length < 12) {
      setStatus('Use at least 12 characters for your new password.')
      return
    }
    if (password !== confirmPassword) {
      setStatus('The passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setStatus(error.message || 'Unable to update your password. Request a new reset email.')
      setSubmitting(false)
      return
    }
    setStatus('Password updated. Redirecting to sign in…')
    await supabase.auth.signOut({ scope: 'local' })
    window.setTimeout(() => navigate('/auth', { replace: true }), 900)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {status}
        </p>
        {ready && (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Input
              id="new-password"
              name="password"
              type="password"
              label="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              label="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Updating password…' : 'Update password'}
            </Button>
          </form>
        )}
        <Link className="mt-6 inline-block text-sm text-primary hover:underline" to="/auth">
          Back to sign in
        </Link>
      </section>
    </main>
  )
}

export default ResetPassword
