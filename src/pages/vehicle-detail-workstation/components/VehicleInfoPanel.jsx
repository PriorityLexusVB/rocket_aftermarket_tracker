import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const VehicleInfoPanel = ({ vehicle, onUpdate, userRole }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(vehicle);

  const handleEdit = () => {
    setIsEditing(true);
    setEditData(vehicle);
  };

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(vehicle);
    setIsEditing(false);
  };

  const handleChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const canEdit = userRole === 'manager' || userRole === 'staff';

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1 h-full">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Icon name="Car" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Vehicle Details</h2>
              <p className="text-sm text-muted-foreground">Comprehensive vehicle information</p>
            </div>
          </div>
          {canEdit && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              iconName="Edit"
              iconPosition="left"
            >
              Edit
            </Button>
          )}
        </div>
      </div>
      <div className="p-6 space-y-6">
        {/* Primary Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground border-b border-border pb-2">
            Primary Information
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                VIN Number
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={editData?.vin}
                  onChange={(e) => handleChange('vin', e?.target?.value)}
                  placeholder="Enter VIN"
                  className="font-mono"
                />
              ) : (
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <span className="font-mono text-sm text-foreground">{vehicle?.vin}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Year
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={editData?.year}
                    onChange={(e) => handleChange('year', e?.target?.value)}
                    placeholder="Year"
                  />
                ) : (
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <span className="text-sm text-foreground">{vehicle?.year}</span>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Stock #
                </label>
                {isEditing ? (
                  <Input
                    type="text"
                    value={editData?.stockNumber}
                    onChange={(e) => handleChange('stockNumber', e?.target?.value)}
                    placeholder="Stock Number"
                  />
                ) : (
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <span className="text-sm text-foreground">{vehicle?.stockNumber}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Make & Model
              </label>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="text"
                    value={editData?.make}
                    onChange={(e) => handleChange('make', e?.target?.value)}
                    placeholder="Make"
                  />
                  <Input
                    type="text"
                    value={editData?.model}
                    onChange={(e) => handleChange('model', e?.target?.value)}
                    placeholder="Model"
                  />
                </div>
              ) : (
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <span className="text-sm text-foreground">{vehicle?.make} {vehicle?.model}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Color
                </label>
                {isEditing ? (
                  <Input
                    type="text"
                    value={editData?.color}
                    onChange={(e) => handleChange('color', e?.target?.value)}
                    placeholder="Color"
                  />
                ) : (
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <span className="text-sm text-foreground">{vehicle?.color}</span>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Mileage
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={editData?.mileage}
                    onChange={(e) => handleChange('mileage', e?.target?.value)}
                    placeholder="Mileage"
                  />
                ) : (
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <span className="text-sm text-foreground">{vehicle?.mileage?.toLocaleString()} miles</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground border-b border-border pb-2">
            Status Information
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Current Status
              </label>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  vehicle?.status === 'Available' ? 'bg-success' :
                  vehicle?.status === 'In Service' ? 'bg-warning' :
                  vehicle?.status === 'Sold' ? 'bg-error' : 'bg-muted-foreground'
                }`}></div>
                <span className="text-sm text-foreground">{vehicle?.status}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Last Updated
              </label>
              <div className="p-3 bg-muted rounded-lg border border-border">
                <span className="text-sm text-muted-foreground">
                  {new Date(vehicle.lastUpdated)?.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              iconName="Save"
              iconPosition="left"
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleInfoPanel;