import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';

/**
 * SearchableSelect Component - Enhanced dropdown with search, filtering, and grouping
 * @param {Object} props
 * @param {Array} props.options - Array of option objects with id, name, displayName
 * @param {string|null} props.value - Currently selected value
 * @param {Function} props.onChange - Callback when selection changes
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.searchable - Enable search functionality
 * @param {boolean} props.clearable - Enable clear functionality
 * @param {string} props.groupBy - Group options by this field
 * @param {Function} props.renderOption - Custom option render function
 * @param {boolean} props.disabled - Disable the select
 * @param {string} props.className - Additional CSS classes
 */
const SearchableSelect = ({
  options = [],
  value = null,
  onChange,
  placeholder = 'Select an option...',
  searchable = true,
  clearable = true,
  groupBy = null,
  renderOption = null,
  disabled = false,
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
  const listRef = useRef(null);

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

  // Find selected option
  const selectedOption = options?.find(opt => opt?.id === value);

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
          handleSelect(filteredOptions?.[highlightedIndex]);
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

  // Handle option selection
  const handleSelect = (option) => {
    onChange?.(option?.id);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  // Handle clear selection
  const handleClear = (e) => {
    e?.stopPropagation();
    onChange?.(null);
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
  const defaultRenderOption = (option, isHighlighted) => (
    <div className={`px-3 py-2 cursor-pointer transition-colors ${
      isHighlighted 
        ? 'bg-blue-50 text-blue-900' :'text-gray-900 hover:bg-gray-50'
    }`}>
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
  );

  const optionRenderer = renderOption || defaultRenderOption;

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
        className={`relative w-full border rounded-lg px-3 py-2 bg-white cursor-pointer transition-colors ${
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
          <span className={`block truncate ${
            selectedOption ? 'text-gray-900' : 'text-gray-500'
          }`}>
            {selectedOption?.displayName || selectedOption?.name || placeholder}
          </span>
          
          <div className="flex items-center space-x-1">
            {clearable && selectedOption && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                tabIndex={-1}
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

          {/* Options list */}
          <div 
            ref={listRef}
            className="max-h-48 overflow-y-auto"
            role="listbox"
          >
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
                    return (
                      <div
                        key={option?.id}
                        onClick={() => handleSelect(option)}
                        role="option"
                        aria-selected={value === option?.id}
                      >
                        {optionRenderer(option, highlightedIndex === globalIndex)}
                      </div>
                    );
                  })}
                </div>
              )))
            ) : (
              // Flat options
              (filteredOptions?.map((option, index) => (
                <div
                  key={option?.id}
                  onClick={() => handleSelect(option)}
                  role="option"
                  aria-selected={value === option?.id}
                >
                  {optionRenderer(option, highlightedIndex === index)}
                </div>
              )))
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

export default SearchableSelect;