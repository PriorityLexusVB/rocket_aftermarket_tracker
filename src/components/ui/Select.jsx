// components/ui/Select.jsx - Shadcn style Select with ResizeObserver optimization
import React, { useState, useCallback, useRef, useEffect, useMemo, createContext, useContext } from "react";
import ReactDOM from 'react-dom';
import { ChevronDown, Check, Search, X } from "lucide-react";
import { cn } from "../../utils/cn";
import Button from "./Button";
import Input from "./Input";

// Create Select context for managing state between components
const SelectContext = createContext({});

const useSelectContext = () => {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('Select components must be used within a Select provider');
  }
  return context;
};

// SelectTrigger - The clickable button that opens the dropdown
const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { isOpen, toggleOpen, disabled, hasValue } = useSelectContext();
  
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white text-black px-3 py-2 text-sm",
        !hasValue && "text-muted-foreground",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={toggleOpen}
      disabled={disabled}
      {...props}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
    </button>
  );
});

SelectTrigger.displayName = "SelectTrigger";

// SelectValue - Shows the selected value or placeholder
const SelectValue = React.forwardRef(({ placeholder, className, ...props }, ref) => {
  const { selectedDisplay } = useSelectContext();
  
  return (
    <span ref={ref} className={cn("truncate", className)} {...props}>
      {selectedDisplay || placeholder}
    </span>
  );
});

SelectValue.displayName = "SelectValue";

// SelectContent - The dropdown container
const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const { isOpen, dropdownPosition, dropdownRef } = useSelectContext();
  
  if (!isOpen) return null;

  return ReactDOM?.createPortal(
    <div
      ref={dropdownRef}
      className={cn(
        "absolute w-full mt-1 bg-white text-black border border-border rounded-md shadow-lg z-50 max-h-60 overflow-auto",
        className
      )}
      style={{
        ...dropdownPosition,
        maxHeight: '240px',
      }}
      {...props}
    >
      {children}
    </div>,
    document.body
  );
});

SelectContent.displayName = "SelectContent";

// SelectItem - Individual option in the dropdown
const SelectItem = React.forwardRef(({ className, children, value, ...props }, ref) => {
  const { selectValue, isSelected, closeDropdown } = useSelectContext();
  
  const handleSelect = useCallback(() => {
    selectValue(value);
    closeDropdown();
  }, [value, selectValue, closeDropdown]);
  
  const selected = isSelected(value);
  
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm hover:bg-accent",
        selected && "bg-primary text-primary-foreground",
        className
      )}
      onClick={handleSelect}
      {...props}
    >
      <span className="flex-1">{children}</span>
      {selected && <Check className="h-4 w-4 ml-2" />}
    </div>
  );
});

SelectItem.displayName = "SelectItem";

// Main Select component that provides context
const Select = React.forwardRef(({
    className,
    options = [],
    value,
    placeholder = "Select an option",
    multiple = false,
    disabled = false,
    required = false,
    label,
    error,
    searchable = false,
    clearable = false,
    loading = false,
    id,
    name,
    onChange,
    onValueChange,
    children,
    ...props
}, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [dropdownPosition, setDropdownPosition] = useState({});
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const selectId = id || `select-${useMemo(() => Math.random()?.toString(36)?.substr(2, 9), [])}`;

    const filteredOptions = useMemo(() => {
        if (!searchable || !searchTerm) return options;
        return options?.filter(option =>
            option?.label?.toLowerCase()?.includes(searchTerm?.toLowerCase())
        );
    }, [options, searchable, searchTerm]);

    const selectedDisplay = useMemo(() => {
        if (!value) return placeholder;
        if (multiple) {
            const selectedOptions = options?.filter(opt => value?.includes(opt?.value));
            if (selectedOptions?.length === 0) return placeholder;
            if (selectedOptions?.length === 1) return selectedOptions?.[0]?.label;
            return `${selectedOptions?.length} items selected`;
        }
        const selectedOption = options?.find(opt => opt?.value === value);
        return selectedOption ? selectedOption?.label : placeholder;
    }, [value, placeholder, multiple, options]);

    useEffect(() => {
        if (isOpen && buttonRef?.current) {
            const rect = buttonRef?.current?.getBoundingClientRect();
            setDropdownPosition({
                top: rect?.bottom + window.scrollY,
                left: rect?.left + window.scrollX,
                width: rect?.width,
            });
        }
    }, [isOpen]);

    const toggleOpen = useCallback(() => {
        if (!disabled) setIsOpen(prev => !prev);
    }, [disabled]);

    const selectValue = useCallback((optionValue) => {
        if (multiple) {
            const newValue = value || [];
            const updatedValue = newValue?.includes(optionValue)
                ? newValue?.filter(v => v !== optionValue)
                : [...newValue, optionValue];
            onChange?.(updatedValue);
            onValueChange?.(updatedValue);
        } else {
            onChange?.(optionValue);
            onValueChange?.(optionValue);
            setIsOpen(false);
        }
    }, [multiple, value, onChange, onValueChange]);

    const closeDropdown = useCallback(() => {
        setIsOpen(false);
    }, []);

    const handleClear = useCallback((e) => {
        e?.stopPropagation();
        const clearValue = multiple ? [] : '';
        onChange?.(clearValue);
        onValueChange?.(clearValue);
    }, [multiple, onChange, onValueChange]);

    const isSelected = useCallback((optionValue) => {
        return multiple ? (value || [])?.includes(optionValue) : value === optionValue;
    }, [multiple, value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                isOpen &&
                dropdownRef?.current && !dropdownRef?.current?.contains(event?.target) &&
                buttonRef?.current && !buttonRef?.current?.contains(event?.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const hasValue = multiple ? value?.length > 0 : value !== undefined && value !== '';

    const contextValue = {
        isOpen,
        toggleOpen,
        selectValue,
        closeDropdown,
        selectedDisplay,
        isSelected,
        disabled,
        hasValue,
        dropdownPosition,
        dropdownRef: dropdownRef,
        buttonRef: buttonRef
    };

    // If children are provided (shadcn style), render with context provider
    if (children) {
        return (
            <SelectContext.Provider value={contextValue}>
                <div className={cn("relative w-full", className)} ref={ref}>
                    {label && (
                        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1">
                            {label}{required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    )}
                    <div className="relative" ref={buttonRef}>
                        {children}
                    </div>
                    {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
                </div>
            </SelectContext.Provider>
        );
    }

    // Legacy usage - render the original Select component
    return (
        <div className={cn("relative w-full", className)}>
            {label && (
                <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
            )}
            <div className="relative">
                <button
                    ref={buttonRef}
                    id={selectId}
                    type="button"
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white text-black px-3 py-2 text-sm",
                        !hasValue && "text-muted-foreground"
                    )}
                    onClick={toggleOpen}
                    disabled={disabled || loading}
                >
                    <span className="truncate">{selectedDisplay}</span>
                    <div className="flex items-center">
                        {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>}
                        {clearable && hasValue && !loading && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear}><X className="h-4 w-4" /></Button>
                        )}
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    </div>
                </button>
                {isOpen && ReactDOM?.createPortal(
                    <div
                        ref={dropdownRef}
                        className="absolute w-full mt-1 bg-white text-black border border-border rounded-md shadow-lg z-50"
                        style={{
                            ...dropdownPosition,
                            maxHeight: '240px',
                        }}
                    >
                        {searchable && (
                            <div className="p-2">
                                <Input
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e?.target?.value)}
                                    className="pl-8"
                                    icon={<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />}
                                />
                            </div>
                        )}
                        <div className="max-h-60 overflow-auto">
                            {filteredOptions?.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-gray-500">No options found.</div>
                            ) : (
                                filteredOptions?.map((option) => (
                                    <div
                                        key={option?.value}
                                        className={cn(
                                            "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm hover:bg-accent",
                                            isSelected(option?.value) && "bg-primary text-primary-foreground"
                                        )}
                                        onClick={() => selectValue(option?.value)}
                                    >
                                        <span className="flex-1">{option?.label}</span>
                                        {isSelected(option?.value) && !multiple && <Check className="h-4 w-4 ml-2" />}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>,
                    document.body
                )}
            </div>
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
    );
});

Select.displayName = "Select";

// Export both default and named exports
export default Select;
export { SelectTrigger, SelectValue, SelectContent, SelectItem };