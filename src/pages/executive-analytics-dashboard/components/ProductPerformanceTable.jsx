import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ProductPerformanceTable = ({ data }) => {
  const [sortField, setSortField] = useState('profit');
  const [sortDirection, setSortDirection] = useState('desc');

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })?.format(value);
  };

  const formatPercentage = (value) => {
    return `${value > 0 ? '+' : ''}${value?.toFixed(1)}%`;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data]?.sort((a, b) => {
    const aValue = a?.[sortField];
    const bValue = b?.[sortField];
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    }
    return aValue < bValue ? 1 : -1;
  });

  const getPerformanceColor = (growth) => {
    if (growth > 10) return 'text-success';
    if (growth < -5) return 'text-error';
    return 'text-muted-foreground';
  };

  const getPerformanceBadge = (growth) => {
    if (growth > 10) return 'bg-success/10 text-success';
    if (growth < -5) return 'bg-error/10 text-error';
    return 'bg-muted text-muted-foreground';
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <Icon name="ArrowUpDown" size={14} className="text-muted-foreground" />;
    return (
      <Icon 
        name={sortDirection === 'asc' ? "ArrowUp" : "ArrowDown"} 
        size={14} 
        className="text-primary" 
      />
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Product Performance</h3>
          <Button variant="outline" size="sm" iconName="Download" iconPosition="left">
            Export
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                <button 
                  onClick={() => handleSort('name')}
                  className="flex items-center space-x-2 hover:text-foreground transition-colors"
                >
                  <span>Product</span>
                  <SortIcon field="name" />
                </button>
              </th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                <button 
                  onClick={() => handleSort('profit')}
                  className="flex items-center space-x-2 hover:text-foreground transition-colors ml-auto"
                >
                  <span>Total Profit</span>
                  <SortIcon field="profit" />
                </button>
              </th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                <button 
                  onClick={() => handleSort('volume')}
                  className="flex items-center space-x-2 hover:text-foreground transition-colors ml-auto"
                >
                  <span>Volume</span>
                  <SortIcon field="volume" />
                </button>
              </th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                <button 
                  onClick={() => handleSort('margin')}
                  className="flex items-center space-x-2 hover:text-foreground transition-colors ml-auto"
                >
                  <span>Avg Margin</span>
                  <SortIcon field="margin" />
                </button>
              </th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                <button 
                  onClick={() => handleSort('growth')}
                  className="flex items-center space-x-2 hover:text-foreground transition-colors ml-auto"
                >
                  <span>Growth</span>
                  <SortIcon field="growth" />
                </button>
              </th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedData?.map((product, index) => (
              <tr key={product?.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
                      <Icon name={product?.icon} size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{product?.name}</p>
                      <p className="text-sm text-muted-foreground">{product?.category}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <p className="font-semibold text-foreground">{formatCurrency(product?.profit)}</p>
                </td>
                <td className="p-4 text-right">
                  <p className="text-foreground">{product?.volume?.toLocaleString()}</p>
                </td>
                <td className="p-4 text-right">
                  <p className="text-foreground">{product?.margin?.toFixed(1)}%</p>
                </td>
                <td className="p-4 text-right">
                  <p className={`font-medium ${getPerformanceColor(product?.growth)}`}>
                    {formatPercentage(product?.growth)}
                  </p>
                </td>
                <td className="p-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPerformanceBadge(product?.growth)}`}>
                    {product?.growth > 10 ? 'Excellent' : product?.growth < -5 ? 'Declining' : 'Stable'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductPerformanceTable;