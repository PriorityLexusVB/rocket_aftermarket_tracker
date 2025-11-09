// src/pages/AdminCapabilities.jsx
// Admin page for viewing and resetting capability flags
import { useState, useEffect } from 'react'
import { getAllTelemetry, resetAllTelemetry, exportTelemetry, importTelemetry } from '@/utils/capabilityTelemetry'
import { getLogs, getLogStats, clearLogs, exportLogs } from '@/utils/structuredLogger'

export default function AdminCapabilities() {
  const [telemetry, setTelemetry] = useState({})
  const [capabilities, setCapabilities] = useState({})
  const [logs, setLogs] = useState([])
  const [logStats, setLogStats] = useState({})
  const [reloadStatus, setReloadStatus] = useState(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    // Load telemetry
    setTelemetry(getAllTelemetry())

    // Load capability flags
    if (typeof sessionStorage !== 'undefined') {
      setCapabilities({
        jobPartsVendorRel: sessionStorage.getItem('cap_jobPartsVendorRel'),
        jobPartsScheduledTimes: sessionStorage.getItem('cap_jobPartsScheduledTimes'),
        jobPartsVendorId: sessionStorage.getItem('cap_jobPartsVendorId'),
        userProfilesName: sessionStorage.getItem('cap_userProfilesName'),
      })
    }

    // Load logs
    setLogs(getLogs())
    setLogStats(getLogStats())
  }

  const handleResetTelemetry = () => {
    if (confirm('Reset all telemetry counters?')) {
      resetAllTelemetry()
      loadData()
    }
  }

  const handleResetCapability = (key) => {
    if (confirm(`Reset capability flag: ${key}?`)) {
      sessionStorage.removeItem(key)
      loadData()
    }
  }

  const handleReloadSchema = async () => {
    setReloadStatus({ loading: true })
    try {
      const response = await fetch('/api/admin/reload-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      setReloadStatus({
        loading: false,
        success: response.ok,
        message: data.message || data.error,
        data,
      })
    } catch (error) {
      setReloadStatus({
        loading: false,
        success: false,
        message: error.message,
      })
    }
  }

  const handleExportTelemetry = () => {
    const data = exportTelemetry()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `telemetry-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportTelemetry = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const success = importTelemetry(event.target.result)
        if (success) {
          alert('Telemetry imported successfully')
          loadData()
        } else {
          alert('Failed to import telemetry')
        }
      } catch (error) {
        alert(`Import error: ${error.message}`)
      }
    }
    reader.readAsText(file)
  }

  const handleExportLogs = () => {
    const data = exportLogs(true)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClearLogs = () => {
    if (confirm('Clear all logs from buffer?')) {
      clearLogs()
      loadData()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin: Capabilities & Diagnostics</h1>
          <p className="mt-2 text-gray-600">
            Manage capability flags, view telemetry, and reload schema cache
          </p>
        </div>

        {/* Telemetry Section */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Telemetry Counters</h2>
            <div className="flex gap-2">
              <button
                onClick={handleExportTelemetry}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Export
              </button>
              <label className="cursor-pointer rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportTelemetry}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleResetTelemetry}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Reset All
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {Object.entries(telemetry).map(([key, value]) => (
              <div key={key} className="rounded border border-gray-200 p-4">
                <div className="text-sm text-gray-600">{formatKey(key)}</div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Capability Flags Section */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Capability Flags</h2>
          <div className="space-y-2">
            {Object.entries(capabilities).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${value === 'false' ? 'bg-red-500' : value === 'true' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <div className="font-medium text-gray-900">{formatKey(key)}</div>
                    <div className="text-sm text-gray-500">
                      Status: {value === 'false' ? 'Disabled' : value === 'true' ? 'Enabled' : 'Not Set'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleResetCapability(key)}
                  className="rounded bg-gray-600 px-3 py-1 text-sm font-medium text-white hover:bg-gray-700"
                >
                  Reset
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Schema Reload Section */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Schema Cache Management</h2>
          <p className="mb-4 text-sm text-gray-600">
            Reload the PostgREST schema cache to recognize new columns or relationships after database migrations.
          </p>
          <button
            onClick={handleReloadSchema}
            disabled={reloadStatus?.loading}
            className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {reloadStatus?.loading ? 'Reloading...' : 'Reload Schema Cache'}
          </button>
          {reloadStatus && !reloadStatus.loading && (
            <div className={`mt-4 rounded p-4 ${reloadStatus.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <div className="font-medium">{reloadStatus.message}</div>
              {reloadStatus.data?.rateLimit && (
                <div className="mt-2 text-sm">
                  Rate limit: {reloadStatus.data.rateLimit.remaining} requests remaining
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logs Section */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Structured Logs</h2>
            <div className="flex gap-2">
              <button
                onClick={handleExportLogs}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Export Logs
              </button>
              <button
                onClick={handleClearLogs}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Clear Logs
              </button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-4 gap-4">
            <div className="rounded border border-gray-200 p-3">
              <div className="text-sm text-gray-600">Total Logs</div>
              <div className="text-xl font-bold">{logStats.total || 0}</div>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <div className="text-sm text-gray-600">Errors</div>
              <div className="text-xl font-bold text-red-600">
                {(logStats.byLevel?.error || 0) + (logStats.byLevel?.critical || 0)}
              </div>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <div className="text-sm text-gray-600">Warnings</div>
              <div className="text-xl font-bold text-yellow-600">{logStats.byLevel?.warn || 0}</div>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <div className="text-sm text-gray-600">Info</div>
              <div className="text-xl font-bold text-blue-600">{logStats.byLevel?.info || 0}</div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="rounded border border-gray-200 p-4 text-center text-gray-500">
                No logs in buffer
              </div>
            ) : (
              <div className="space-y-2">
                {logs.slice(-20).reverse().map((log, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${getLevelColor(log.level)}`}>
                          {log.level.toUpperCase()}
                        </span>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {log.category}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 text-gray-900">{log.message}</div>
                    {Object.keys(log.context).length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-600">Context</summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                          {JSON.stringify(log.context, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

function getLevelColor(level) {
  switch (level) {
    case 'error':
    case 'critical':
      return 'bg-red-100 text-red-800'
    case 'warn':
      return 'bg-yellow-100 text-yellow-800'
    case 'info':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
