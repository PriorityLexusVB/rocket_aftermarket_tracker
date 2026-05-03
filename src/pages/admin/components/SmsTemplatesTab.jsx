import React from 'react'
import UIButton from '../../../components/ui/Button'
import Edit from 'lucide-react/dist/esm/icons/edit.js'
import Plus from 'lucide-react/dist/esm/icons/plus.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
const SmsTemplatesTab = ({
  smsTemplates,
  deletingId,
  openModal,
  handleDelete,
}) => (
  <div>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-semibold">SMS Templates ({smsTemplates?.length || 0})</h3>
      <UIButton
        onClick={() => openModal('template')}
        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Template
      </UIButton>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Message Preview
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {smsTemplates?.map((template) => (
            <tr key={template?.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {template?.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  {template?.template_type?.replace('_', ' ')}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                {template?.message_template}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    template?.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {template?.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal('template', template)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('sms_templates', template?.id)}
                    disabled={deletingId === template?.id}
                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {smsTemplates?.length === 0 && (
      <div className="text-center py-8 text-gray-500">
        No SMS templates found. Click "Add Template" to create one.
      </div>
    )}
  </div>
)

export default SmsTemplatesTab
