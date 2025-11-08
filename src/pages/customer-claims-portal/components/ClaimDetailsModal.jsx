import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  DollarSign,
  User,
  Car,
  Package,
  MessageSquare,
  FileImage,
  ExternalLink,
} from 'lucide-react'
import { claimsService } from '../../../services/claimsService'

const ClaimDetailsModal = ({ claim, onClose }) => {
  const [attachments, setAttachments] = useState([])
  const [loadingAttachments, setLoadingAttachments] = useState(true)

  useEffect(() => {
    if (claim?.id) {
      loadAttachments()
    }
  }, [claim?.id])

  const loadAttachments = async () => {
    try {
      setLoadingAttachments(true)
      const attachmentsData = await claimsService?.getClaimAttachments(claim?.id)
      setAttachments(attachmentsData || [])
    } catch (error) {
      console.error('Error loading attachments:', error)
    } finally {
      setLoadingAttachments(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800'
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'denied':
        return 'bg-red-100 text-red-800'
      case 'resolved':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString)?.toLocaleString()
  }

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A'
    return `$${parseFloat(amount)?.toFixed(2)}`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${getPriorityColor(claim?.priority)}`} />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{claim?.claim_number}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(claim?.status)}`}
                >
                  {claim?.status?.replace('_', ' ')?.toUpperCase()}
                </span>
                <span className="text-sm text-gray-500">
                  Priority: {claim?.priority?.charAt(0)?.toUpperCase() + claim?.priority?.slice(1)}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="p-6 space-y-6">
            {/* Customer Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900 mb-1">Customer Information</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <strong>Name:</strong> {claim?.customer_name || 'N/A'}
                      </p>
                      <p>
                        <strong>Email:</strong> {claim?.customer_email || 'N/A'}
                      </p>
                      <p>
                        <strong>Phone:</strong> {claim?.customer_phone || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {claim?.vehicle && (
                  <div className="flex items-start gap-3">
                    <Car className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">Vehicle Information</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <strong>Vehicle:</strong> {claim?.vehicle?.year} {claim?.vehicle?.make}{' '}
                          {claim?.vehicle?.model}
                        </p>
                        <p>
                          <strong>Owner:</strong> {claim?.vehicle?.owner_name}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900 mb-1">Timeline</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <strong>Submitted:</strong> {formatDate(claim?.created_at)}
                      </p>
                      <p>
                        <strong>Last Updated:</strong> {formatDate(claim?.updated_at)}
                      </p>
                      {claim?.resolved_at && (
                        <p>
                          <strong>Resolved:</strong> {formatDate(claim?.resolved_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {claim?.product && (
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">Product Information</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <strong>Product:</strong> {claim?.product?.name}
                        </p>
                        <p>
                          <strong>Brand:</strong> {claim?.product?.brand}
                        </p>
                        <p>
                          <strong>Category:</strong> {claim?.product?.category}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Claim Amount */}
            {claim?.claim_amount && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Claim Amount:</span>
                  <span className="text-lg font-semibold text-green-600">
                    {formatCurrency(claim?.claim_amount)}
                  </span>
                </div>
              </div>
            )}

            {/* Issue Description */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-5 h-5 text-gray-400" />
                <h3 className="font-medium text-gray-900">Issue Description</h3>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {claim?.issue_description || 'No description provided'}
                </p>
              </div>
            </div>

            {/* Preferred Resolution */}
            {claim?.preferred_resolution && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Preferred Resolution</h3>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{claim?.preferred_resolution}</p>
                </div>
              </div>
            )}

            {/* Resolution Notes */}
            {claim?.resolution_notes && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Resolution Notes</h3>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{claim?.resolution_notes}</p>
                </div>
              </div>
            )}

            {/* Attachments */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileImage className="w-5 h-5 text-gray-400" />
                <h3 className="font-medium text-gray-900">Attachments</h3>
                {loadingAttachments && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </div>

              {attachments?.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <FileImage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No attachments uploaded</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attachments?.map((attachment) => (
                    <div
                      key={attachment?.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileImage className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {attachment?.file_name}
                          </span>
                        </div>
                        {attachment?.signedUrl && (
                          <a
                            href={attachment?.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>

                      {attachment?.description && (
                        <p className="text-xs text-gray-500 mb-2">{attachment?.description}</p>
                      )}

                      <div className="text-xs text-gray-400">
                        {attachment?.file_size && (
                          <span>{(attachment?.file_size / 1024 / 1024)?.toFixed(2)} MB</span>
                        )}
                        {attachment?.created_at && (
                          <span className="ml-2">
                            • {new Date(attachment.created_at)?.toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {attachment?.signedUrl && attachment?.file_type?.startsWith('image/') && (
                        <div className="mt-3">
                          <img
                            src={attachment?.signedUrl}
                            alt={attachment?.description || attachment?.file_name}
                            className="w-full h-32 object-cover rounded border"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Need help? Contact support at{' '}
              <a
                href="mailto:claims@priorityautomotive.com"
                className="text-blue-600 hover:text-blue-700"
              >
                claims@priorityautomotive.com
              </a>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClaimDetailsModal
