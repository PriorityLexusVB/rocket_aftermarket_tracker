import React from 'react';
import { cn } from '../../utils/cn';

const Input = React.forwardRef(({ 
  className, 
  type = 'text', 
  error,
  label,
  id,
  required = false,
  ...props 
}, ref) => {
  // H1: Generate unique ID if not provided
  const inputId = id || `input-${Math.random()?.toString(36)?.substr(2, 9)}`;
  
  return (
    <div className="w-full">
      {/* H1: Proper label with htmlFor binding */}
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1 cursor-pointer select-none"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {/* H5: Mobile-friendly input with minimum 44px height */}
      <input
        type={type}
        id={inputId}
        ref={ref}
        className={cn(
          // H5: Mobile accessibility - minimum 44px touch target
          "flex h-11 min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2",
          "text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          // H1: Error state styling
          error ? "border-red-300 focus-visible:ring-red-500" : "border-gray-300",
          className
        )}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      
      {/* H1: Error message with proper ARIA */}
      {error && (
        <div 
          id={`${inputId}-error`}
          className="mt-1 text-xs text-red-600" 
          role="alert" 
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

Input.displayName = "Input";

export default Input;