import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('recharts', async () => {
  const React = await import('react')
  const passthrough = ({ children }) => React.createElement('div', null, children)
  const BarChart = ({ data = [], children }) =>
    React.createElement(
      'div',
      null,
      data.map((item) => React.createElement('span', { key: item.model }, item.model)),
      children
    )

  return {
    PieChart: passthrough,
    Pie: passthrough,
    Cell: passthrough,
    ResponsiveContainer: passthrough,
    Legend: passthrough,
    Tooltip: passthrough,
    BarChart,
    Bar: passthrough,
    XAxis: passthrough,
    YAxis: passthrough,
  }
})

import VehicleTypeChart from '@/pages/advanced-business-intelligence-analytics/components/VehicleTypeChart'

describe('VehicleTypeChart when condition is unavailable', () => {
  it('does not render a fabricated condition distribution and retains unknown models', () => {
    render(
      <VehicleTypeChart
        data={{
          new: [],
          used: [],
          unknown: [
            { vehicle_make: 'Lexus', vehicle_model: 'RX', total_price: 500 },
            { vehicle_make: 'Lexus', vehicle_model: 'RX', total_price: 100 },
            { vehicle_make: 'Lexus', vehicle_model: 'GX', total_price: 400 },
          ],
          condition_available: false,
        }}
      />
    )

    expect(screen.getByText('Vehicle condition unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Revenue Distribution')).not.toBeInTheDocument()
    expect(screen.getByText('Vehicle Products')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()
    expect(screen.getByText('Lexus RX')).toBeInTheDocument()
    expect(screen.getByText('Lexus GX')).toBeInTheDocument()
  })
})
