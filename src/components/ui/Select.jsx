// components/ui/Select.jsx - Shadcn style Select with ResizeObserver optimization
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ReactDOM from 'react-dom';
import { ChevronDown, Check, Search, X } from "lucide-react";
import { cn } from "../../utils/cn";
import Button from "./Button";
import Input from "./Input";

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

    const handleToggle = useCallback(() => {
        if (!disabled) setIsOpen(prev => !prev);
    }, [disabled]);

    const handleOptionSelect = useCallback((option) => {
        if (multiple) {
            const newValue = value || [];
            const updatedValue = newValue?.includes(option?.value)
                ? newValue?.filter(v => v !== option?.value)
                : [...newValue, option?.value];
            onChange(updatedValue);
        } else {
            onChange(option?.value);
            setIsOpen(false);
        }
    }, [multiple, value, onChange]);

    const handleClear = useCallback((e) => {
        e?.stopPropagation();
        onChange(multiple ? [] : '');
    }, [multiple, onChange]);

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
                    onClick={handleToggle}
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
                                        onClick={() => handleOptionSelect(option)}
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

export default Select;