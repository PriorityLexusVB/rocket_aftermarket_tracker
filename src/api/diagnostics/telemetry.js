// src/api/diagnostics/telemetry.js
// Client-side diagnostics helper to expose capability fallback telemetry.
// Note: Telemetry is session-scoped and stored in sessionStorage; this is not a serverless endpoint.

import { getTelemetrySummary } from '@/utils/capabilityTelemetry'

export function getTelemetryDiagnostics() {
  try {
    return getTelemetrySummary()
  } catch (e) {
    return {
      timestamp: new Date().toISOString(),
      counters: {},
      sessionActive: false,
      error: e?.message || String(e || 'unknown error'),
    }
  }
}

export default getTelemetryDiagnostics
