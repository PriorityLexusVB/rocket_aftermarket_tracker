import React from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'

const TransactionSummary = ({
  customerData,
  selectedVehicle,
  selectedProducts,
  onSave,
  isSaving,
  canSave,
}) => {
  const calculateTotals = () => {
    const totalCost = selectedProducts?.reduce(
      (sum, service) => sum + (parseFloat(service?.cost) || 0),
      0
    )
    const totalPrice = selectedProducts?.reduce(
      (sum, service) => sum + (parseFloat(service?.price) || 0),
      0
    )
    const totalProfit = totalPrice - totalCost
    const marginPercentage = totalPrice > 0 ? ((totalProfit / totalPrice) * 100)?.toFixed(1) : 0

    return { totalCost, totalPrice, totalProfit, marginPercentage }
  }

  const { totalCost, totalPrice, totalProfit, marginPercentage } = calculateTotals()

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-accent/10 rounded-lg">
          <Icon name="Receipt" size={20} className="text-accent" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Transaction Summary</h3>
          <p className="text-sm text-muted-foreground">Review sale details before saving</p>
        </div>
      </div>

      {/* Customer Summary */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Customer</h4>
        {customerData?.name ? (
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="font-medium text-foreground">{customerData?.name}</p>
            {customerData?.email && (
              <p className="text-sm text-muted-foreground">{customerData?.email}</p>
            )}
            {customerData?.phone && (
              <p className="text-sm text-muted-foreground">{customerData?.phone}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No customer selected</p>
        )}
      </div>

      {/* Vehicle Summary */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Vehicle</h4>
        {selectedVehicle ? (
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="font-medium text-foreground">
              {selectedVehicle?.year} {selectedVehicle?.make} {selectedVehicle?.model}
            </p>
            <p className="text-sm text-muted-foreground">Stock: {selectedVehicle?.stockNumber}</p>
            <p className="text-sm text-muted-foreground">VIN: {selectedVehicle?.vin}</p>
            {selectedVehicle?.isNew && (
              <span className="inline-block mt-1 px-2 py-1 text-xs bg-accent text-accent-foreground rounded-full">
                New Vehicle
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No vehicle selected</p>
        )}
      </div>

      {/* Services Summary */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-foreground mb-2">
          Services ({selectedProducts?.length})
        </h4>
        {selectedProducts?.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedProducts?.map((service) => (
              <div key={service?.id} className="p-3 bg-muted/30 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-foreground">{service?.name}</p>
                  <p className="font-medium text-foreground">
                    ${parseFloat(service?.price || 0)?.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Cost: ${parseFloat(service?.cost || 0)?.toFixed(2)}</span>
                  <span>
                    Profit: $
                    {(parseFloat(service?.price || 0) - parseFloat(service?.cost || 0))?.toFixed(2)}
                  </span>
                </div>
                {service?.vendorId && (
                  <p className="text-xs text-muted-foreground mt-1">Vendor assignment made</p>
                )}
                {service?.startDate && service?.endDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {service?.startDate} to {service?.endDate}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No services selected</p>
        )}
      </div>

      {/* Totals */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Cost:</span>
          <span className="font-medium text-foreground">${totalCost?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Price:</span>
          <span className="font-medium text-foreground">${totalPrice?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-border pt-3">
          <span className="font-medium text-foreground">Total Profit:</span>
          <span className={`font-medium ${totalProfit >= 0 ? 'text-success' : 'text-error'}`}>
            ${totalProfit?.toFixed(2)} ({marginPercentage}%)
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          variant="default"
          onClick={() => onSave?.({})}
          loading={isSaving}
          disabled={!canSave}
          iconName="Save"
          iconPosition="left"
          className="w-full"
        >
          {isSaving ? 'Saving Sale...' : 'Save Sale'}
        </Button>

        <Button
          variant="outline"
          onClick={() => onSave?.({ printReceipt: true })}
          loading={isSaving}
          disabled={!canSave}
          iconName="Printer"
          iconPosition="left"
          className="w-full"
        >
          Save & Print Receipt
        </Button>
      </div>

      {/* Validation Messages */}
      {!canSave && (
        <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <Icon name="AlertTriangle" size={16} className="text-warning mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning mb-1">Required Information Missing:</p>
              <ul className="text-warning/80 space-y-1">
                {!customerData?.name && <li>• Customer name is required</li>}
                {!selectedVehicle && <li>• Vehicle must be selected</li>}
                {selectedProducts?.length === 0 && <li>• At least one service must be selected</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionSummary
