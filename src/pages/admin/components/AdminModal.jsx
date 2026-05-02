import React from 'react'
import UIButton from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'

const AdminModal = ({
  showModal,
  modalType,
  editingItem,
  submitting,
  submittingRef,
  setShowModal,
  handleSubmit,
  submitError,
  onClearSubmitError,
  // User account form
  userAccountForm,
  setUserAccountForm,
  roleOptions,
  userDepartmentOptions,
  // Staff form
  staffForm,
  setStaffForm,
  staffDepartmentOptions,
  // Vendor form (react-hook-form)
  vendorFormMethods,
  organizations,
  // Product form
  productForm,
  setProductForm,
  // Template form
  templateForm,
  setTemplateForm,
  templateTypeOptions,
}) => {
  if (!showModal) return null

  const getModalTitle = () => {
    switch (modalType) {
      case 'userAccount':
        return editingItem ? 'Edit User Account' : 'Add User Account'
      case 'staff':
        return editingItem ? 'Edit Staff Member' : 'Add Staff Member'
      case 'vendor':
        return editingItem ? 'Edit Vendor' : 'Add Vendor'
      case 'product':
        return editingItem ? 'Edit Product' : 'Add Product'
      case 'template':
        return editingItem ? 'Edit SMS Template' : 'Add SMS Template'
      default:
        return 'Form'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{getModalTitle()}</h3>
          <button
            onClick={() => { if (!submitting && !submittingRef?.current) { setShowModal(false); onClearSubmitError?.() } }}
            disabled={submitting || submittingRef?.current}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {modalType === 'userAccount' && (
            <>
              <Input
                label="Full Name"
                value={userAccountForm?.full_name}
                onChange={(e) =>
                  setUserAccountForm({ ...userAccountForm, full_name: e?.target?.value })
                }
                required
              />
              <Input
                label="Email"
                type="email"
                value={userAccountForm?.email}
                onChange={(e) =>
                  setUserAccountForm({ ...userAccountForm, email: e?.target?.value })
                }
                required
              />
              {!editingItem && (
                <Input
                  label="Password"
                  type="password"
                  value={userAccountForm?.password}
                  onChange={(e) =>
                    setUserAccountForm({ ...userAccountForm, password: e?.target?.value })
                  }
                  required
                />
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={userAccountForm?.role}
                  onChange={(e) =>
                    setUserAccountForm({ ...userAccountForm, role: e?.target?.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  {roleOptions?.map((option) => (
                    <option key={option?.value} value={option?.value}>
                      {option?.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={userAccountForm?.department}
                  onChange={(e) =>
                    setUserAccountForm({ ...userAccountForm, department: e?.target?.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select Department</option>
                  {userDepartmentOptions?.map((option) => (
                    <option key={option?.value} value={option?.value}>
                      {option?.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Phone"
                value={userAccountForm?.phone}
                onChange={(e) =>
                  setUserAccountForm({ ...userAccountForm, phone: e?.target?.value })
                }
              />
            </>
          )}

          {modalType === 'staff' && (
            <>
              <Input
                label="Full Name"
                value={staffForm?.full_name}
                onChange={(e) => setStaffForm({ ...staffForm, full_name: e?.target?.value })}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={staffForm?.department}
                  onChange={(e) => setStaffForm({ ...staffForm, department: e?.target?.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select Department</option>
                  {staffDepartmentOptions?.map((option) => (
                    <option key={option?.value} value={option?.value}>
                      {option?.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Phone"
                value={staffForm?.phone}
                onChange={(e) => setStaffForm({ ...staffForm, phone: e?.target?.value })}
              />
              <Input
                label="Email"
                type="email"
                value={staffForm?.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e?.target?.value })}
              />
            </>
          )}

          {modalType === 'vendor' && (
            <>
              <Input label="Vendor Name" {...vendorFormMethods.register('name')} required />
              {vendorFormMethods.formState.errors?.name && (
                <p className="mt-1 text-sm text-red-600">
                  {vendorFormMethods.formState.errors.name.message}
                </p>
              )}
              <Input label="Contact Person" {...vendorFormMethods.register('contactPerson')} />
              {vendorFormMethods.formState.errors?.contactPerson && (
                <p className="mt-1 text-sm text-red-600">
                  {vendorFormMethods.formState.errors.contactPerson.message}
                </p>
              )}
              <Input label="Phone" {...vendorFormMethods.register('phone')} />
              {vendorFormMethods.formState.errors?.phone && (
                <p className="mt-1 text-sm text-red-600">
                  {vendorFormMethods.formState.errors.phone.message}
                </p>
              )}
              <Input label="Email" type="email" {...vendorFormMethods.register('email')} />
              {vendorFormMethods.formState.errors?.email && (
                <p className="mt-1 text-sm text-red-600">
                  {vendorFormMethods.formState.errors.email.message}
                </p>
              )}
              <Input label="Specialty" {...vendorFormMethods.register('specialty')} />
              {vendorFormMethods.formState.errors?.specialty && (
                <p className="mt-1 text-sm text-red-600">
                  {vendorFormMethods.formState.errors.specialty.message}
                </p>
              )}
              <Input
                label="Rating (0-5)"
                type="number"
                min="0"
                max="5"
                step="0.1"
                {...vendorFormMethods.register('rating')}
              />
              {vendorFormMethods.formState.errors?.rating && (
                <p className="mt-1 text-sm text-red-600">
                  {vendorFormMethods.formState.errors.rating.message}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <select
                  {...vendorFormMethods.register('orgId')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Unassigned</option>
                  {(organizations || []).map((org) => (
                    <option key={org?.id} value={org?.id}>
                      {org?.name}
                    </option>
                  ))}
                </select>
                {vendorFormMethods.formState.errors?.orgId && (
                  <p className="mt-1 text-sm text-red-600">
                    {vendorFormMethods.formState.errors.orgId.message}
                  </p>
                )}
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...vendorFormMethods.register('isActive')}
                  className="rounded"
                />
                <label className="ml-2 text-sm text-gray-700">Active Vendor</label>
                {vendorFormMethods.formState.errors?.isActive && (
                  <p className="ml-2 text-sm text-red-600">
                    {vendorFormMethods.formState.errors.isActive.message}
                  </p>
                )}
              </div>
            </>
          )}

          {modalType === 'product' && (
            <>
              <Input
                label="Product Name"
                value={productForm?.name}
                onChange={(e) => setProductForm({ ...productForm, name: e?.target?.value })}
                required
              />
              <Input
                label="Brand"
                value={productForm?.brand}
                onChange={(e) => setProductForm({ ...productForm, brand: e?.target?.value })}
              />
              <Input
                label="Category"
                value={productForm?.category}
                onChange={(e) => setProductForm({ ...productForm, category: e?.target?.value })}
              />
              <Input
                label="Op Code"
                value={productForm?.op_code}
                onChange={(e) => setProductForm({ ...productForm, op_code: e?.target?.value })}
                placeholder="e.g., EN3, EN5"
              />
              <Input
                label="Cost"
                type="number"
                step="0.01"
                value={productForm?.cost}
                onChange={(e) => setProductForm({ ...productForm, cost: e?.target?.value })}
                required
              />
              <Input
                label="Unit Price"
                type="number"
                step="0.01"
                value={productForm?.unit_price}
                onChange={(e) => setProductForm({ ...productForm, unit_price: e?.target?.value })}
                required
              />
              <Input
                label="Part Number"
                value={productForm?.part_number}
                onChange={(e) =>
                  setProductForm({ ...productForm, part_number: e?.target?.value })
                }
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={productForm?.description}
                  onChange={(e) =>
                    setProductForm({ ...productForm, description: e?.target?.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <select
                  value={productForm?.dealer_id || productForm?.org_id || ''}
                  onChange={(e) =>
                    setProductForm({ ...productForm, dealer_id: e?.target?.value || null })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Unassigned</option>
                  {(organizations || []).map((org) => (
                    <option key={org?.id} value={org?.id}>
                      {org?.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {modalType === 'template' && (
            <>
              <Input
                label="Template Name"
                value={templateForm?.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e?.target?.value })}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Type
                </label>
                <select
                  value={templateForm?.template_type}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, template_type: e?.target?.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  {templateTypeOptions?.map((option) => (
                    <option key={option?.value} value={option?.value}>
                      {option?.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message Template ({templateForm?.message_template?.length || 0}/160)
                </label>
                <textarea
                  value={templateForm?.message_template}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, message_template: e?.target?.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows="4"
                  maxLength="160"
                  placeholder="Use {{stock_number}}, {{vehicle_info}}, {{status}} as variables"
                  required
                />
              </div>
            </>
          )}

          {submitError && (
            <div className="flex items-start justify-between gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 mb-2">
              <span>{submitError}</span>
              <button
                type="button"
                onClick={onClearSubmitError}
                className="shrink-0 text-red-400 hover:text-red-600"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <UIButton
              type="button"
              onClick={() => { setShowModal(false); onClearSubmitError?.() }}
              disabled={submitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </UIButton>
            <UIButton
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : editingItem
                  ? 'Update'
                  : modalType === 'vendor'
                    ? 'Add Vendor'
                    : modalType === 'staff'
                      ? 'Add Staff Member'
                      : modalType === 'product'
                        ? 'Add Product'
                        : modalType === 'template'
                          ? 'Add Template'
                          : modalType === 'userAccount'
                            ? 'Add User'
                            : 'Create'}
            </UIButton>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminModal
