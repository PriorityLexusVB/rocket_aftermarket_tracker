import React from 'react'
import { cn } from '../../utils/cn'

const Button = React.forwardRef(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      disabled,
      children,
      iconName,
      iconPosition,
      ...props
    },
    ref
  ) => {
    // Destructure iconName and iconPosition to prevent them from being forwarded to the DOM
    // These props are used internally but should not appear as attributes on the <button> element
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          // H5: Base mobile-friendly styling with minimum 44px touch target
          'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          'min-h-[44px]', // H5: Mobile accessibility - minimum 44px touch target

          // H3: Variant styles - only disable pointer events when actually disabled, not for validation
          {
            default: 'bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-4 py-2',
            destructive:
              'bg-destructive text-destructive-foreground hover:bg-destructive/90 h-11 px-4 py-2',
            outline:
              'border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-4 py-2',
            secondary:
              'bg-secondary text-secondary-foreground hover:bg-secondary/80 h-11 px-4 py-2',
            ghost: 'hover:bg-accent hover:text-accent-foreground h-11 px-4 py-2',
            link: 'text-primary underline-offset-4 hover:underline h-11 px-4 py-2',
          }?.[variant],

          // Size variations with mobile-friendly touch targets
          {
            default: 'h-11 px-4 py-2',
            sm: 'h-9 min-h-[36px] rounded-md px-3',
            lg: 'h-12 min-h-[48px] rounded-md px-8',
            icon: 'h-11 w-11 min-h-[44px] min-w-[44px]',
          }?.[size],

          // H3: Disabled state - maintain visual feedback but allow interaction when not actually disabled
          disabled && 'opacity-50 cursor-not-allowed',

          className
        )}
        // H1: Enhanced accessibility attributes
        aria-disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
