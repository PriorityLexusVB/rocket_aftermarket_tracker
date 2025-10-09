import React, { useState, useEffect } from 'react';
import { X, Save, MessageSquare, User, AlertCircle, CheckCircle, Clock, XCircle, Calendar, Car, Package, FileText, Mail, Phone } from 'lucide-react';
import { claimsService } from '../../../services/claimsService';

const ClaimProcessingModal = ({ claim, staff, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    status: claim?.status || 'submitted',
    priority: claim?.priority || 'medium',
    assigned_to: claim?.assigned_to || '',
    resolution_notes: claim?.resolution_notes || '',
    claim_amount: claim?.claim_amount || ''
  });

  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (claim?.id) {
      loadAttachments();
    }
  }, [claim?.id]);

  const loadAttachments = async () => {
    try {
      setLoadingAttachments(true);
      const attachmentsData = await claimsService?.getClaimAttachments(claim?.id);
      setAttachments(attachmentsData || []);
    } catch (error) {
      console.error('Error loading attachments:', error);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e?.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const updates = {
        ...formData,
        claim_amount: formData?.claim_amount ? parseFloat(formData?.claim_amount) : null
      };

      await onUpdate(claim?.id, updates);
      onClose();
    } catch (err) {
      setError(err?.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'submitted': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'under_review': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'denied': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'resolved': return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'denied': return 'bg-red-100 text-red-800';
      case 'resolved': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString)?.toLocaleString();
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return `$${parseFloat(amount)?.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${getPriorityColor(claim?.priority)}`} />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{claim?.claim_number}</h2>
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon(claim?.status)}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(claim?.status)}`}>
                  {claim?.status?.replace('_', ' ')?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Left Column - Claim Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Name:</span>
                    <p className="text-gray-600">{claim?.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Email:</span>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-600">{claim?.customer_email || 'N/A'}</p>
                      {claim?.customer_email && (
                        <a 
                          href={`mailto:${claim?.customer_email}`}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Mail className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Phone:</span>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-600">{claim?.customer_phone || 'N/A'}</p>
                      {claim?.customer_phone && (
                        <a 
                          href={`tel:${claim?.customer_phone}`}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle and Product Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {claim?.vehicle && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      Vehicle
                    </h3>
                    <div className="text-sm space-y-2">
                      <p><span className="font-medium">Vehicle:</span> {claim?.vehicle?.year} {claim?.vehicle?.make} {claim?.vehicle?.model}</p>
                      <p><span className="font-medium">Owner:</span> {claim?.vehicle?.owner_name}</p>
                    </div>
                  </div>
                )}

                {claim?.product && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Product
                    </h3>
                    <div className="text-sm space-y-2">
                      <p><span className="font-medium">Product:</span> {claim?.product?.name}</p>
                      <p><span className="font-medium">Brand:</span> {claim?.product?.brand}</p>
                      <p><span className="font-medium">Category:</span> {claim?.product?.category}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Issue Description */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Issue Description
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{claim?.issue_description || 'No description provided'}</p>
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

              {/* Attachments */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Attachments
                  {loadingAttachments && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </h3>
                {attachments?.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No attachments uploaded</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {attachments?.map((attachment) => (
                      <div key={attachment?.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {attachment?.file_name}
                          </span>
                          {attachment?.signedUrl && (
                            <a
                              href={attachment?.signedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              View
                            </a>
                          )}
                        </div>
                        {attachment?.description && (
                          <p className="text-xs text-gray-500 mb-2">{attachment?.description}</p>
                        )}
                        {attachment?.signedUrl && attachment?.file_type?.startsWith('image/') && (
                          <img
                            src={attachment?.signedUrl}
                            alt={attachment?.description || attachment?.file_name}
                            className="w-full h-32 object-cover rounded border"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Processing Controls */}
            <div className="space-y-6">
              {/* Timeline */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Timeline
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Submitted:</span>
                    <span className="text-gray-900">{formatDate(claim?.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="text-gray-900">{formatDate(claim?.updated_at)}</span>
                  </div>
                  {claim?.resolved_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Resolved:</span>
                      <span className="text-gray-900">{formatDate(claim?.resolved_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Processing Form */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-4">Processing Actions</h3>
                
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData?.status}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="approved">Approved</option>
                      <option value="denied">Denied</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      name="priority"
                      value={formData?.priority}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign To
                    </label>
                    <select
                      name="assigned_to"
                      value={formData?.assigned_to}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {staff?.map(member => (
                        <option key={member?.id} value={member?.id}>
                          {member?.full_name} ({member?.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Claim Amount
                    </label>
                    <input
                      type="number"
                      name="claim_amount"
                      value={formData?.claim_amount}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resolution Notes
                    </label>
                    <textarea
                      name="resolution_notes"
                      value={formData?.resolution_notes}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Add notes about the resolution..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Last updated: {formatDate(claim?.updated_at)}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimProcessingModal;