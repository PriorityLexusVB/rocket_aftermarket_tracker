import React from 'react'
import { cn } from '../../utils/cn'

const MobileCard = ({
  children,
  className = '',
  padding = 'p-4',
  shadow = 'shadow-sm',
  border = 'border border-white/10',
  rounded = 'rounded-lg',
  background = 'bg-white/5',
  ...props
}) => {
  return (
    <div
      className={cn(background, padding, shadow, border, rounded, 'w-full', className)}
      {...props}
    >
      {children}
    </div>
  )
}

const MobileButton = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'

  const variants = {
    primary: 'bg-white text-[#0B0F14] hover:bg-white/90 focus:ring-white/20',
    secondary: 'bg-white/10 hover:bg-white/20 text-gray-100 focus:ring-white/20',
    outline:
      'border border-white/10 bg-transparent hover:bg-white/5 text-gray-200 focus:ring-white/20',
    ghost: 'hover:bg-white/5 text-gray-200 focus:ring-white/20',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-sm min-h-[40px]',
    lg: 'px-6 py-3 text-base min-h-[44px]',
  }

  return (
    <button
      className={cn(
        baseStyles,
        variants?.[variant],
        sizes?.[size],
        fullWidth ? 'w-full' : '',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

const MobileInput = ({ label, error, className = '', ...props }) => {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-300">{label}</label>}
      <input
        className={cn(
          'block w-full px-3 py-2.5 text-base border border-white/10 rounded-lg bg-white/5 text-gray-100',
          'focus:ring-2 focus:ring-white/20 focus:border-transparent',
          'placeholder-gray-500',
          'min-h-[44px]', // Touch target size
          error ? 'border-red-400 focus:ring-red-500 focus:border-red-400' : '',
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

const MobileModal = ({ isOpen, onClose, title, children, size = 'md', fullScreen = false }) => {
  if (!isOpen) return null

  const getModalSize = () => {
    if (fullScreen || size === 'full') return 'min-h-screen w-full'
    // UPDATED: Made 'large' size even wider for desktop with max-w-[90rem] and improved responsive breakpoints
    if (size === 'large')
      return 'mx-1 mt-1 mb-1 rounded-xl max-w-[90rem] w-[98vw] md:w-[95vw] lg:w-[92vw] xl:w-[90vw] 2xl:w-[85vw] sm:mx-auto min-h-[90vh] max-h-[95vh]'
    if (size === 'xl') return 'mx-1 mt-2 mb-2 rounded-xl max-w-6xl sm:mx-auto'
    return 'mx-4 mt-8 mb-4 rounded-lg max-w-lg sm:mx-auto' // default 'md'
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative bg-[#0B0F14] border border-white/10 overflow-visible',
          getModalSize()
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#0B0F14] sticky top-0 z-10 rounded-t-xl">
          <h3 className="text-xl font-bold text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="p-3 text-gray-400 hover:text-gray-200 hover:bg-white/10 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div
          className={cn(
            'p-6',
            fullScreen || size === 'full' ? 'pb-20' : '' // Extra bottom padding for full screen
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

const MobileTable = ({ data = [], renderCard, renderDesktopRow, headers = [], className = '' }) => {
  return (
    <>
      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {data?.map((item, index) => (
          <div key={index}>
            {renderCard ? (
              renderCard(item, index)
            ) : (
              <MobileCard>
                <p className="text-sm text-gray-600">Item {index + 1}</p>
              </MobileCard>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className={cn('w-full', className)}>
          {headers?.length > 0 && (
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                {headers?.map((header, index) => (
                  <th key={index} className="text-left px-6 py-4 text-sm font-medium text-gray-200">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-white/10">
            {data?.map((item, index) => (
              <tr key={index} className="hover:bg-white/5">
                {renderDesktopRow ? (
                  renderDesktopRow(item, index)
                ) : (
                  <td className="px-6 py-4 text-sm text-gray-200">Row {index + 1}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

const MobileBottomSheet = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-[#0B0F14] border-t border-white/10 rounded-t-lg max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0B0F14] border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-200">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-200 hover:bg-white/10 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-4 pb-8">{children}</div>
      </div>
    </div>
  )
}

const MobileFloatingAction = ({ onClick, icon, className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 w-14 h-14 bg-white hover:bg-white/90 text-[#0B0F14] rounded-full shadow-lg',
        'flex items-center justify-center transition-colors z-40',
        'focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0B0F14]',
        className
      )}
    >
      {icon}
    </button>
  )
}

export {
  MobileCard,
  MobileButton,
  MobileInput,
  MobileModal,
  MobileTable,
  MobileBottomSheet,
  MobileFloatingAction,
}
