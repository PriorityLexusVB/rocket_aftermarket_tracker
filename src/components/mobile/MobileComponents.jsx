import React from 'react'
import { cn } from '../../utils/cn'

const MobileCard = ({
  children,
  className = '',
  padding = 'p-4',
  shadow = 'shadow-sm',
  border = 'border border-gray-200',
  rounded = 'rounded-lg',
  background = 'bg-white',
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
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-500',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 focus:ring-blue-500',
    ghost: 'hover:bg-gray-100 text-gray-700 focus:ring-blue-500',
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
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <input
        className={cn(
          'block w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg',
          'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'placeholder-gray-400',
          'min-h-[44px]', // Touch target size
          error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : '',
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
      <div className={cn('relative bg-white overflow-visible', getModalSize())}>
        <div className="flex items-center justify-between p-6 border-b-2 border-gray-200 bg-white sticky top-0 z-10 rounded-t-xl">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
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
            <thead className="bg-gray-50 border-b">
              <tr>
                {headers?.map((header, index) => (
                  <th key={index} className="text-left px-6 py-4 text-sm font-medium text-gray-900">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-gray-200">
            {data?.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {renderDesktopRow ? (
                  renderDesktopRow(item, index)
                ) : (
                  <td className="px-6 py-4 text-sm text-gray-900">Row {index + 1}</td>
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
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-lg max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
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
        'fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg',
        'flex items-center justify-center transition-colors z-40',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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
