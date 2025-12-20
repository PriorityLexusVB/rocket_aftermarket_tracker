import React, { useState, useRef } from 'react'
import { Upload, X, Camera, AlertCircle } from 'lucide-react'

const PhotoUploadModal = ({ isOpen, onClose, onUpload, jobInfo, vehicleInfo }) => {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    stage: 'during',
    category: 'progress',
    description: '',
  })
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const resetForm = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setFormData({
      stage: 'during',
      category: 'progress',
      description: '',
    })
    setError('')
    setUploading(false)
  }

  const handleClose = () => {
    if (!uploading) {
      resetForm()
      onClose?.()
    }
  }

  const handleDragOver = (e) => {
    e?.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e?.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e?.preventDefault()
    setDragOver(false)

    const files = Array.from(e?.dataTransfer?.files)
    const imageFile = files?.find((file) => file?.type?.startsWith('image/'))

    if (imageFile) {
      handleFileSelect(imageFile)
    } else {
      setError('Please select a valid image file')
    }
  }

  const handleFileInputChange = (e) => {
    const file = e?.target?.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleFileSelect = (file) => {
    // Validate file type
    if (!file?.type?.startsWith('image/')) {
      setError('Please select a valid image file')
      return
    }

    // Validate file size (10MB limit)
    if (file?.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setSelectedFile(file)
    setError('')

    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e?.target?.result)
    }
    reader?.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()

    if (!selectedFile) {
      setError('Please select a photo to upload')
      return
    }

    if (!formData?.description?.trim()) {
      setError('Please provide a description for the photo')
      return
    }

    setUploading(true)
    setError('')

    try {
      const uploadData = {
        file: selectedFile,
        stage: formData?.stage,
        category: formData?.category,
        description: formData?.description?.trim(),
      }

      const result = await onUpload?.(uploadData)

      if (result?.success) {
        resetForm()
        onClose?.()
      } else {
        setError(result?.error || 'Upload failed. Please try again.')
      }
    } catch (err) {
      console.error('Upload failed:', err)
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes) => {
    const kb = bytes / 1024
    const mb = kb / 1024
    return mb >= 1 ? `${mb?.toFixed(1)} MB` : `${kb?.toFixed(1)} KB`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Camera className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Upload Job Photo</h2>
              <p className="text-sm text-gray-600">
                {jobInfo?.title} - {vehicleInfo?.year} {vehicleInfo?.make} {vehicleInfo?.model}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* File Upload Area */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Photo Upload</label>

            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef?.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg text-gray-600 mb-2">Drag and drop your photo here</p>
                <p className="text-sm text-gray-500 mb-4">or click to browse files</p>
                <p className="text-xs text-gray-400">Supports: JPG, PNG, WebP (Max: 10MB)</p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{selectedFile?.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile?.size)} • {selectedFile?.type}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null)
                        setPreviewUrl(null)
                      }}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      Remove file
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Photo Details */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
              <select
                value={formData?.stage}
                onChange={(e) => setFormData({ ...formData, stage: e?.target?.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={uploading}
              >
                <option value="before">Before Work</option>
                <option value="during">During Work</option>
                <option value="after">After Work</option>
                <option value="quality_check">Quality Check</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={formData?.category}
                onChange={(e) => setFormData({ ...formData, category: e?.target?.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={uploading}
              >
                <option value="progress">Progress</option>
                <option value="quality">Quality</option>
                <option value="documentation">Documentation</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
            <textarea
              value={formData?.description}
              onChange={(e) => setFormData({ ...formData, description: e?.target?.value })}
              rows={3}
              placeholder="Describe what this photo shows..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={uploading}
              maxLength={500}
            />
            <div className="flex justify-between mt-1">
              <p className="text-sm text-gray-500">Provide context for this photo</p>
              <span className="text-xs text-gray-400">
                {formData?.description?.length || 0}/500
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PhotoUploadModal
