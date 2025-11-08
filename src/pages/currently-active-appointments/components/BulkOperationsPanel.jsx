import React from 'react'
import { X, CheckCircle, RefreshCw, Calendar, Users, AlertTriangle } from 'lucide-react'

const BulkOperationsPanel = ({ selectedCount, onStatusUpdate, onAssign, onCancel }) => {
  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-2xl border-b border-indigo-500/20">
      <div className="px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">
                {selectedCount} appointment{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>

            <div className="h-6 w-px bg-white/20"></div>

            <div className="flex items-center space-x-3">
              <span className="text-sm text-white/80">Bulk Actions:</span>

              {/* Status Updates */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onStatusUpdate('in_progress')}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Start</span>
                </button>

                <button
                  onClick={() => onStatusUpdate('quality_check')}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>QC</span>
                </button>

                <button
                  onClick={() => onStatusUpdate('scheduled')}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Schedule</span>
                </button>
              </div>

              <div className="h-4 w-px bg-white/20"></div>

              {/* Assignment */}
              <button
                onClick={onAssign}
                className="flex items-center space-x-2 px-4 py-1.5 bg-green-500/80 hover:bg-green-500 rounded-lg transition-all duration-200 text-sm font-medium"
              >
                <Users className="w-4 h-4" />
                <span>Assign Staff</span>
              </button>

              {/* Danger Actions */}
              <button
                onClick={() => onStatusUpdate('cancelled')}
                className="flex items-center space-x-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-all duration-200 text-sm font-medium border border-red-400/30"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="flex items-center space-x-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200"
          >
            <X className="w-4 h-4" />
            <span className="text-sm">Exit Bulk Mode</span>
          </button>
        </div>

        {/* Quick Instructions */}
        <div className="mt-3 text-xs text-white/60">
          💡 Select appointments by clicking on them, then choose a bulk action above
        </div>
      </div>
    </div>
  )
}

export default BulkOperationsPanel
