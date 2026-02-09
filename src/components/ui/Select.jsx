// src/components/ui/Select.jsx
import React from 'react'
import { cn } from '../../utils/cn'

const Select = React.forwardRef(
  ({ className, children, error, label, id, required = false, ...props }, ref) => {
    // H1: Generate unique ID if not provided
    const selectId = id || `select-${Math.random()?.toString(36)?.substr(2, 9)}`

    return (
      <div className="w-full">
        {/* H1: Proper label with htmlFor binding */}
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-foreground mb-1 cursor-pointer select-none"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* H5: Mobile-friendly select with minimum 44px height */}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            // H5: Mobile accessibility - minimum 44px touch target
            'flex h-11 min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2',
            'text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            // H1: Error state styling
            error ? 'border-destructive focus-visible:ring-destructive' : 'border-input',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : undefined}
          {...props}
        >
          {children}
        </select>

        {/* H1: Error message with proper ARIA */}
        {error && (
          <div
            id={`${selectId}-error`}
            className="mt-1 text-xs text-red-600"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
