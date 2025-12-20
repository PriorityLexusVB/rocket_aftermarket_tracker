import React, { useState } from 'react'
import { FileText, Search, Clock, User, MessageSquare } from 'lucide-react'

const DocumentationNotesPanel = ({ notes = [], loading, filters = {}, onFiltersChange }) => {
  const [expandedNotes, setExpandedNotes] = useState(new Set())

  const handleFilterChange = (key, value) => {
    onFiltersChange?.({
      ...filters,
      [key]: value,
    })
  }

  const toggleNoteExpansion = (noteId) => {
    const newExpanded = new Set(expandedNotes)
    if (newExpanded?.has(noteId)) {
      newExpanded?.delete(noteId)
    } else {
      newExpanded?.add(noteId)
    }
    setExpandedNotes(newExpanded)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString)?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Progress Updates': 'bg-blue-100 text-blue-800 border-blue-200',
      'Quality Issues': 'bg-red-100 text-red-800 border-red-200',
      'Customer Communications': 'bg-green-100 text-green-800 border-green-200',
      photo_documentation: 'bg-purple-100 text-purple-800 border-purple-200',
      note: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    return colors?.[category] || colors?.note
  }

  const getCategoryIcon = (category) => {
    const icons = {
      'Progress Updates': Clock,
      'Quality Issues': MessageSquare,
      'Customer Communications': User,
      photo_documentation: FileText,
      note: FileText,
    }
    const Icon = icons?.[category] || FileText
    return <Icon className="h-4 w-4" />
  }

  const truncateText = (text, maxLength = 150) => {
    if (!text) return ''
    return text?.length > maxLength ? `${text?.substring(0, maxLength)}...` : text
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading notes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Documentation Notes</h3>
          <span className="text-sm text-gray-500">{notes?.length || 0} notes</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search notes..."
            value={filters?.searchTerm || ''}
            onChange={(e) => handleFilterChange('searchTerm', e?.target?.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>
      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4">
        {notes?.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg mb-2">No Notes Yet</p>
              <p className="text-sm">Add notes to document job progress and communications</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {notes?.map((note) => {
              const isExpanded = expandedNotes?.has(note?.id)
              const needsExpansion = note?.message?.length > 150
              const category = note?.subject || note?.communication_type || 'note'

              return (
                <div
                  key={note?.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  {/* Note Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex-shrink-0">{getCategoryIcon(category)}</div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded border ${getCategoryColor(category)}`}
                      >
                        {category === 'photo_documentation' ? 'Photo Documentation' : category}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDate(note?.sent_at)}
                    </div>
                  </div>
                  {/* Note Content */}
                  <div className="mb-3">
                    <p className="text-gray-900 leading-relaxed">
                      {isExpanded ? note?.message : truncateText(note?.message)}
                      {needsExpansion && (
                        <button
                          onClick={() => toggleNoteExpansion(note?.id)}
                          className="ml-2 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                        >
                          {isExpanded ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </p>
                  </div>
                  {/* Note Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <User className="h-4 w-4" />
                      <span>{note?.user_profiles?.full_name || 'Unknown User'}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {note?.communication_type && (
                        <span className="text-xs text-gray-400 capitalize">
                          {note?.communication_type?.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {/* Category Legend */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Categories</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span className="text-gray-600">Progress Updates</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
            <span className="text-gray-600">Quality Issues</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span className="text-gray-600">Communications</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
            <span className="text-gray-600">Photo Documentation</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentationNotesPanel
