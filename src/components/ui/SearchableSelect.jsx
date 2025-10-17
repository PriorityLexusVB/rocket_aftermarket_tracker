import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import { Portal } from './Portal';

/**
 * SearchableSelect Component with Mobile Native Select Support
 * Automatically detects mobile and renders native <select> for mobile devices
 * while keeping headless select with portal rendering for desktop
 */
const SearchableSelect = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select...",
  searchable = false,
  clearable = false,
  disabled = false,
  loading = false,
  error = null,
  className = "",
  optionLabel = "label",
  optionValue = "value",
  groupBy = null,
  renderOption = null,
  label = '',
  helperText = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Detect mobile device
  useEffect(() => {
    const checkIsMobile = () => {
      return window.matchMedia('(max-width: 767px)')?.matches;
    };
    
    setIsMobile(checkIsMobile());
    
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleResize = () => setIsMobile(mediaQuery?.matches);
    
    mediaQuery?.addEventListener('change', handleResize);
    return () => mediaQuery?.removeEventListener('change', handleResize);
  }, []);

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

  // Check if option is selected
  const isSelected = (option) => {
    return (option?.[optionValue] || option?.id) === value;
  };

  // Calculate dropdown position
  const calculateDropdownPosition = () => {
    if (containerRef?.current) {
      const rect = containerRef?.current?.getBoundingClientRect();
      setDropdownPosition({
        top: rect?.bottom + window.scrollY,
        left: rect?.left + window.scrollX,
        width: rect?.width
      });
    }
  };

  // Update position when opening dropdown
  useEffect(() => {
    if (isOpen && !isMobile) {
      calculateDropdownPosition();
    }
  }, [isOpen, isMobile]);

  // Handle click outside (desktop only)
  useEffect(() => {
    if (isMobile) return; // Skip for mobile
    
    const handleClickOutside = (event) => {
      if (containerRef?.current && !containerRef?.current?.contains(event?.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document?.addEventListener('mousedown', handleClickOutside);
    return () => document?.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile]);

  // Handle keyboard navigation (desktop only)
  const handleKeyDown = (e) => {
    if (isMobile) return; // Skip for mobile
    
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

  // Handle clear selection (desktop only)
  const handleClear = (e) => {
    e?.stopPropagation();
    onChange?.(null);
  };

  // ✅ FIXED: Use native select on mobile per user requirements
  if (isMobile) {
    return (
      <div className={`relative ${className}`}>
        <select
          value={value || ''}
          onChange={(e) => onChange?.(e?.target?.value || null)}
          disabled={disabled || loading}
          className={`
            w-full px-3 py-2 border rounded-lg
            ${error ? 'border-red-500' : 'border-gray-300'}
            ${disabled || loading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            focus:ring-1 focus:ring-blue-500 focus:border-blue-500
            appearance-none text-base
          `}
        >
          <option value="">{placeholder}</option>
          {options?.map((option) => (
            <option 
              key={option?.[optionValue] || option?.id} 
              value={option?.[optionValue] || option?.id}
            >
              {option?.[optionLabel] || option?.label || option?.name}
            </option>
          ))}
        </select>
        {/* Mobile select arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <Icon name="ChevronDown" size={16} className="text-gray-400" />
        </div>
        {error && (
          <div className="mt-1 text-sm text-red-600">{error}</div>
        )}
      </div>
    );
  }

  // ✅ ENHANCED: Desktop headless dropdown with better portal rendering
  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        className={`
          w-full px-3 py-2 text-left border rounded-lg
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${disabled || loading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-gray-400'}
          ${isOpen ? 'ring-1 ring-blue-500 border-blue-500' : ''}
          focus:ring-1 focus:ring-blue-500 focus:border-blue-500
          flex items-center justify-between
        `}
      >
        {/* Display text */}
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? (selectedOption?.[optionLabel] || selectedOption?.label) : placeholder}
        </span>
        
        {/* Icons */}
        <div className="flex items-center space-x-1">
          {loading && <Icon name="Loader2" size={16} className="animate-spin text-gray-400" />}
          {clearable && selectedOption && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              <Icon name="X" size={14} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
          <Icon 
            name={isOpen ? "ChevronUp" : "ChevronDown"} 
            size={16} 
            className="text-gray-400" 
          />
        </div>
      </button>
      {/* ✅ ENHANCED: Portal-rendered dropdown with proper z-index */}
      {isOpen && typeof window !== 'undefined' && (
        <Portal>
          <div 
            className="fixed inset-0 z-50"
            onClick={() => setIsOpen(false)}
          >
            <div 
              style={{
                position: 'absolute',
                top: `${dropdownPosition?.top}px`,
                left: `${dropdownPosition?.left}px`,
                width: `${dropdownPosition?.width}px`,
                zIndex: 9999
              }}
              className="bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden"
              onClick={(e) => e?.stopPropagation()}
            >
              {/* Search input */}
              {searchable && (
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e?.target?.value)}
                    placeholder="Search..."
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
              )}

              {/* Options list */}
              <div className="max-h-48 overflow-auto">
                {filteredOptions?.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    {searchTerm ? 'No results found' : 'No options available'}
                  </div>
                ) : (
                  filteredOptions?.map((option) => (
                    <button
                      key={option?.[optionValue] || option?.id}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={`
                        w-full px-3 py-2 text-left text-sm hover:bg-gray-50
                        ${isSelected(option) ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}
                        focus:bg-gray-50 focus:outline-none
                      `}
                    >
                      {option?.[optionLabel] || option?.label || option?.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
      {/* Error message */}
      {error && (
        <div className="mt-1 text-sm text-red-600">{error}</div>
      )}
    </div>
  );
};

export default SearchableSelect;