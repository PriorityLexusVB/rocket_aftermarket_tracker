import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'

const VehicleTable = ({
  vehicles,
  selectedVehicles,
  onSelectionChange,
  onVehicleUpdate,
  userRole = 'staff',
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
}) => {
  const navigate = useNavigate()
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleCellEdit = (vehicleId, field, currentValue) => {
    setEditingCell(`${vehicleId}-${field}`)
    setEditValue(currentValue)
  }

  const handleCellSave = (vehicleId, field) => {
    onVehicleUpdate(vehicleId, { [field]: editValue })
    setEditingCell(null)
    setEditValue('')
  }

  const handleCellCancel = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const handleRowClick = (vehicleId) => {
    navigate(`/vehicle-detail-workstation?id=${vehicleId}`)
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      onSelectionChange(vehicles?.map((v) => v?.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectVehicle = (vehicleId, checked) => {
    if (checked) {
      onSelectionChange([...selectedVehicles, vehicleId])
    } else {
      onSelectionChange(selectedVehicles?.filter((id) => id !== vehicleId))
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      available: { color: 'bg-success text-success-foreground', label: 'Available' },
      'in-work': { color: 'bg-warning text-warning-foreground', label: 'In Work' },
      completed: { color: 'bg-primary text-primary-foreground', label: 'Completed' },
      sold: { color: 'bg-secondary text-secondary-foreground', label: 'Sold' },
    }

    const config = statusConfig?.[status] || statusConfig?.['available']
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config?.color}`}>
        {config?.label}
      </span>
    )
  }

  const sortedVehicles = React.useMemo(() => {
    if (!sortConfig?.key) return vehicles

    return [...vehicles]?.sort((a, b) => {
      const aValue = a?.[sortConfig?.key]
      const bValue = b?.[sortConfig?.key]

      if (aValue < bValue) return sortConfig?.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig?.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [vehicles, sortConfig])

  const isAllSelected = selectedVehicles?.length === vehicles?.length && vehicles?.length > 0
  const isIndeterminate =
    selectedVehicles?.length > 0 && selectedVehicles?.length < vehicles?.length

  return (
    <div className="bg-card rounded-lg border border-border shadow-elevation-1 overflow-hidden">
      {/* Table Header */}
      <div className="px-6 py-4 border-b border-border bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-foreground">
              Vehicle Inventory ({vehicles?.length})
            </h3>
            {selectedVehicles?.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedVehicles?.length} selected
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              iconName="Download"
              iconPosition="left"
              onClick={() => console.log('Export selected vehicles')}
            >
              Export
            </Button>
            <Button
              variant="default"
              size="sm"
              iconName="Plus"
              iconPosition="left"
              onClick={() => navigate('/sales-transaction-interface')}
            >
              Add Sale
            </Button>
          </div>
        </div>
      </div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="w-12 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate
                  }}
                  onChange={(e) => handleSelectAll(e?.target?.checked)}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-ring focus:ring-2"
                />
              </th>

              {[
                { key: 'vin', label: 'VIN', sortable: true },
                { key: 'year', label: 'Year', sortable: true },
                { key: 'make', label: 'Make', sortable: true },
                { key: 'model', label: 'Model', sortable: true },
                { key: 'stockNumber', label: 'Stock #', sortable: true },
                { key: 'aftermarketCount', label: 'Items', sortable: true },
                ...(userRole === 'manager'
                  ? [{ key: 'totalProfit', label: 'Profit', sortable: true }]
                  : []),
                { key: 'status', label: 'Status', sortable: true },
                { key: 'actions', label: 'Actions', sortable: false },
              ]?.map((column) => (
                <th
                  key={column?.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${
                    column?.sortable ? 'cursor-pointer hover:text-foreground' : ''
                  }`}
                  onClick={column?.sortable ? () => handleSort(column?.key) : undefined}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column?.label}</span>
                    {column?.sortable && sortConfig?.key === column?.key && (
                      <Icon
                        name={sortConfig?.direction === 'asc' ? 'ChevronUp' : 'ChevronDown'}
                        size={14}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-card divide-y divide-border">
            {sortedVehicles?.map((vehicle) => (
              <tr
                key={vehicle?.id}
                className={`hover:bg-muted/50 transition-colors duration-150 ${
                  selectedVehicles?.includes(vehicle?.id) ? 'bg-primary/5' : ''
                }`}
              >
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedVehicles?.includes(vehicle?.id)}
                    onChange={(e) => handleSelectVehicle(vehicle?.id, e?.target?.checked)}
                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-ring focus:ring-2"
                  />
                </td>

                <td className="px-4 py-4">
                  {editingCell === `${vehicle?.id}-vin` ? (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e?.target?.value)}
                        className="w-32 h-8"
                        onKeyDown={(e) => {
                          if (e?.key === 'Enter') handleCellSave(vehicle?.id, 'vin')
                          if (e?.key === 'Escape') handleCellCancel()
                        }}
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCellSave(vehicle?.id, 'vin')}
                        className="w-6 h-6"
                      >
                        <Icon name="Check" size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCellCancel}
                        className="w-6 h-6"
                      >
                        <Icon name="X" size={12} />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="font-mono text-sm cursor-pointer hover:text-primary"
                      onClick={() => handleCellEdit(vehicle?.id, 'vin', vehicle?.vin)}
                    >
                      {vehicle?.vin}
                    </div>
                  )}
                </td>

                <td className="px-4 py-4 text-sm text-foreground">{vehicle?.year}</td>

                <td className="px-4 py-4 text-sm text-foreground">{vehicle?.make}</td>

                <td className="px-4 py-4 text-sm text-foreground">{vehicle?.model}</td>

                <td className="px-4 py-4 text-sm text-foreground">{vehicle?.stockNumber}</td>

                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">
                      {vehicle?.aftermarketCount}
                    </span>
                    {vehicle?.aftermarketCount > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRowClick(vehicle?.id)}
                        className="w-6 h-6"
                      >
                        <Icon name="Eye" size={12} />
                      </Button>
                    )}
                  </div>
                </td>

                {userRole === 'manager' && (
                  <td className="px-4 py-4">
                    <span
                      className={`text-sm font-medium ${
                        vehicle?.totalProfit >= 0 ? 'text-success' : 'text-error'
                      }`}
                    >
                      ${vehicle?.totalProfit?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                )}

                <td className="px-4 py-4">{getStatusBadge(vehicle?.status)}</td>

                <td className="px-4 py-4">
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRowClick(vehicle?.id)}
                      className="w-8 h-8"
                      aria-label="View details"
                    >
                      <Icon name="Eye" size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => console.log('Edit vehicle', vehicle?.id)}
                      className="w-8 h-8"
                      aria-label="Edit vehicle"
                    >
                      <Icon name="Edit" size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vehicles?.length === 0 && (
        <div className="px-6 py-12 text-center">
          <Icon name="Car" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No vehicles found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || Object.values(filters)?.some((f) => f)
              ? 'Try adjusting your search or filters'
              : 'Start by adding your first vehicle to the system'}
          </p>
          <Button
            variant="default"
            iconName="Plus"
            iconPosition="left"
            onClick={() => navigate('/sales-transaction-interface')}
          >
            Add Vehicle
          </Button>
        </div>
      )}
    </div>
  )
}

export default VehicleTable
