// src/pages/deals/components/DealsKpiRow.jsx
// KPI summary cards for the deals page header.

import React from 'react'
import Icon from '../../../components/ui/Icon'
import { money0, pct1 } from '../../../lib/format'

const DealsKpiRow = ({ kpis }) => (
  <div className="mb-6" data-testid="kpi-row">
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
      {/* Active Jobs */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center">
          <div className="p-3 rounded-lg bg-accent/50 mr-4">
            <Icon name="Clock" size={24} className="text-foreground" />
          </div>
          <div>
            <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
              Active
            </h3>
            <p className="text-foreground text-2xl font-bold">{kpis?.active}</p>
          </div>
        </div>
      </div>

      {/* Revenue */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center">
          <div className="p-3 rounded-lg bg-accent/50 mr-4">
            <Icon name="DollarSign" size={24} className="text-foreground" />
          </div>
          <div>
            <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
              Revenue
            </h3>
            <p className="text-foreground text-2xl font-bold">
              {money0.format(parseFloat(kpis?.revenue) || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Profit */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center">
          <div className="p-3 rounded-lg bg-accent/50 mr-4">
            <Icon name="TrendingUp" size={24} className="text-foreground" />
          </div>
          <div>
            <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
              Profit
            </h3>
            <p className="text-foreground text-2xl font-bold">
              {kpis?.profit === '' || kpis?.profit == null
                ? '—'
                : money0.format(parseFloat(kpis?.profit) || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Margin */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center">
          <div className="p-3 rounded-lg bg-accent/50 mr-4">
            <Icon name="Percent" size={24} className="text-foreground" />
          </div>
          <div>
            <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
              Margin
            </h3>
            <p className="text-foreground text-2xl font-bold">
              {kpis?.margin === '' || kpis?.margin == null
                ? '—'
                : pct1(parseFloat(kpis?.margin) / 100 || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Needs Work (time TBD) */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center">
          <div className="p-3 rounded-lg bg-accent/50 mr-4">
            <Icon name="Clock" size={24} className="text-foreground" />
          </div>
          <div>
            <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
              Needs Work (time TBD)
            </h3>
            <p className="text-foreground text-2xl font-bold">{kpis?.pending}</p>
          </div>
        </div>
      </div>

      {/* Products Sold */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center">
          <div className="p-3 rounded-lg bg-accent/50 mr-4">
            <Icon name="Package" size={24} className="text-foreground" />
          </div>
          <div>
            <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
              Units Sold
            </h3>
            <p className="text-foreground text-2xl font-bold">{kpis?.productsSold || 0}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
)

export default DealsKpiRow
