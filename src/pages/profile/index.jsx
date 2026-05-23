import React from 'react'
import AppLayout from '../../components/layouts/AppLayout'
import { useAuth } from '../../contexts/AuthContext'
import useTenant from '../../hooks/useTenant'

export default function ProfileSettings() {
  const { user, userProfile, signOut } = useAuth()
  const { orgId } = useTenant()

  const email = user?.email || userProfile?.email || '—'
  const name =
    userProfile?.full_name ||
    userProfile?.name ||
    user?.email?.split('@')?.[0] ||
    '—'
  const role = userProfile?.role || '—'

  const handleSignOut = async () => {
    try {
      await signOut?.()
    } catch (err) {
      console.error('[ProfileSettings] sign-out error:', err)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-6">Account</h1>

        <div className="rounded-xl border border-border bg-card shadow-sm divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Name</p>
            <p className="text-sm font-medium text-foreground">{name}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p>
            <p className="text-sm font-medium text-foreground">{email}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Role</p>
            <p className="text-sm font-medium text-foreground capitalize">{role}</p>
          </div>
          {orgId && (
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Org ID
              </p>
              <p className="text-xs font-medium text-foreground font-mono">{orgId}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Internal identifier — contact your admin to change.</p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
