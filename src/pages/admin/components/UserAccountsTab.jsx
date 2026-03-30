import React from 'react'
import UIButton from '../../../components/ui/Button'
import { Building, Edit, Plus, Trash2 } from 'lucide-react'

const UserAccountsTab = ({
  userAccounts,
  onlyMyOrg,
  setOnlyMyOrg,
  orgId,
  submitting,
  deletingId,
  accountsQuery,
  setAccountsQuery,
  accountsDeptFilter,
  setAccountsDeptFilter,
  userDepartmentOptions,
  accountsActionMsg,
  assignOrgToAccounts,
  openModal,
  attachProfileToMyOrg,
  handleDelete,
}) => (
  <div>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-semibold">User Accounts ({userAccounts.length})</h3>
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
          onClick={assignOrgToAccounts}
          disabled={!orgId || submitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-50"
        >
          <Building className="w-4 h-4" />
          Assign Org to Accounts
        </UIButton>
        <UIButton
          onClick={() => openModal('userAccount')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add User Account
        </UIButton>
      </div>
    </div>

    <div className="mb-3 text-sm text-gray-600">
      Tip: You can edit any account. If it belongs to another org, you'll be prompted to reassign
      it to your org on save. Or click the building icon to attach immediately.
    </div>

    {/* Filters */}
    <div className="flex flex-col md:flex-row gap-3 mb-4">
      <input
        type="text"
        value={accountsQuery}
        onChange={(e) => setAccountsQuery(e.target.value)}
        placeholder="Search by name or email"
        className="px-3 py-2 border border-gray-300 rounded-md w-full md:max-w-sm"
      />
      <select
        value={accountsDeptFilter}
        onChange={(e) => setAccountsDeptFilter(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md w-full md:max-w-xs"
      >
        <option value="">All departments</option>
        {userDepartmentOptions.map((opt) => (
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
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Department
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
          {(userAccounts || [])
            .filter((a) => {
              const q = accountsQuery.trim().toLowerCase()
              if (!q) return true
              return (
                String(a?.full_name || '')
                  .toLowerCase()
                  .includes(q) ||
                String(a?.email || '')
                  .toLowerCase()
                  .includes(q)
              )
            })
            .filter((a) => {
              if (!accountsDeptFilter) return true
              return String(a?.department || '') === accountsDeptFilter
            })
            .map((account) => (
              <tr key={account?.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {account?.full_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {account?.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      account?.role === 'admin'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {account?.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {account?.department}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <span>
                      {account?.dealer_id || account?.org_id
                        ? String(account?.dealer_id || account?.org_id).slice(0, 8)
                        : '\u2014'}
                    </span>
                    {orgId &&
                    (account?.dealer_id || account?.org_id) &&
                    (account?.dealer_id || account?.org_id) !== orgId ? (
                      <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                        Other org
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      account?.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {account?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal('userAccount', account)}
                      className="text-blue-600 hover:text-blue-900"
                      title={
                        orgId &&
                        (account?.dealer_id || account?.org_id) &&
                        (account?.dealer_id || account?.org_id) !== orgId
                          ? 'Edit user (will prompt to reassign to your org on save)'
                          : 'Edit user'
                      }
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {orgId &&
                      (account?.dealer_id || account?.org_id) &&
                      (account?.dealer_id || account?.org_id) !== orgId && (
                        <button
                          title="Attach to my org"
                          onClick={() => attachProfileToMyOrg(account?.id)}
                          className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                          disabled={submitting}
                        >
                          <Building className="w-4 h-4" />
                        </button>
                      )}
                    <button
                      onClick={() => handleDelete('user_profiles', account?.id, 'userAccount')}
                      disabled={deletingId === account?.id}
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

    {userAccounts?.length === 0 && (
      <div className="text-center py-8 text-gray-500">
        No user accounts found. Click "Add User Account" to create one.
      </div>
    )}
    {accountsActionMsg ? (
      <div className="mt-3 p-3 rounded bg-blue-50 text-blue-700">{accountsActionMsg}</div>
    ) : null}
  </div>
)

export default UserAccountsTab
