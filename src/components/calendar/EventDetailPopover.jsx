import React from 'react'

const EventDetailPopover = ({ id, title, lines = [], align = 'right', className = '' } = {}) => {
  const safeLines = Array.isArray(lines) ? lines.filter(Boolean) : []
  if (!title && safeLines.length === 0) return null

  const alignClass = align === 'left' ? 'left-0' : 'right-0'

  return (
    <div
      id={id}
      role="tooltip"
      className={`pointer-events-none absolute ${alignClass} top-full z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${className}`}
    >
      {title ? <div className="text-xs font-semibold text-slate-900">{title}</div> : null}
      {safeLines.map((line, index) => (
        <div key={`${id || 'popover'}-${index}`} className="text-[11px] text-slate-600">
          {line}
        </div>
      ))}
    </div>
  )
}

export default EventDetailPopover
