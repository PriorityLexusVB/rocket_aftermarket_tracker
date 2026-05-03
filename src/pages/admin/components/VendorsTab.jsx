import React from 'react'
import UIButton from '../../../components/ui/Button'
import Building from 'lucide-react/dist/esm/icons/building.js'
import Edit from 'lucide-react/dist/esm/icons/edit.js'
import Plus from 'lucide-react/dist/esm/icons/plus.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
const VendorsTab = ({
  vendors,
  onlyMyOrg,
  setOnlyMyOrg,
  orgId,
  submitting,
  deletingId,
  vendorsActionMsg,
  assignOrgToVendors,
  openModal,
  handleDelete,
}) => (
  <div>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-semibold">Vendors ({vendors.length})</h3>
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-600 appearance-auto"
            checked={onlyMyOrg}
            onChange={(e) => setOnlyMyOrg(e.target.checked)}
          />
          <span className="text-sm">Only my org</span>
        </label>
        <UIButton
          onClick={assignOrgToVendors}
          disabled={!orgId || submitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-50"
        >
          <Building className="w-4 h-4" />
          Assign Org to Vendors
        </UIButton>
        <UIButton
          onClick={() => openModal('vendor')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Vendor
        </UIButton>
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contact Person
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Phone
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Specialty
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rating
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
          {vendors?.map((vendor) => (
            <tr key={vendor?.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {vendor?.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {vendor?.contact_person || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {vendor?.phone || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {vendor?.specialty || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {vendor?.rating ? `${vendor?.rating}/5` : 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    vendor?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {vendor?.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal('vendor', vendor)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('vendors', vendor?.id)}
                    disabled={deletingId === vendor?.id}
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

    {vendors?.length === 0 && (
      <div className="text-center py-8 text-gray-500">
        No vendors found. Click "Add Vendor" to create one.
      </div>
    )}
    {vendorsActionMsg ? (
      <div className="mt-3 p-3 rounded bg-blue-50 text-blue-700">{vendorsActionMsg}</div>
    ) : null}
  </div>
)

export default VendorsTab
