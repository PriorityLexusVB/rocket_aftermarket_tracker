import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../../contexts/AuthContext'
import { useLogger } from '../../../hooks/useLogger'
import UIButton from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Search from '../../../components/ui/Search'
import { vendorService } from '../../../services/vendorService'
import { vendorInsertSchema } from '../../../db/schemas'

const VendorManagement = () => {
  const { userProfile } = useAuth()
  const logger = useLogger()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState('add') // 'add' or 'edit'
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSpecialty, setFilterSpecialty] = useState('')

  // React Hook Form with Zod validation (Section 20)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(vendorInsertSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      specialty: '',
      rating: '',
      notes: '',
      isActive: true,
      orgId: userProfile?.org_id || null,
    },
  })



  const specialties = [
    'Engine Components',
    'Braking Systems',
    'Suspension',
    'Electrical',
    'Body & Paint',
    'Exhaust Systems',
    'Transmission',
    'Accessories',
    'Tires & Wheels',
    'Performance Parts',
  ]

  useEffect(() => {
    loadVendors()
  }, [])

  const loadVendors = async () => {
    try {
      setLoading(true)
      const vendorData = await vendorService?.getAllVendors()
      setVendors(vendorData)

      await logger?.logInfo(
        'vendors_loaded',
        'VENDOR',
        'list',
        `Loaded ${vendorData?.length} vendors for management`,
        { vendorCount: vendorData?.length }
      )
    } catch (error) {
      console.error('Error loading vendors:', error)
      await logger?.logError(error, {
        action: 'vendor_load_error',
        context: 'vendor-management',
      })
    } finally {
      setLoading(false)
    }
  }

  // Section 20: react-hook-form handleSubmit wrapper
  const onSubmit = handleSubmit(async (formData) => {
    try {
      if (formMode === 'add') {
        const newVendor = await vendorService?.createVendor(formData)
        setVendors((prev) => [newVendor, ...prev])

        await logger?.logSuccess(
          'vendor_added',
          'VENDOR',
          newVendor?.id,
          `New vendor added: ${newVendor?.name}`,
          { vendorData: newVendor }
        )

        // Show success feedback
        alert('Vendor added successfully!')
      } else {
        const updatedVendor = await vendorService?.updateVendor(selectedVendor?.id, formData)
        setVendors((prev) => prev?.map((v) => (v?.id === updatedVendor?.id ? updatedVendor : v)))

        await logger?.logSuccess(
          'vendor_updated',
          'VENDOR',
          updatedVendor?.id,
          `Vendor updated: ${updatedVendor?.name}`,
          { vendorData: updatedVendor }
        )

        // Show success feedback
        alert('Vendor updated successfully!')
      }

      resetForm()
    } catch (error) {
      console.error('Error saving vendor:', error)
      alert(`Error ${formMode === 'add' ? 'adding' : 'updating'} vendor: ${error?.message}`)

      await logger?.logError(error, {
        action: `vendor_${formMode}_error`,
        entityId: formMode === 'edit' ? selectedVendor?.id : 'new',
        formData,
      })
    }
  })

  const handleEditVendor = (vendor) => {
    console.log('Edit button clicked for vendor:', vendor?.name)

    try {
      setSelectedVendor(vendor)
      // Section 20: Use react-hook-form reset to populate form
      reset({
        name: vendor?.name || '',
        contactPerson: vendor?.contact_person || '',
        email: vendor?.email || '',
        phone: vendor?.phone || '',
        address: vendor?.address || '',
        specialty: vendor?.specialty || '',
        rating: vendor?.rating?.toString() || '',
        notes: vendor?.notes || '',
        isActive: vendor?.is_active !== undefined ? vendor?.is_active : true,
        orgId: vendor?.org_id || userProfile?.org_id || null,
      })
      setFormMode('edit')
      setShowForm(true)
    } catch (error) {
      console.error('Error in handleEditVendor:', error)
      alert('Error opening vendor for editing')
    }
  }

  const handleDeleteVendor = async (vendorId) => {
    console.log('Delete button clicked for vendor ID:', vendorId)

    if (!window.confirm('Are you sure you want to delete this vendor?')) return

    try {
      setLoading(true)
      await vendorService?.deleteVendor(vendorId)
      setVendors((prev) => prev?.filter((v) => v?.id !== vendorId))

      alert('Vendor deleted successfully!')

      await logger?.logSuccess(
        'vendor_deleted',
        'VENDOR',
        vendorId,
        `Vendor deleted successfully`,
        { vendorId }
      )
    } catch (error) {
      console.error('Error deleting vendor:', error)
      alert(`Error deleting vendor: ${error?.message}`)

      await logger?.logError(error, {
        action: 'vendor_delete_error',
        entityId: vendorId,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddNewVendor = () => {
    console.log('Add New Vendor button clicked')

    try {
      setFormMode('add')
      setSelectedVendor(null)
      // Section 20: Use react-hook-form reset for new form
      reset({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        specialty: '',
        rating: '',
        notes: '',
        isActive: true,
        orgId: userProfile?.org_id || null,
      })
      setShowForm(true)
    } catch (error) {
      console.error('Error in handleAddNewVendor:', error)
      alert('Error opening add vendor form')
    }
  }

  const handleBulkToggleActive = async (active) => {
    const selectedVendors = vendors?.filter((v) => v?.selected)
    if (selectedVendors?.length === 0) return

    try {
      const vendorIds = selectedVendors?.map((v) => v?.id)
      await vendorService?.bulkUpdateVendors(vendorIds, { is_active: active })

      setVendors((prev) =>
        prev?.map((v) =>
          vendorIds?.includes(v?.id) ? { ...v, is_active: active, selected: false } : v
        )
      )

      await logger?.logSuccess(
        'vendor_bulk_updated',
        'VENDOR',
        'bulk',
        `Bulk ${active ? 'activated' : 'deactivated'} ${selectedVendors?.length} vendors`,
        { vendorIds, active }
      )
    } catch (error) {
      console.error('Error bulk updating vendors:', error)
      await logger?.logError(error, {
        action: 'vendor_bulk_update_error',
        context: { active, selectedCount: selectedVendors?.length },
      })
    }
  }

  const resetForm = () => {
    // Section 20: Use react-hook-form reset
    reset({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      specialty: '',
      rating: '',
      notes: '',
      isActive: true,
      orgId: userProfile?.org_id || null,
    })
    setSelectedVendor(null)
    setShowForm(false)
    setFormMode('add')
  }

  const toggleVendorSelection = (vendorId) => {
    setVendors((prev) =>
      prev?.map((v) => (v?.id === vendorId ? { ...v, selected: !v?.selected } : v))
    )
  }

  const filteredVendors = vendors?.filter((vendor) => {
    const matchesSearch =
      !searchQuery ||
      vendor?.name?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
      vendor?.specialty?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
      vendor?.contact_person?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
      vendor?.email?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
      vendor?.phone?.toLowerCase()?.includes(searchQuery?.toLowerCase())

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && vendor?.is_active) ||
      (filterStatus === 'inactive' && !vendor?.is_active)

    return matchesSearch && matchesStatus
  })

  const selectedCount = vendors?.filter((v) => v?.selected)?.length || 0

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading vendors...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Vendor List (60%) */}
      <div className="w-3/5 p-6 border-r border-gray-200">
        {/* Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="search"
                placeholder="Search vendors by name, phone, specialty, contact person..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e?.target?.value)}
                className="pl-10 w-full"
              />
            </div>

            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e?.target?.value)}
              className="w-48"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </Select>

            <Select
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e?.target?.value)}
              className="w-48"
            >
              <option value="">All Specialties</option>
              {specialties?.map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
            </Select>
          </div>

          <UIButton
            onClick={handleAddNewVendor}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Add New Vendor'}
          </UIButton>
        </div>

        {/* Bulk Actions */}
        {selectedCount > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedCount} vendor{selectedCount > 1 ? 's' : ''} selected
            </span>
            <div className="space-x-2">
              <UIButton
                onClick={() => handleBulkToggleActive(true)}
                className="text-xs bg-green-600 hover:bg-green-700 text-white"
              >
                Activate
              </UIButton>
              <UIButton
                onClick={() => handleBulkToggleActive(false)}
                className="text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                Deactivate
              </UIButton>
            </div>
          </div>
        )}

        {/* Vendor Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8 px-3 py-3">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        const checked = e?.target?.checked
                        setVendors((prev) => prev?.map((v) => ({ ...v, selected: checked })))
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Specialty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVendors?.map((vendor) => (
                  <tr key={vendor?.id} className="hover:bg-gray-50">
                    <td className="px-3 py-4">
                      <input
                        type="checkbox"
                        checked={vendor?.selected || false}
                        onChange={() => toggleVendorSelection(vendor?.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{vendor?.name}</div>
                        <div className="text-sm text-gray-500">{vendor?.contact_person}</div>
                        {vendor?.rating && (
                          <div className="text-xs text-yellow-600">
                            {'⭐'?.repeat(Math?.floor(vendor?.rating))} ({vendor?.rating})
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{vendor?.email}</div>
                      <div className="text-sm text-gray-500">{vendor?.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {vendor?.specialty || 'General'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          vendor?.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {vendor?.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <UIButton
                        onClick={(e) => {
                          e?.preventDefault()
                          e?.stopPropagation()
                          handleEditVendor(vendor)
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1"
                        disabled={loading}
                        type="button"
                      >
                        Edit
                      </UIButton>
                      <UIButton
                        onClick={(e) => {
                          e?.preventDefault()
                          e?.stopPropagation()
                          handleDeleteVendor(vendor?.id)
                        }}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1"
                        disabled={loading}
                        type="button"
                      >
                        Delete
                      </UIButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredVendors?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No vendors found matching your criteria.
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Vendor Form (40%) */}
      <div className="w-2/5 p-6">
        {showForm ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {formMode === 'add' ? 'Add New Vendor' : 'Edit Vendor'}
              </h3>
              <UIButton
                onClick={resetForm}
                className="text-xs bg-gray-500 hover:bg-gray-600 text-white"
              >
                Cancel
              </UIButton>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name *
                </label>
                <Input {...register('name')} placeholder="Enter vendor name" />
                {errors?.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person
                </label>
                <Input {...register('contactPerson')} placeholder="Enter contact person name" />
                {errors?.contactPerson && (
                  <p className="mt-1 text-sm text-red-600">{errors.contactPerson.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input type="email" {...register('email')} placeholder="Enter email address" />
                {errors?.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input {...register('phone')} placeholder="Enter phone number" />
                {errors?.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  {...register('address')}
                  placeholder="Enter address"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors?.address && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <Select {...register('specialty')}>
                  <option value="">Select specialty</option>
                  {specialties?.map((specialty) => (
                    <option key={specialty} value={specialty}>
                      {specialty}
                    </option>
                  ))}
                </Select>
                {errors?.specialty && (
                  <p className="mt-1 text-sm text-red-600">{errors.specialty.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating (0-5)</label>
                <Input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  {...register('rating')}
                  placeholder="Enter rating (0-5)"
                />
                {errors?.rating && (
                  <p className="mt-1 text-sm text-red-600">{errors.rating.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  {...register('notes')}
                  placeholder="Enter notes"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors?.notes && (
                  <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
                )}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="rounded"
                />
                <label className="ml-2 text-sm text-gray-700">Active Vendor</label>
                {errors?.isActive && (
                  <p className="ml-2 text-sm text-red-600">{errors.isActive.message}</p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <UIButton
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Saving...'
                    : formMode === 'add'
                      ? 'Add Vendor'
                      : 'Update Vendor'}
                </UIButton>
                <UIButton
                  type="button"
                  onClick={(e) => {
                    e?.preventDefault()
                    e?.stopPropagation()
                    resetForm()
                  }}
                  className="px-6 bg-gray-500 hover:bg-gray-600 text-white"
                  disabled={isSubmitting}
                >
                  Cancel
                </UIButton>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-20">
            <div className="text-4xl mb-4">👥</div>
            <p>Select a vendor to edit or click &quot;Add New Vendor&quot; to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default VendorManagement
