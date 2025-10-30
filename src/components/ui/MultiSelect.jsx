import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';

/**
 * MultiSelect Component - Enhanced multi-selection dropdown with search and filtering
 * @param {Object} props
 * @param {Array} props.options - Array of option objects with id, name, displayName
 * @param {Array} props.value - Array of currently selected values
 * @param {Function} props.onChange - Callback when selection changes
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.searchable - Enable search functionality
 * @param {boolean} props.clearable - Enable clear all functionality
 * @param {string} props.groupBy - Group options by this field
 * @param {Function} props.renderOption - Custom option render function
 * @param {Function} props.renderSelected - Custom selected items render function
 * @param {boolean} props.disabled - Disable the select
 * @param {number} props.maxSelections - Maximum number of selections allowed
 * @param {string} props.className - Additional CSS classes
 */
const MultiSelect = ({
  options = [],
  value = [],
  onChange,
  placeholder = 'Select options...',
  searchable = true,
  clearable = true,
  groupBy = null,
  renderOption = null,
  renderSelected = null,
  disabled = false,
  maxSelections = null,
  className = '',
  label = '',
  error = '',
  helperText = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Filter options based on search term
  useEffect(() => {
    if (!searchTerm?.trim()) {
      setFilteredOptions(options);
      return;
    }

    const term = searchTerm?.toLowerCase();
    const filtered = options?.filter(option => {
      const searchFields = [
        option?.name,
        option?.displayName,
        option?.category,
        option?.brand,
        option?.specialty,
        option?.department,
        option?.email
      ]?.filter(Boolean);

      return searchFields?.some(field => 
        field?.toLowerCase()?.includes(term)
      );
    });

    setFilteredOptions(filtered);
    setHighlightedIndex(-1);
  }, [searchTerm, options]);

  // Get selected options
  const selectedOptions = options?.filter(opt => value?.includes(opt?.id)) || [];

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef?.current && !containerRef?.current?.contains(event?.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document?.addEventListener('mousedown', handleClickOutside);
    return () => document?.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e?.key === 'Enter' || e?.key === ' ' || e?.key === 'ArrowDown') {
        e?.preventDefault();
        setIsOpen(true);
        if (searchable) {
          setTimeout(() => searchInputRef?.current?.focus(), 0);
        }
      }
      return;
    }

    switch (e?.key) {
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
      case 'ArrowDown':
        e?.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions?.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e?.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions?.length - 1
        );
        break;
      case 'Enter':
        e?.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions?.[highlightedIndex]) {
          handleToggleOption(filteredOptions?.[highlightedIndex]);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Handle option toggle
  const handleToggleOption = (option) => {
    const isSelected = value?.includes(option?.id);
    let newValue;

    if (isSelected) {
      // Remove from selection
      newValue = value?.filter(id => id !== option?.id);
    } else {
      // Add to selection (check max limit)
      if (maxSelections && value?.length >= maxSelections) {
        return; // Max selections reached
      }
      newValue = [...(value || []), option?.id];
    }

    onChange?.(newValue);
  };

  // Handle remove individual selection
  const handleRemoveSelection = (optionId, e) => {
    e?.stopPropagation();
    let newValue = value?.filter(id => id !== optionId);
    onChange?.(newValue);
  };

  // Handle clear all selections
  const handleClearAll = (e) => {
    e?.stopPropagation();
    onChange?.([]);
  };

  // Group options if groupBy is specified
  const groupedOptions = groupBy && filteredOptions?.length > 0 
    ? filteredOptions?.reduce((groups, option) => {
        const group = option?.[groupBy] || 'Other';
        if (!groups?.[group]) groups[group] = [];
        groups?.[group]?.push(option);
        return groups;
      }, {})
    : null;

  // Default option renderer
  const defaultRenderOption = (option, isHighlighted, isSelected) => (
    <div className={`flex items-center px-3 py-2 cursor-pointer transition-colors ${
      isHighlighted 
        ? 'bg-blue-50 text-blue-900' :'text-gray-900 hover:bg-gray-50'
    }`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => {}} // Handled by parent click
        className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        tabIndex={-1}
      />
      <div className="flex-1">
        <div className="font-medium">
          {option?.displayName || option?.name}
        </div>
        {option?.category && (
          <div className="text-xs text-gray-500 mt-1">
            {option?.category}
          </div>
        )}
        {option?.specialty && (
          <div className="text-xs text-gray-500 mt-1">
            {option?.specialty}
          </div>
        )}
        {option?.email && (
          <div className="text-xs text-gray-500 mt-1">
            {option?.email}
          </div>
        )}
      </div>
    </div>
  );

  // Default selected item renderer
  const defaultRenderSelected = (option) => (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
      {option?.name}
      <button
        type="button"
        onClick={(e) => handleRemoveSelection(option?.id, e)}
        className="ml-1 hover:bg-blue-200 rounded p-0.5"
      >
        <Icon name="X" size={12} />
      </button>
    </span>
  );

  const optionRenderer = renderOption || defaultRenderOption;
  const selectedRenderer = renderSelected || defaultRenderSelected;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      {/* Main select button */}
      <div
        className={`relative w-full border rounded-lg px-3 py-2 bg-white cursor-pointer transition-colors min-h-[2.5rem] ${
          disabled 
            ? 'bg-gray-50 cursor-not-allowed border-gray-200' 
            : isOpen 
              ? 'border-blue-500 ring-1 ring-blue-500' 
              : error
                ? 'border-red-300 hover:border-red-400' :'border-gray-300 hover:border-gray-400'
        }`}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!isOpen && searchable) {
            setTimeout(() => searchInputRef?.current?.focus(), 0);
          }
        }}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-h-[1.25rem]">
            {selectedOptions?.length === 0 ? (
              <span className="text-gray-500">{placeholder}</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selectedOptions?.map(option => (
                  <div key={option?.id}>
                    {selectedRenderer(option)}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-1 ml-2">
            {clearable && selectedOptions?.length > 0 && !disabled && (
              <button
                type="button"
                onClick={handleClearAll}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                tabIndex={-1}
                title="Clear all"
              >
                <Icon name="X" size={14} className="text-gray-400" />
              </button>
            )}
            <Icon 
              name="ChevronDown" 
              size={16} 
              className={`text-gray-400 transition-transform ${
                isOpen ? 'transform rotate-180' : ''
              }`} 
            />
          </div>
        </div>

        {/* Selection count indicator */}
        {selectedOptions?.length > 0 && (
          <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {selectedOptions?.length}
          </div>
        )}
      </div>
      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {/* Search input */}
          {searchable && (
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Icon 
                  name="Search" 
                  size={16} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e?.target?.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
          )}

          {/* Selection summary */}
          {selectedOptions?.length > 0 && (
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
              {selectedOptions?.length} selected
              {maxSelections && ` of ${maxSelections} max`}
            </div>
          )}

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto" role="listbox">
            {filteredOptions?.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {searchTerm ? 'No matching options found' : 'No options available'}
              </div>
            ) : groupedOptions ? (
              // Grouped options
              (Object?.entries(groupedOptions)?.map(([groupName, groupOptions]) => (
                <div key={groupName}>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200">
                    {groupName}
                  </div>
                  {groupOptions?.map((option, index) => {
                    const globalIndex = filteredOptions?.indexOf(option);
                    const isSelected = value?.includes(option?.id);
                    return (
                      <div
                        key={option?.id}
                        onClick={() => handleToggleOption(option)}
                        role="option"
                        aria-selected={isSelected}
                      >
                        {optionRenderer(option, highlightedIndex === globalIndex, isSelected)}
                      </div>
                    );
                  })}
                </div>
              )))
            ) : (
              // Flat options
              (filteredOptions?.map((option, index) => {
                const isSelected = value?.includes(option?.id);
                return (
                  <div
                    key={option?.id}
                    onClick={() => handleToggleOption(option)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {optionRenderer(option, highlightedIndex === index, isSelected)}
                  </div>
                );
              }))
            )}
          </div>
        </div>
      )}
      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {/* Helper text */}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
};

export default MultiSelect;