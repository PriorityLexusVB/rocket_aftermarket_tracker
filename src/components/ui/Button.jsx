import React from 'react';
import { cn } from '../../utils/cn';

const Button = ({ 
  children, 
  className, 
  variant = 'default', 
  size = 'default', 
  disabled = false,
  type = 'button',
  onClick,
  ...props 
}) => {
  const baseStyles = `
    inline-flex items-center justify-center rounded-md font-medium 
    transition-colors focus-visible:outline-none focus-visible:ring-2 
    focus-visible:ring-ring focus-visible:ring-offset-2 
    disabled:pointer-events-none disabled:opacity-50
    cursor-pointer
  `;

  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90 bg-blue-600 text-white hover:bg-blue-700',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground border-gray-300 bg-white hover:bg-gray-50',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 bg-gray-200 text-gray-900 hover:bg-gray-300',
    ghost: 'hover:bg-accent hover:text-accent-foreground hover:bg-gray-100',
    link: 'text-primary underline-offset-4 hover:underline text-blue-600',
  };

  const sizes = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-9 rounded-md px-3 text-xs',
    lg: 'h-11 rounded-md px-8 text-base',
    icon: 'h-10 w-10',
  };

  const handleClick = (e) => {
    if (disabled) {
      e?.preventDefault();
      e?.stopPropagation();
      return false;
    }
    
    // Only call onClick if it exists and is a function
    if (onClick && typeof onClick === 'function') {
      try {
        onClick(e);
      } catch (error) {
        console.error('Button click handler error:', error);
      }
    }
  };

  return (
    <button
      type={type}
      className={cn(
        baseStyles,
        variants?.[variant] || variants?.default,
        sizes?.[size] || sizes?.default,
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        !disabled && 'active:scale-95 transform transition-transform duration-75',
        className
      )}
      disabled={disabled}
      onClick={handleClick}
      onMouseDown={(e) => e?.preventDefault()}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;