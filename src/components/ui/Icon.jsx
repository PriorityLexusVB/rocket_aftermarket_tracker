import React from 'react'
import * as Lucide from 'lucide-react'

/**
 * Lightweight Lucide icon wrapper.
 * Usage: <Icon name="Trash2" size={16} className="text-red-600" />
 */
const Icon = ({ name = 'Circle', size = 16, className = '', ...props }) => {
  const LucideIcon = Lucide?.[name] || Lucide?.Circle
  return <LucideIcon size={size} className={className} aria-hidden {...props} />
}

export default Icon
