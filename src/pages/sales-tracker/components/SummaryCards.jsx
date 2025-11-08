import React from 'react'
import { DollarSign, TrendingUp, Receipt, Users, CalendarDays } from 'lucide-react'

const SummaryCards = ({ data, stats, onCardClick }) => {
  // Calculate stats from data
  const calculateStats = (salesData) => {
    if (!salesData || salesData?.length === 0) {
      return {
        totalRevenue: 0,
        totalSales: 0,
        averageOrderValue: 0,
        pendingSales: 0,
        completedSales: 0,
      }
    }

    const completed = salesData?.filter(
      (sale) => sale?.status === 'completed' || sale?.status === 'delivered'
    )
    const pending = salesData?.filter(
      (sale) => sale?.status === 'pending' || sale?.status === 'in_progress'
    )

    const totalRevenue = completed?.reduce((sum, sale) => sum + (sale?.total || 0), 0)
    const averageOrderValue = completed?.length > 0 ? totalRevenue / completed?.length : 0

    return {
      totalRevenue,
      totalSales: salesData?.length,
      averageOrderValue,
      pendingSales: pending?.length,
      completedSales: completed?.length,
    }
  }

  const currentStats = calculateStats(data)

  const cardData = [
    {
      id: 'revenue',
      title: 'Total Revenue',
      value: currentStats?.totalRevenue,
      format: 'currency',
      icon: DollarSign,
      color: 'green',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      iconColor: 'text-green-600',
    },
    {
      id: 'sales',
      title: 'Total Sales',
      value: currentStats?.totalSales,
      format: 'number',
      icon: Receipt,
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      iconColor: 'text-blue-600',
    },
    {
      id: 'average',
      title: 'Avg. Order Value',
      value: currentStats?.averageOrderValue,
      format: 'currency',
      icon: TrendingUp,
      color: 'purple',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      iconColor: 'text-purple-600',
    },
    {
      id: 'pending',
      title: 'Pending Sales',
      value: currentStats?.pendingSales,
      format: 'number',
      icon: CalendarDays,
      color: 'yellow',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
      iconColor: 'text-yellow-600',
    },
    {
      id: 'completed',
      title: 'Completed Sales',
      value: currentStats?.completedSales,
      format: 'number',
      icon: Users,
      color: 'emerald',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      iconColor: 'text-emerald-600',
    },
  ]

  const formatValue = (value, format) => {
    if (value === null || value === undefined) return '0'

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })?.format(value)
      case 'number':
        return new Intl.NumberFormat('en-US')?.format(value)
      case 'percentage':
        return `${Number(value)?.toFixed(1)}%`
      default:
        return value?.toString()
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {cardData?.map((card) => {
        const IconComponent = card?.icon

        return (
          <div
            key={card?.id}
            className={`${card?.bgColor} p-6 rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-shadow`}
            onClick={() => onCardClick?.(card?.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{card?.title}</p>
                <p className={`text-2xl font-bold ${card?.textColor}`}>
                  {formatValue(card?.value, card?.format)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${card?.bgColor}`}>
                <IconComponent className={`h-6 w-6 ${card?.iconColor}`} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default SummaryCards
