import React from 'react'
import AppLayout from '../../components/layouts/AppLayout'

export default function ProfileSettings() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-2">Profile Settings</h1>
        <p className="text-slate-600 mb-6">Manage your account details and preferences.</p>
        <div className="rounded border border-slate-200 p-4 bg-white">
          <p className="text-sm text-slate-500">This is a placeholder page. We can expose user profile fields from `useAuth()` here.</p>
        </div>
      </div>
    </AppLayout>
  )
}
