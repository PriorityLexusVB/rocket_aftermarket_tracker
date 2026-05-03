import React from 'react'
import UIButton from '../../../components/ui/Button'
import Building from 'lucide-react/dist/esm/icons/building.js'
import Edit from 'lucide-react/dist/esm/icons/edit.js'
import Plus from 'lucide-react/dist/esm/icons/plus.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
const StaffRecordsTab = ({
  staffRecords,
  onlyMyOrg,
  setOnlyMyOrg,
  orgId,
  submitting,
  deletingId,
  staffQuery,
  setStaffQuery,
  staffDeptFilter,
  setStaffDeptFilter,
  staffDepartmentOptions,
  staffActionMsg,
  assignOrgToActiveStaff,
  openModal,
  attachProfileToMyOrg,
  handleDelete,
}) => (
  <div>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-semibold">Staff Records ({staffRecords.length})</h3>
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
          onClick={assignOrgToActiveStaff}
          disabled={!orgId || submitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-50"
        >
          <Building className="w-4 h-4" />
          Assign Org to Staff
        </UIButton>
        <UIButton
          onClick={() => openModal('staff')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
        </UIButton>
      </div>
    </div>

    <div className="mb-3 text-sm text-gray-600">
      Tip: You can edit any staff profile. If it belongs to another org, you'll be prompted to
      reassign it to your org on save. Or click the building icon to attach immediately.
    </div>

    {/* Filters */}
    <div className="flex flex-col md:flex-row gap-3 mb-4">
      <input
        type="text"
        value={staffQuery}
        onChange={(e) => setStaffQuery(e.target.value)}
        placeholder="Search by name, phone or email"
        className="px-3 py-2 border border-gray-300 rounded-md w-full md:max-w-sm"
      />
      <select
        value={staffDeptFilter}
        onChange={(e) => setStaffDeptFilter(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md w-full md:max-w-xs"
      >
        <option value="">All departments</option>
        {staffDepartmentOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Department
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Phone
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Org
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
          {(staffRecords || [])
            .filter((s) => {
              const q = staffQuery.trim().toLowerCase()
              if (!q) return true
              return (
                String(s?.full_name || '')
                  .toLowerCase()
                  .includes(q) ||
                String(s?.phone || '')
                  .toLowerCase()
                  .includes(q) ||
                String(s?.email || '')
                  .toLowerCase()
                  .includes(q)
              )
            })
            .filter((s) => {
              if (!staffDeptFilter) return true
              return String(s?.department || '') === staffDeptFilter
            })
            .map((staff) => (
              <tr key={staff?.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {staff?.full_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      staff?.department === 'Sales Consultants'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {staff?.department}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {staff?.phone || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {staff?.email || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <span>
                      {staff?.dealer_id || staff?.org_id
                        ? String(staff?.dealer_id || staff?.org_id).slice(0, 8)
                        : '\u2014'}
                    </span>
                    {orgId &&
                    (staff?.dealer_id || staff?.org_id) &&
                    (staff?.dealer_id || staff?.org_id) !== orgId ? (
                      <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                        Other org
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      staff?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {staff?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal('staff', staff)}
                      className="text-blue-600 hover:text-blue-900"
                      title={
                        orgId &&
                        (staff?.dealer_id || staff?.org_id) &&
                        (staff?.dealer_id || staff?.org_id) !== orgId
                          ? 'Edit staff (will prompt to reassign to your org on save)'
                          : 'Edit staff'
                      }
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {orgId &&
                      (staff?.dealer_id || staff?.org_id) &&
                      (staff?.dealer_id || staff?.org_id) !== orgId && (
                        <button
                          title="Attach to my org"
                          onClick={() => attachProfileToMyOrg(staff?.id)}
                          className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                          disabled={submitting}
                        >
                          <Building className="w-4 h-4" />
                        </button>
                      )}
                    <button
                      onClick={() => handleDelete('user_profiles', staff?.id, 'staff')}
                      disabled={deletingId === staff?.id}
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

    {staffRecords?.length === 0 && (
      <div className="text-center py-8 text-gray-500">
        No staff records found. Click "Add Staff Member" to create one.
      </div>
    )}
    {staffActionMsg ? (
      <div className="mt-3 p-3 rounded bg-blue-50 text-blue-700">{staffActionMsg}</div>
    ) : null}
  </div>
)

export default StaffRecordsTab
