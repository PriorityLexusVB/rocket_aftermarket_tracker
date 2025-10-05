import React, { useState } from 'react';

import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const FilterPanel = ({ 
  filters, 
  onFilterChange, 
  onClearFilters, 
  savedPresets = [],
  onSavePreset,
  onLoadPreset 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);

  const makeOptions = [
    { value: '', label: 'All Makes' },
    { value: 'toyota', label: 'Toyota' },
    { value: 'honda', label: 'Honda' },
    { value: 'ford', label: 'Ford' },
    { value: 'chevrolet', label: 'Chevrolet' },
    { value: 'nissan', label: 'Nissan' },
    { value: 'hyundai', label: 'Hyundai' },
    { value: 'kia', label: 'Kia' },
    { value: 'volkswagen', label: 'Volkswagen' },
    { value: 'bmw', label: 'BMW' },
    { value: 'mercedes', label: 'Mercedes-Benz' }
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'available', label: 'Available' },
    { value: 'in-work', label: 'In Work' },
    { value: 'completed', label: 'Completed' },
    { value: 'sold', label: 'Sold' }
  ];

  const yearOptions = [
    { value: '', label: 'All Years' },
    ...Array.from({ length: 15 }, (_, i) => {
      const year = new Date()?.getFullYear() - i;
      return { value: year?.toString(), label: year?.toString() };
    })
  ];

  const handleFilterChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleSavePreset = () => {
    if (presetName?.trim()) {
      onSavePreset(presetName?.trim(), filters);
      setPresetName('');
      setShowPresetInput(false);
    }
  };

  const hasActiveFilters = Object.values(filters)?.some(value => value && value !== '');

  return (
    <div className="bg-card rounded-lg border border-border shadow-elevation-1 mb-6">
      {/* Filter Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-foreground">Filters</h3>
            {hasActiveFilters && (
              <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                Active
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                iconName="X"
                iconPosition="left"
                className=""
              >
                Clear All
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              iconName={isExpanded ? "ChevronUp" : "ChevronDown"}
              iconPosition="right"
              className=""
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </div>
      {/* Quick Filters - Always Visible */}
      <div className="px-6 py-4 border-b border-border bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            type="search"
            placeholder="Search VIN, Stock #, Owner Phone..."
            value={filters?.search || ''}
            onChange={(e) => handleFilterChange('search', e?.target?.value)}
            className="w-full"
            helperText=""
            maxLength={undefined}
            style={{}}
          />
          
          <Select
            placeholder="Select Make"
            options={makeOptions}
            value={filters?.make || ''}
            onChange={(value) => handleFilterChange('make', value)}
          />
          
          <Select
            placeholder="Select Status"
            options={statusOptions}
            value={filters?.status || ''}
            onChange={(value) => handleFilterChange('status', value)}
          />
          
          <Select
            placeholder="Select Year"
            options={yearOptions}
            value={filters?.year || ''}
            onChange={(value) => handleFilterChange('year', value)}
          />
        </div>
      </div>
      {/* Advanced Filters - Expandable */}
      {isExpanded && (
        <div className="px-6 py-4 space-y-4">
          {/* Date Range Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              type="date"
              label="Added From"
              placeholder=""
              value={filters?.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e?.target?.value)}
              helperText=""
              maxLength={undefined}
              style={{}}
            />
            
            <Input
              type="date"
              label="Added To"
              placeholder=""
              value={filters?.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e?.target?.value)}
              helperText=""
              maxLength={undefined}
              style={{}}
            />
            
            <Input
              type="number"
              label="Min Profit ($)"
              placeholder="0.00"
              value={filters?.minProfit || ''}
              onChange={(e) => handleFilterChange('minProfit', e?.target?.value)}
              helperText=""
              maxLength={undefined}
              style={{}}
            />
          </div>

          {/* Additional Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Has Aftermarket Work"
              placeholder="Any"
              options={[
                { value: '', label: 'Any' },
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' }
              ]}
              value={filters?.hasAftermarket || ''}
              onChange={(value) => handleFilterChange('hasAftermarket', value)}
            />
            
            <Input
              type="text"
              label="Model Contains"
              placeholder="Enter model name..."
              value={filters?.model || ''}
              onChange={(e) => handleFilterChange('model', e?.target?.value)}
              helperText=""
              maxLength={undefined}
              style={{}}
            />
            
            <Select
              label="Sort By"
              placeholder="Default"
              options={[
                { value: '', label: 'Default' },
                { value: 'year-desc', label: 'Year (Newest)' },
                { value: 'year-asc', label: 'Year (Oldest)' },
                { value: 'profit-desc', label: 'Profit (Highest)' },
                { value: 'profit-asc', label: 'Profit (Lowest)' },
                { value: 'make-asc', label: 'Make (A-Z)' }
              ]}
              value={filters?.sortBy || ''}
              onChange={(value) => handleFilterChange('sortBy', value)}
            />
          </div>

          {/* Preset Management */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground">Filter Presets</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPresetInput(!showPresetInput)}
                iconName="Save"
                iconPosition="left"
                disabled={!hasActiveFilters}
                className=""
              >
                Save Current
              </Button>
            </div>

            {showPresetInput && (
              <div className="flex items-center space-x-2 mb-3">
                <Input
                  type="text"
                  placeholder="Preset name..."
                  value={presetName}
                  onChange={(e) => setPresetName(e?.target?.value)}
                  className="flex-1"
                  helperText=""
                  maxLength={undefined}
                  style={{}}
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSavePreset}
                  disabled={!presetName?.trim()}
                  className=""
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPresetInput(false);
                    setPresetName('');
                  }}
                  className=""
                >
                  Cancel
                </Button>
              </div>
            )}

            {savedPresets?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {savedPresets?.map((preset) => (
                  <Button
                    key={preset?.id}
                    variant="outline"
                    size="sm"
                    onClick={() => onLoadPreset(preset)}
                    className="text-xs"
                  >
                    {preset?.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;