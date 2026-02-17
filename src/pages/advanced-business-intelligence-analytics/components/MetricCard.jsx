import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

const MetricCard = ({ icon, title, value, trend, trendUp, description }) => {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm hover:bg-white/10 transition">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center">
          {React.cloneElement(icon, { className: 'w-6 h-6 text-gray-100' })}
        </div>
        {trend && (
          <div
            className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold tabular-nums border ${
              trendUp
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
                : 'bg-red-500/15 text-red-200 border-red-500/20'
            }`}
          >
            {trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{trend}</span>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-2xl font-bold text-gray-100 mb-1 tabular-nums">{value}</h3>
        <p className="text-gray-300 font-semibold mb-2">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  )
}

export default MetricCard
