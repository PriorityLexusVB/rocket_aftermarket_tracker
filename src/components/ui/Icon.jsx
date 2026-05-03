import React from 'react'
// Delegates to AppIcon to share the static lucide-import map and avoid
// duplicating the per-icon import set. Adds aria-hidden default for decorative use.
import AppIcon from '../AppIcon'

/**
 * Lightweight Lucide icon wrapper.
 * Usage: <Icon name="Trash2" size={16} className="text-red-600" />
 */
const Icon = ({ name = 'Circle', size = 16, className = '', ...props }) => {
  return <AppIcon name={name} size={size} className={className} aria-hidden {...props} />
}

export default Icon
