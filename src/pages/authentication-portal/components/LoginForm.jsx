import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../../contexts/AuthContext'
import { Button, Input, Checkbox } from '../../../components/ui'
import SupabaseConfigNotice from '../../../components/ui/SupabaseConfigNotice'
import { isSupabaseConfigured, supabase } from '../../../lib/supabase'

const LoginForm = () => {
  const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetMessage, setResetMessage] = useState('')

  const supabaseConfigured = !!isSupabaseConfigured?.()

  const { signIn } = useContext(AuthContext)
  const navigate = useNavigate()

  const handleChange = (eOrValue, maybeEvent) => {
    if (typeof eOrValue === 'boolean') {
      const event = maybeEvent
      const name = event?.target?.name
      if (!name) return
      setFormData((prev) => ({ ...prev, [name]: eOrValue }))
      return
    }

    const target = eOrValue?.target || {}
    const { name, value, type, checked } = target
    if (!name) return
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? !!checked : value }))
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()

    if (!supabaseConfigured) {
      setError(
        'Supabase is not configured for this dev server. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart.'
      )
      return
    }

    if (isLoading) return

    setIsLoading(true)
    setError('')

    if (!formData?.email?.trim() || !formData?.password?.trim()) {
      setError('Please enter both email and password.')
      setIsLoading(false)
      return
    }

    try {
      const result = await signIn(
        formData?.email?.trim(),
        formData?.password?.trim(),
        formData?.rememberMe
      )

      if (result?.success && (result?.data?.user || result?.data?.session?.user)) {
        localStorage.removeItem('lastAuthError')
        setError('')
        setTimeout(() => {
          navigate('/deals', { replace: true })
        }, 100)
      } else {
        setError(result?.error || 'Login failed. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    const email = formData?.email?.trim()
    if (!email) {
      setError('Enter your email address above, then click Forgot password.')
      return
    }
    if (!supabaseConfigured) {
      setError('Supabase is not configured. Password reset is unavailable.')
      return
    }
    setError('')
    setResetMessage('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) {
        setError(resetError.message || 'Failed to send reset email.')
      } else {
        setResetMessage(`Password reset email sent to ${email}. Check your inbox.`)
      }
    } catch {
      setError('An error occurred. Please try again.')
    }
  }

  return (
    <div className="w-full space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Sign In</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your credentials to continue.
        </p>
      </div>

      <SupabaseConfigNotice />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          name="email"
          value={formData?.email}
          onChange={handleChange}
          placeholder="your.email@example.com"
          required
          label="Email"
          id="email"
          className="bg-card border-border text-foreground"
          aria-label="Email"
        />

        <Input
          type="password"
          name="password"
          value={formData?.password}
          onChange={handleChange}
          placeholder="••••••••"
          required
          label="Password"
          id="password"
          className="bg-card border-border text-foreground"
          aria-label="Password"
        />

        <div className="flex items-center justify-between gap-3">
          <Checkbox
            label="Remember me"
            name="rememberMe"
            checked={formData?.rememberMe}
            onChange={handleChange}
            id="rememberMe"
            description="Keep me logged in"
          />
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {resetMessage && (
          <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">{resetMessage}</p>
        )}

        <Button
          type="submit"
          className="w-full 0 text-foreground border border-border hover:bg-accent"
          disabled={isLoading || !supabaseConfigured}
          onClick={handleSubmit}
          aria-label="Sign In"
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>
    </div>
  )
}

export default LoginForm
