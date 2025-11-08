import React from 'react'
import { cn } from '../../utils/cn'

/**
 * Enhanced Checkbox component with proper click handling per user requirements
 * Fixes checkbox not toggling issue mentioned in mobile New Deal form
 */
const Checkbox = ({
  checked = false,
  onChange,
  disabled = false,
  label,
  description,
  className = '',
  size = 'md',
  color = 'blue',
  ...props
}) => {
  // ✅ FIXED: Proper boolean handling and click propagation stopping
  const handleChange = (event) => {
    // Stop propagation to prevent parent click events
    event?.stopPropagation()

    if (disabled || !onChange) return

    // Ensure boolean value for proper toggling
    const newValue = !checked
    onChange(newValue, event)
  }

  // Size variants
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  // Color variants
  const colorClasses = {
    blue: 'text-blue-600 focus:ring-blue-500',
    green: 'text-green-600 focus:ring-green-500',
    red: 'text-red-600 focus:ring-red-500',
    gray: 'text-gray-600 focus:ring-gray-500',
  }

  return (
    <div className={cn('flex items-start', className)}>
      <div className="flex items-center h-5">
        <input
          type="checkbox"
          checked={Boolean(checked)} // ✅ FIXED: Ensure boolean type
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            // Base styles
            'border-gray-300 rounded focus:ring-2 focus:ring-offset-0',
            // Size
            sizeClasses?.[size],
            // Color
            colorClasses?.[color],
            // Disabled state
            disabled && 'opacity-50 cursor-not-allowed',
            // Interactive state
            !disabled && 'cursor-pointer hover:border-gray-400'
          )}
          {...props}
        />
      </div>
      {(label || description) && (
        <div className="ml-3 text-sm">
          {label && (
            <label
              className={cn(
                'font-medium text-gray-900',
                disabled && 'opacity-50 cursor-not-allowed',
                !disabled && 'cursor-pointer'
              )}
              onClick={!disabled ? handleChange : undefined}
            >
              {label}
            </label>
          )}
          {description && (
            <p className={cn('text-gray-500', disabled && 'opacity-50')}>{description}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default Checkbox
