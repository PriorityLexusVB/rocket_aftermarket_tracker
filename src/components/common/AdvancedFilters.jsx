import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useFilterPresets } from '../../services/advancedFeaturesService';

const AdvancedFilters = ({
  filters,
  onFiltersChange,
  onClearFilters,
  pageType,
  filterConfig = {},
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const { presets, savePreset, deletePreset } = useFilterPresets(pageType);

  // Filter configurations for different page types
  const defaultFilterConfigs = {
    jobs: {
      status: {
        type: 'multiselect',
        label: 'Status',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'scheduled', label: 'Scheduled' },
          { value: 'quality_check', label: 'Quality Check' },
          { value: 'delivered', label: 'Delivered' }
        ]
      },
      priority: {
        type: 'select',
        label: 'Priority',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' }
        ]
      },
      dateRange: {
        type: 'daterange',
        label: 'Date Range'
      },
      overdue: {
        type: 'checkbox',
        label: 'Show Only Overdue'
      }
    },
    vehicles: {
      status: {
        type: 'select',
        label: 'Status',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'maintenance', label: 'Maintenance' },
          { value: 'retired', label: 'Retired' },
          { value: 'sold', label: 'Sold' }
        ]
      },
      make: {
        type: 'text',
        label: 'Make'
      },
      year: {
        type: 'numberrange',
        label: 'Year Range'
      }
    },
    vendors: {
      rating: {
        type: 'numberrange',
        label: 'Rating Range',
        min: 0,
        max: 5,
        step: 0.1
      },
      specialty: {
        type: 'text',
        label: 'Specialty'
      },
      active: {
        type: 'checkbox',
        label: 'Active Only'
      }
    }
  };

  const currentFilterConfig = { ...defaultFilterConfigs?.[pageType], ...filterConfig };

  const handleFilterChange = (filterKey, value) => {
    const newFilters = { ...filters, [filterKey]: value };
    
    // Remove empty filters
    if (!value || (Array.isArray(value) && value?.length === 0)) {
      delete newFilters?.[filterKey];
    }
    
    onFiltersChange(newFilters);
  };

  const handleClearAll = () => {
    onClearFilters();
    setIsExpanded(false);
  };

  const handleSavePreset = async () => {
    if (!presetName?.trim()) return;
    
    try {
      await savePreset(presetName?.trim(), filters, isPublic);
      setShowSaveDialog(false);
      setPresetName('');
      setIsPublic(false);
    } catch (error) {
      console.error('Failed to save filter preset:', error);
    }
  };

  const handleLoadPreset = (preset) => {
    onFiltersChange(preset?.filters);
    setIsExpanded(true);
  };

  const renderFilterInput = (filterKey, config) => {
    const value = filters?.[filterKey] || '';

    switch (config?.type) {
      case 'text':
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleFilterChange(filterKey, e?.target?.value)}
            placeholder={`Filter by ${config?.label?.toLowerCase()}`}
            className="w-full"
          />
        );

      case 'select':
        return (
          <Select
            value={value}
            onChange={(selectedValue) => handleFilterChange(filterKey, selectedValue)}
            options={[
              { value: '', label: `All ${config?.label}` },
              ...config?.options
            ]}
            className="w-full"
          />
        );

      case 'multiselect':
        return (
          <Select
            value={value}
            onChange={(selectedValue) => handleFilterChange(filterKey, selectedValue)}
            options={config?.options}
            multiple
            placeholder={`Select ${config?.label?.toLowerCase()}`}
            className="w-full"
          />
        );

      case 'daterange':
        return (
          <div className="flex space-x-2">
            <Input
              type="date"
              value={value?.start || ''}
              onChange={(e) => handleFilterChange(filterKey, { ...value, start: e?.target?.value })}
              placeholder="Start date"
              className="flex-1"
            />
            <Input
              type="date"
              value={value?.end || ''}
              onChange={(e) => handleFilterChange(filterKey, { ...value, end: e?.target?.value })}
              placeholder="End date"
              className="flex-1"
            />
          </div>
        );

      case 'numberrange':
        return (
          <div className="flex space-x-2">
            <Input
              type="number"
              value={value?.min || ''}
              onChange={(e) => handleFilterChange(filterKey, { ...value, min: e?.target?.value })}
              placeholder={`Min ${config?.label?.toLowerCase()}`}
              min={config?.min}
              max={config?.max}
              step={config?.step}
              className="flex-1"
            />
            <Input
              type="number"
              value={value?.max || ''}
              onChange={(e) => handleFilterChange(filterKey, { ...value, max: e?.target?.value })}
              placeholder={`Max ${config?.label?.toLowerCase()}`}
              min={config?.min}
              max={config?.max}
              step={config?.step}
              className="flex-1"
            />
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleFilterChange(filterKey, e?.target?.checked)}
              className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-ring focus:ring-2"
            />
            <span className="text-sm text-foreground">{config?.label}</span>
          </label>
        );

      default:
        return null;
    }
  };

  const activeFilterCount = Object.keys(filters)?.length;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className={`bg-card border border-border rounded-lg p-4 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            iconName={isExpanded ? 'ChevronUp' : 'ChevronDown'}
            iconPosition="left"
            className="flex items-center space-x-2"
          >
            Advanced Filters
          </Button>
          
          {hasActiveFilters && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {activeFilterCount} active
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                iconName="Save"
                iconPosition="left"
                className="flex items-center space-x-2"
              >
                Save Preset
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                iconName="X"
                iconPosition="left"
                className="flex items-center space-x-2"
              >
                Clear All
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter Presets */}
      {presets?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets?.map((preset) => (
            <Button
              key={preset?.id}
              variant="outline"
              size="sm"
              onClick={() => handleLoadPreset(preset)}
              className="relative group flex items-center"
            >
              <span>{preset?.name}</span>
              {preset?.is_public && (
                <Icon name="Globe" size={12} className="ml-1 opacity-60" />
              )}
              
              <button
                onClick={(e) => {
                  e?.stopPropagation();
                  deletePreset(preset?.id);
                }}
                className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-xs"
              >
                ×
              </button>
            </Button>
          ))}
        </div>
      )}

      {/* Filter Controls */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-border">
          {Object.entries(currentFilterConfig)?.map(([filterKey, config]) => (
            <div key={filterKey} className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {config?.label}
              </label>
              {renderFilterInput(filterKey, config)}
            </div>
          ))}
        </div>
      )}

      {/* Save Preset Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Save Filter Preset
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Preset Name
                </label>
                <Input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e?.target?.value)}
                  placeholder="Enter preset name"
                  className="w-full"
                />
              </div>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e?.target?.checked)}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-ring focus:ring-2"
                />
                <span className="text-sm text-foreground">
                  Make this preset public (visible to all users)
                </span>
              </label>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2"
              >
                Cancel
              </Button>
              
              <Button
                onClick={handleSavePreset}
                disabled={!presetName?.trim()}
                className="px-4 py-2"
              >
                Save Preset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;