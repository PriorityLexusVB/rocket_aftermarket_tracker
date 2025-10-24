import React from 'react'
import AppLayout from '../../components/layouts/AppLayout'

export default function CommunicationsCenter() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-2">Communications Center</h1>
        <p className="text-slate-600 mb-6">A centralized view of recent communications and notifications.</p>
        <div className="rounded border border-slate-200 p-4 bg-white">
          <p className="text-sm text-slate-500">This is a placeholder page. We can wire real data from notificationService and related tables here.</p>
        </div>
      </div>
    </AppLayout>
  )
}
