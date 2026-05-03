import React from 'react'
// Delegate to the canonical AppIcon static map (Wave XVIII-D) so we don't
// duplicate the lucide-react per-icon import set. AppIcon falls back to
// HelpCircle if a name isn't in the map.
import AppIcon from '../AppIcon'

/**
 * Lightweight Lucide icon wrapper.
 * Usage: <Icon name="Trash2" size={16} className="text-red-600" />
 */
const Icon = ({ name = 'Circle', size = 16, className = '', ...props }) => {
  return <AppIcon name={name} size={size} className={className} aria-hidden {...props} />
}

export default Icon
