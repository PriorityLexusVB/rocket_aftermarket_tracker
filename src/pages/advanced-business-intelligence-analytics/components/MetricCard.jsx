import React from 'react'
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.js'
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down.js'
const MetricCard = ({ icon, title, value, trend, trendUp, description }) => {
  return (
    <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm hover:bg-slate-50 transition">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center">
          {React.cloneElement(icon, { className: 'w-6 h-6 text-slate-700' })}
        </div>
        {trend && (
          <div
            className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold tabular-nums border ${
              trendUp
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-red-100 text-red-800 border-red-300'
            }`}
          >
            {trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{trend}</span>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-2xl font-bold text-slate-900 mb-1 tabular-nums">{value}</h3>
        <p className="text-slate-700 font-semibold mb-2">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  )
}

export default MetricCard
