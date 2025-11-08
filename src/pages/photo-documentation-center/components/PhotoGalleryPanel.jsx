import React, { useState } from 'react'
import { Image as ImageIcon, Search, Calendar, Eye, Download, User, Clock } from 'lucide-react'
import Icon from '../../../components/AppIcon'

const PhotoGalleryPanel = ({ photos = [], loading, filters = {}, onFiltersChange }) => {
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'

  const handleFilterChange = (key, value) => {
    onFiltersChange?.({
      ...filters,
      [key]: value,
    })
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    const kb = bytes / 1024
    const mb = kb / 1024
    return mb >= 1 ? `${mb?.toFixed(1)} MB` : `${kb?.toFixed(1)} KB`
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

  const getStageColor = (stage) => {
    const colors = {
      before: 'bg-yellow-100 text-yellow-800',
      during: 'bg-blue-100 text-blue-800',
      after: 'bg-green-100 text-green-800',
      quality_check: 'bg-purple-100 text-purple-800',
      progress: 'bg-gray-100 text-gray-800',
    }
    return colors?.[stage] || colors?.progress
  }

  const getCategoryIcon = (category) => {
    const icons = {
      progress: Clock,
      quality: Eye,
      before: Calendar,
      after: Calendar,
      documentation: ImageIcon,
    }
    const Icon = icons?.[category] || ImageIcon
    return <Icon className="h-4 w-4" />
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading photos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Photo Gallery</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewMode === 'grid' ? '☰' : '⊞'}
            </button>
            <span className="text-sm text-gray-500">{photos?.length || 0} photos</span>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search descriptions..."
              value={filters?.searchTerm || ''}
              onChange={(e) => handleFilterChange('searchTerm', e?.target?.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex space-x-2">
            <select
              value={filters?.stage || 'all'}
              onChange={(e) => handleFilterChange('stage', e?.target?.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Stages</option>
              <option value="before">Before</option>
              <option value="during">During</option>
              <option value="after">After</option>
              <option value="quality_check">Quality Check</option>
            </select>

            <select
              value={filters?.category || 'all'}
              onChange={(e) => handleFilterChange('category', e?.target?.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Categories</option>
              <option value="progress">Progress</option>
              <option value="quality">Quality</option>
              <option value="documentation">Documentation</option>
            </select>
          </div>
        </div>
      </div>
      {/* Photo Gallery */}
      <div className="flex-1 overflow-y-auto p-4">
        {photos?.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <ImageIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg mb-2">No Photos Yet</p>
              <p className="text-sm">Upload photos to start documenting this job</p>
            </div>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
            {photos?.map((photo) => (
              <div
                key={photo?.id}
                className={`border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${
                  viewMode === 'list' ? 'flex' : ''
                }`}
                onClick={() => setSelectedPhoto(photo)}
              >
                {/* Photo Thumbnail */}
                <div
                  className={`relative ${viewMode === 'list' ? 'w-24 h-24 flex-shrink-0' : 'aspect-square'}`}
                >
                  {photo?.signedUrl ? (
                    <img
                      src={photo?.signedUrl}
                      alt={photo?.description || photo?.file_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}

                  {/* Fallback when image fails to load */}
                  <div className="hidden absolute inset-0 bg-gray-100 items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>

                  {/* Stage Badge */}
                  <div className="absolute top-2 left-2">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStageColor(photo?.stage)}`}
                    >
                      {photo?.stage?.replace('_', ' ') || 'Progress'}
                    </span>
                  </div>
                </div>

                {/* Photo Info */}
                <div className={`p-3 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-gray-900 text-sm truncate flex-1">
                      {photo?.file_name}
                    </p>
                    <div className="flex items-center text-gray-400 ml-2">
                      {getCategoryIcon(photo?.category)}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                    {photo?.description || 'No description provided'}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>{photo?.user_profiles?.full_name || 'Unknown'}</span>
                    </div>
                    <span>{formatDate(photo?.created_at)}</span>
                  </div>

                  {viewMode === 'list' && (
                    <div className="mt-2 text-xs text-gray-400">
                      {formatFileSize(photo?.file_size)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-full overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedPhoto?.file_name}</h3>
                <p className="text-sm text-gray-600">{selectedPhoto?.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                {selectedPhoto?.signedUrl && (
                  <a
                    href={selectedPhoto?.signedUrl}
                    download={selectedPhoto?.file_name}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Download photo"
                  >
                    <Download className="h-5 w-5" />
                  </a>
                )}
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4">
              {selectedPhoto?.signedUrl && (
                <img
                  src={selectedPhoto?.signedUrl}
                  alt={selectedPhoto?.description || selectedPhoto?.file_name}
                  className="max-w-full max-h-[70vh] object-contain mx-auto"
                />
              )}

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Stage:</span>
                  <span className="ml-2 font-medium">
                    {selectedPhoto?.stage?.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Category:</span>
                  <span className="ml-2 font-medium">{selectedPhoto?.category}</span>
                </div>
                <div>
                  <span className="text-gray-500">Size:</span>
                  <span className="ml-2 font-medium">
                    {formatFileSize(selectedPhoto?.file_size)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Uploaded:</span>
                  <span className="ml-2 font-medium">{formatDate(selectedPhoto?.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PhotoGalleryPanel
