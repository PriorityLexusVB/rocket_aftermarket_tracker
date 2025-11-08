import React, { useState, useRef, useEffect } from 'react'
import Icon from '../AppIcon'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

const InlineEditCell = ({
  value,
  onSave,
  onCancel,
  type = 'text', // 'text', 'select', 'number', 'date'
  options = [], // For select type
  placeholder = '',
  className = '',
  cellClassName = '',
  disabled = false,
  validation = null,
  formatDisplay = null,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isEditing && inputRef?.current) {
      inputRef?.current?.focus()
      if (type === 'text') {
        inputRef?.current?.select()
      }
    }
  }, [isEditing, type])

  const handleStartEdit = () => {
    if (disabled) return
    setEditValue(value || '')
    setError('')
    setIsEditing(true)
  }

  const handleSave = async () => {
    setError('')

    // Validation
    if (validation) {
      const validationError = validation(editValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    // Don't save if value hasn't changed
    if (editValue === value) {
      handleCancel()
      return
    }

    try {
      setIsLoading(true)
      await onSave(editValue)
      setIsEditing(false)
      setError('')
    } catch (err) {
      setError(err?.message || 'Failed to save')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value || '')
    setError('')
    setIsEditing(false)
    if (onCancel) {
      onCancel()
    }
  }

  const handleKeyDown = (e) => {
    if (e?.key === 'Enter') {
      e?.preventDefault()
      handleSave()
    } else if (e?.key === 'Escape') {
      e?.preventDefault()
      handleCancel()
    }
  }

  const renderDisplayValue = () => {
    if (formatDisplay) {
      return formatDisplay(value)
    }

    if (type === 'select') {
      const option = options?.find((opt) => opt?.value === value)
      return option?.label || value || '-'
    }

    if (type === 'date' && value) {
      return new Date(value)?.toLocaleDateString()
    }

    return value || '-'
  }

  const renderEditor = () => {
    const commonProps = {
      ref: inputRef,
      value: editValue,
      onChange: (e) => setEditValue(e?.target?.value),
      onKeyDown: handleKeyDown,
      placeholder,
      disabled: isLoading,
      className: `h-8 text-sm ${error ? 'border-red-500' : ''}`,
    }

    switch (type) {
      case 'select':
        return (
          <Select
            {...commonProps}
            onChange={(value) => setEditValue(value)}
            options={options}
            placeholder={placeholder || 'Select...'}
          />
        )

      case 'number':
        return <Input {...commonProps} type="number" step="0.01" />

      case 'date':
        return <Input {...commonProps} type="date" />

      default:
        return <Input {...commonProps} type="text" />
    }
  }

  if (isEditing) {
    return (
      <div className={`inline-edit-cell editing ${className}`}>
        <div className="flex items-center space-x-1">
          <div className="flex-1">
            {renderEditor()}
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
          </div>

          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              disabled={isLoading}
              className="w-6 h-6 text-green-600 hover:bg-green-50"
              aria-label="Save changes"
            >
              {isLoading ? (
                <div className="w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icon name="Check" size={12} />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              disabled={isLoading}
              className="w-6 h-6 text-red-600 hover:bg-red-50"
              aria-label="Cancel editing"
            >
              <Icon name="X" size={12} />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`inline-edit-cell display ${cellClassName} ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:bg-gray-50 hover:text-primary'
      } group flex items-center justify-between`}
      onClick={handleStartEdit}
    >
      <span className="flex-1 min-w-0">{renderDisplayValue()}</span>

      {!disabled && (
        <Icon
          name="Edit"
          size={12}
          className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2 flex-shrink-0"
        />
      )}
    </div>
  )
}

// Common validation functions
export const validators = {
  required: (value) => {
    if (!value || (typeof value === 'string' && value?.trim() === '')) {
      return 'This field is required'
    }
    return null
  },

  email: (value) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(value)) {
      return 'Invalid email format'
    }
    return null
  },

  minLength: (min) => (value) => {
    if (value && value?.length < min) {
      return `Must be at least ${min} characters`
    }
    return null
  },

  number: (value) => {
    if (value && isNaN(Number(value))) {
      return 'Must be a valid number'
    }
    return null
  },

  positiveNumber: (value) => {
    if (value && (isNaN(Number(value)) || Number(value) < 0)) {
      return 'Must be a positive number'
    }
    return null
  },

  combine:
    (...validatorFns) =>
    (value) => {
      for (const validator of validatorFns) {
        const error = validator(value)
        if (error) return error
      }
      return null
    },
}

// Common display formatters
export const formatters = {
  currency: (value) => {
    if (!value) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    })?.format(value)
  },

  percentage: (value) => {
    if (!value) return '0%'
    return `${Number(value)?.toFixed(1)}%`
  },

  date: (value) => {
    if (!value) return '-'
    return new Date(value)?.toLocaleDateString()
  },

  datetime: (value) => {
    if (!value) return '-'
    return new Date(value)?.toLocaleString()
  },

  truncate:
    (maxLength = 30) =>
    (value) => {
      if (!value) return '-'
      if (value?.length <= maxLength) return value
      return value?.substring(0, maxLength) + '...'
    },
}

export default InlineEditCell
