import React, { useState } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'

const RecentTransactions = ({ transactions = [], onEditTransaction, onViewTransaction }) => {
  const [filter, setFilter] = useState('all')

  const filterOptions = [
    { value: 'all', label: 'All Transactions', count: transactions?.length },
    {
      value: 'pending',
      label: 'Pending',
      count: transactions?.filter((t) => t?.status === 'Pending')?.length,
    },
    {
      value: 'in_progress',
      label: 'In Progress',
      count: transactions?.filter((t) => t?.status === 'In Progress')?.length,
    },
    {
      value: 'complete',
      label: 'Complete',
      count: transactions?.filter((t) => t?.status === 'Complete')?.length,
    },
  ]

  const filteredTransactions = transactions?.filter((transaction) => {
    if (filter === 'all') return true
    if (filter === 'pending') return transaction?.status === 'Pending'
    if (filter === 'in_progress') return transaction?.status === 'In Progress'
    if (filter === 'complete') return transaction?.status === 'Complete'
    return true
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-warning/10 text-warning border-warning/20'
      case 'In Progress':
        return 'bg-primary/10 text-primary border-primary/20'
      case 'Complete':
        return 'bg-success/10 text-success border-success/20'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low':
        return 'text-muted-foreground'
      case 'normal':
        return 'text-foreground'
      case 'high':
        return 'text-warning'
      case 'urgent':
        return 'text-error'
      default:
        return 'text-foreground'
    }
  }

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'low':
        return 'ArrowDown'
      case 'normal':
        return 'Minus'
      case 'high':
        return 'ArrowUp'
      case 'urgent':
        return 'AlertTriangle'
      default:
        return 'Minus'
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-muted rounded-lg">
            <Icon name="History" size={20} className="text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
            <p className="text-sm text-muted-foreground">View and manage recent sales entries</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          iconName="Download"
          iconPosition="left"
          onClick={() => alert('Export is not implemented yet.')}
        >
          Export
        </Button>
      </div>
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filterOptions?.map((option) => (
          <button
            key={option?.value}
            onClick={() => setFilter(option?.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              filter === option?.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {option?.label}
            <span className="ml-2 px-2 py-0.5 bg-black/10 rounded-full text-xs">
              {option?.count}
            </span>
          </button>
        ))}
      </div>
      {/* Transactions List */}
      <div className="space-y-3">
        {filteredTransactions?.length === 0 ? (
          <div className="text-center py-8">
            <Icon name="FileText" size={48} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No transactions found for the selected filter</p>
          </div>
        ) : (
          filteredTransactions?.map((transaction) => (
            <div
              key={transaction?.id}
              className="p-4 border border-border rounded-lg hover:shadow-elevation-1 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-foreground">{transaction?.id}</h4>
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(transaction?.status)}`}
                    >
                      {transaction?.status}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Icon
                      name={getPriorityIcon(transaction?.priority)}
                      size={14}
                      className={getPriorityColor(transaction?.priority)}
                    />
                    <span
                      className={`text-xs capitalize ${getPriorityColor(transaction?.priority)}`}
                    >
                      {transaction?.priority}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {transaction?.date} at {transaction?.time}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewTransaction(transaction)}
                      className="w-8 h-8"
                      aria-label="View transaction"
                    >
                      <Icon name="Eye" size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditTransaction(transaction)}
                      className="w-8 h-8"
                      aria-label="Edit transaction"
                    >
                      <Icon name="Edit" size={14} />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Vehicle Info */}
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon name="Car" size={14} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Vehicle</span>
                  </div>
                  <p className="text-sm text-foreground">
                    {transaction?.vehicle?.year} {transaction?.vehicle?.make}{' '}
                    {transaction?.vehicle?.model}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    VIN: {transaction?.vehicle?.vin?.slice(-6)} • Stock:{' '}
                    {transaction?.vehicle?.stockNumber}
                  </p>
                </div>

                {/* Products Info */}
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon name="Package" size={14} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Products</span>
                  </div>
                  <p className="text-sm text-foreground">
                    {transaction?.products?.length} item
                    {transaction?.products?.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {transaction?.products?.[0]?.name}
                    {transaction?.products?.length > 1 &&
                      ` +${transaction?.products?.length - 1} more`}
                  </p>
                </div>

                {/* Financial Info */}
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon name="DollarSign" size={14} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Financial</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        ${transaction?.totalSale?.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Sale</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-success">
                        ${transaction?.profit?.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Profit</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-accent">
                        {transaction?.margin?.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Margin</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Icon name="Users" size={12} />
                    <span>
                      {transaction?.vendorsCount} vendor{transaction?.vendorsCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Icon name="User" size={12} />
                    <span>by {transaction?.createdBy}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewTransaction(transaction)}
                    iconName="ExternalLink"
                    iconPosition="right"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Summary Stats */}
      {filteredTransactions?.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-foreground">
                {filteredTransactions?.length}
              </p>
              <p className="text-sm text-muted-foreground">Transactions</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-success">
                ${filteredTransactions?.reduce((sum, t) => sum + t?.totalSale, 0)?.toFixed(0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Sales</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-primary">
                ${filteredTransactions?.reduce((sum, t) => sum + t?.profit, 0)?.toFixed(0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Profit</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-accent">
                {(
                  filteredTransactions?.reduce((sum, t) => sum + t?.margin, 0) /
                  filteredTransactions?.length
                )?.toFixed(1)}
                %
              </p>
              <p className="text-sm text-muted-foreground">Avg Margin</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecentTransactions
