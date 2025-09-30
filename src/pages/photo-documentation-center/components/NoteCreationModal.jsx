import React, { useState } from 'react';
import { FileText, X, Save, AlertCircle } from 'lucide-react';

const NoteCreationModal = ({ isOpen, onClose, onSave, jobInfo, vehicleInfo }) => {
  const [formData, setFormData] = useState({
    category: 'Progress Updates',
    message: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setFormData({
      category: 'Progress Updates',
      message: ''
    });
    setError('');
    setSaving(false);
  };

  const handleClose = () => {
    if (!saving) {
      resetForm();
      onClose?.();
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!formData?.message?.trim()) {
      setError('Please enter a note message');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const result = await onSave?.({
        category: formData?.category,
        message: formData?.message?.trim()
      });
      
      if (result?.success) {
        resetForm();
        onClose?.();
      } else {
        setError(result?.error || 'Failed to save note. Please try again.');
      }
    } catch (error) {
      setError('Failed to save note. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const noteCategories = [
    'Progress Updates',
    'Quality Issues', 
    'Customer Communications',
    'Safety Notes',
    'Parts Information',
    'Vendor Communications',
    'General Notes'
  ];

  const getCategoryDescription = (category) => {
    const descriptions = {
      'Progress Updates': 'Document work progress and milestones',
      'Quality Issues': 'Report quality concerns or defects',
      'Customer Communications': 'Record customer interactions and requests',
      'Safety Notes': 'Document safety concerns or procedures',
      'Parts Information': 'Note parts used, issues, or requirements',
      'Vendor Communications': 'Record vendor interactions',
      'General Notes': 'Any other documentation or observations'
    };
    return descriptions?.[category] || '';
  };

  const getWordCount = (text) => {
    return text?.trim()?.split(/\s+/)?.filter(word => word)?.length || 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add Documentation Note</h2>
              <p className="text-sm text-gray-600">
                {jobInfo?.title} - {vehicleInfo?.year} {vehicleInfo?.make} {vehicleInfo?.model}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Category Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note Category
            </label>
            <select
              value={formData?.category}
              onChange={(e) => setFormData({ ...formData, category: e?.target?.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={saving}
            >
              {noteCategories?.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {getCategoryDescription(formData?.category)}
            </p>
          </div>

          {/* Note Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note Content *
            </label>
            <textarea
              value={formData?.message}
              onChange={(e) => setFormData({ ...formData, message: e?.target?.value })}
              rows={8}
              placeholder="Enter your documentation note here. Include relevant details about the work, observations, communications, or any other important information..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              disabled={saving}
              maxLength={2000}
            />
            <div className="flex justify-between mt-2">
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>Words: {getWordCount(formData?.message)}</span>
                <span>Characters: {formData?.message?.length || 0}/2000</span>
              </div>
              <div className="text-sm text-gray-400">
                {formData?.message?.length >= 1800 && 'Approaching character limit'}
              </div>
            </div>
          </div>

          {/* Formatting Tips */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Documentation Tips</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Be specific about timing, parts, and procedures</li>
              <li>• Include relevant measurements, settings, or specifications</li>
              <li>• Note any deviations from standard procedures</li>
              <li>• Record customer requests or special instructions</li>
              <li>• Document any issues found during work</li>
            </ul>
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
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData?.message?.trim() || saving}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Note
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NoteCreationModal;