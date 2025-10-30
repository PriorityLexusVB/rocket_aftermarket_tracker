import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const AftermarketWorkTable = ({ workItems, onUpdateItem, onDeleteItem, userRole }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);

  const statusOptions = [
    { value: 'Pending', label: 'Pending', description: 'Awaiting vendor assignment' },
    { value: 'In Progress', label: 'In Progress', description: 'Work in progress' },
    { value: 'Complete', label: 'Complete', description: 'Work completed' },
    { value: 'On Hold', label: 'On Hold', description: 'Temporarily paused' }
  ];

  const handleEdit = (item) => {
    setEditingId(item?.id);
    setEditData(item);
  };

  const handleSave = () => {
    onUpdateItem(editData);
    setEditingId(null);
    setEditData({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'salePrice' || field === 'estimatedCost' ? {
        profit: (field === 'salePrice' ? parseFloat(value) || 0 : parseFloat(prev?.salePrice) || 0) - 
                (field === 'estimatedCost' ? parseFloat(value) || 0 : parseFloat(prev?.estimatedCost) || 0)
      } : {})
    }));
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => 
      prev?.includes(itemId) 
        ? prev?.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleBulkStatusUpdate = (status) => {
    selectedItems?.forEach(itemId => {
      const item = workItems?.find(w => w?.id === itemId);
      if (item) {
        onUpdateItem({ ...item, status });
      }
    });
    setSelectedItems([]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Complete': return 'text-success bg-success/10';
      case 'In Progress': return 'text-warning bg-warning/10';
      case 'On Hold': return 'text-error bg-error/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const isOverdue = (item) => {
    if (item?.status === 'Complete') return false;
    const daysSinceAdded = Math.floor((new Date() - new Date(item.dateAdded)) / (1000 * 60 * 60 * 24));
    return daysSinceAdded > 7;
  };

  const canViewFinancials = userRole === 'manager';

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Icon name="Wrench" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Aftermarket Work</h2>
              <p className="text-sm text-muted-foreground">
                {workItems?.length} items • {workItems?.filter(w => w?.status === 'Complete')?.length} completed
              </p>
            </div>
          </div>

          {selectedItems?.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {selectedItems?.length} selected
              </span>
              <Select
                placeholder="Bulk update status..."
                options={statusOptions}
                value=""
                onChange={handleBulkStatusUpdate}
                className="w-48"
              />
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={selectedItems?.length === workItems?.length}
                  onChange={(e) => setSelectedItems(e?.target?.checked ? workItems?.map(w => w?.id) : [])}
                  className="rounded border-border"
                />
              </th>
              <th className="text-left p-4 text-sm font-medium text-foreground">Product</th>
              <th className="text-left p-4 text-sm font-medium text-foreground">Vendor</th>
              <th className="text-left p-4 text-sm font-medium text-foreground">Status</th>
              <th className="text-left p-4 text-sm font-medium text-foreground">Date Added</th>
              {canViewFinancials && (
                <>
                  <th className="text-left p-4 text-sm font-medium text-foreground">Cost</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground">Sale Price</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground">Profit</th>
                </>
              )}
              <th className="text-left p-4 text-sm font-medium text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workItems?.map((item) => (
              <tr 
                key={item?.id} 
                className={`border-b border-border hover:bg-muted/30 transition-colors ${
                  isOverdue(item) ? 'bg-error/5 border-error/20' : ''
                }`}
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedItems?.includes(item?.id)}
                    onChange={() => handleSelectItem(item?.id)}
                    className="rounded border-border"
                  />
                </td>
                
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    {isOverdue(item) && (
                      <Icon name="AlertTriangle" size={16} className="text-error" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-foreground">{item?.productType}</div>
                      <div className="text-xs text-muted-foreground">{item?.productDescription}</div>
                    </div>
                  </div>
                </td>
                
                <td className="p-4">
                  <div className="text-sm text-foreground">{item?.vendorName}</div>
                </td>
                
                <td className="p-4">
                  {editingId === item?.id ? (
                    <Select
                      options={statusOptions}
                      value={editData?.status}
                      onChange={(value) => handleChange('status', value)}
                      className="w-32"
                    />
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item?.status)}`}>
                      {item?.status}
                    </span>
                  )}
                </td>
                
                <td className="p-4">
                  <div className="text-sm text-muted-foreground">
                    {new Date(item.dateAdded)?.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </td>
                
                {canViewFinancials && (
                  <>
                    <td className="p-4">
                      {editingId === item?.id ? (
                        <Input
                          type="number"
                          value={editData?.estimatedCost}
                          onChange={(e) => handleChange('estimatedCost', e?.target?.value)}
                          className="w-24"
                          placeholder="0.00"
                        />
                      ) : (
                        <div className="text-sm text-foreground">
                          ${item?.estimatedCost?.toFixed(2) || '0.00'}
                        </div>
                      )}
                    </td>
                    
                    <td className="p-4">
                      {editingId === item?.id ? (
                        <Input
                          type="number"
                          value={editData?.salePrice}
                          onChange={(e) => handleChange('salePrice', e?.target?.value)}
                          className="w-24"
                          placeholder="0.00"
                        />
                      ) : (
                        <div className="text-sm text-foreground">
                          ${item?.salePrice?.toFixed(2) || '0.00'}
                        </div>
                      )}
                    </td>
                    
                    <td className="p-4">
                      <div className={`text-sm font-medium ${
                        (item?.profit || 0) >= 0 ? 'text-success' : 'text-error'
                      }`}>
                        ${(item?.profit || 0)?.toFixed(2)}
                      </div>
                    </td>
                  </>
                )}
                
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    {editingId === item?.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={handleSave}
                          iconName="Check"
                        />
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={handleCancel}
                          iconName="X"
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleEdit(item)}
                          iconName="Edit"
                        />
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onDeleteItem(item?.id)}
                          iconName="Trash2"
                          className="text-error hover:text-error"
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {workItems?.length === 0 && (
        <div className="p-12 text-center">
          <Icon name="Package" size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Aftermarket Work</h3>
          <p className="text-sm text-muted-foreground">
            Use the quick add toolbar above to add aftermarket products and services.
          </p>
        </div>
      )}
    </div>
  );
};

export default AftermarketWorkTable;