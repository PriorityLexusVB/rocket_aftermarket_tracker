import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useLogger } from '../../../hooks/useLogger'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'

// Service categories configuration - easily expandable
const SERVICE_CATEGORIES = {
  Protection: {
    icon: '🛡️',
    color: 'blue',
    services: [
      { id: 'ppf', name: 'Paint Protection Film', price: 2500, active: true },
      { id: 'ceramic', name: 'Ceramic Coating', price: 800, active: true },
      { id: 'undercoating', name: 'Undercoating Protection', price: 300, active: true },
      { id: 'rust_protection', name: 'Rust Protection', price: 250, active: true },
    ],
  },
  Aesthetic: {
    icon: '✨',
    color: 'purple',
    services: [
      { id: 'window_tint', name: 'Window Tinting', price: 350, active: true },
      { id: 'paint_correction', name: 'Paint Correction', price: 600, active: true },
      { id: 'chrome_delete', name: 'Chrome Delete', price: 400, active: true },
      { id: 'custom_graphics', name: 'Custom Graphics', price: 800, active: false },
    ],
  },
  Performance: {
    icon: '⚡',
    color: 'red',
    services: [
      { id: 'cold_air_intake', name: 'Cold Air Intake', price: 450, active: true },
      { id: 'exhaust_system', name: 'Performance Exhaust', price: 1200, active: true },
      { id: 'suspension', name: 'Suspension Upgrade', price: 2000, active: true },
      { id: 'tuning', name: 'ECU Tuning', price: 800, active: false },
    ],
  },
  Maintenance: {
    icon: '🔧',
    color: 'green',
    services: [
      { id: 'oil_change', name: 'Premium Oil Change', price: 80, active: true },
      { id: 'brake_service', name: 'Brake Service', price: 300, active: true },
      { id: 'tire_rotation', name: 'Tire Rotation', price: 50, active: true },
      { id: 'detailing', name: 'Interior Detailing', price: 150, active: true },
    ],
  },
}

const ServiceCategories = () => {
  const { userProfile } = useAuth()
  const logger = useLogger()
  const [categories, setCategories] = useState(SERVICE_CATEGORIES)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState('add') // 'add', 'edit', 'add-category'
  const [selectedCategory, setSelectedCategory] = useState('')
  const [expandedCategories, setExpandedCategories] = useState({})
  const [searchTerm, setSearchTerm] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    categoryName: '',
    categoryIcon: '',
    categoryColor: 'blue',
    serviceName: '',
    servicePrice: '',
    serviceActive: true,
    serviceId: '',
  })

  useEffect(() => {
    const initializeCategories = async () => {
      try {
        await logger?.info(
          'service_categories_loaded',
          'SYSTEM',
          'service-config',
          `Service categories loaded for management`,
          {
            categoryCount: Object?.keys(categories)?.length,
            totalServices: Object?.values(categories)?.reduce(
              (sum, cat) => sum + cat?.services?.length,
              0
            ),
          }
        )

        // Expand all categories by default
        const initialExpanded = {}
        Object?.keys(categories)?.forEach((key) => {
          initialExpanded[key] = true
        })
        setExpandedCategories(initialExpanded)
      } catch (error) {
        console.error('Error initializing service categories:', error)
      }
    }

    initializeCategories()
  }, [categories, logger])

  const handleAddService = async (categoryKey) => {
    setSelectedCategory(categoryKey)
    setFormMode('add')
    setFormData({
      categoryName: '',
      categoryIcon: '',
      categoryColor: 'blue',
      serviceName: '',
      servicePrice: '',
      serviceActive: true,
      serviceId: '',
    })
    setShowForm(true)

    await logger?.info(
      'service_add_initiated',
      'SERVICE',
      'new',
      `Adding new service to ${categoryKey} category`,
      { category: categoryKey }
    )
  }

  const handleEditService = async (categoryKey, service) => {
    setSelectedCategory(categoryKey)
    setFormMode('edit')
    setFormData({
      categoryName: '',
      categoryIcon: '',
      categoryColor: 'blue',
      serviceName: service?.name,
      servicePrice: service?.price?.toString(),
      serviceActive: service?.active,
      serviceId: service?.id,
    })
    setShowForm(true)

    await logger?.info(
      'service_edit_initiated',
      'SERVICE',
      service?.id,
      `Editing service: ${service?.name}`,
      { category: categoryKey, service: service }
    )
  }

  const handleAddCategory = () => {
    setFormMode('add-category')
    setFormData({
      categoryName: '',
      categoryIcon: '🔷',
      categoryColor: 'blue',
      serviceName: '',
      servicePrice: '',
      serviceActive: true,
      serviceId: '',
    })
    setShowForm(true)
  }

  const handleFormSubmit = async (e) => {
    e?.preventDefault()

    try {
      if (formMode === 'add-category') {
        // Add new category
        const newCategoryKey = formData?.categoryName?.replace(/\s+/g, '')
        setCategories((prev) => ({
          ...prev,
          [newCategoryKey]: {
            icon: formData?.categoryIcon,
            color: formData?.categoryColor,
            services: [],
          },
        }))

        await logger?.success(
          'category_added',
          'SERVICE_CATEGORY',
          newCategoryKey,
          `New service category added: ${formData?.categoryName}`,
          { categoryData: formData }
        )
      } else if (formMode === 'add') {
        // Add new service to existing category
        const newService = {
          id: `${selectedCategory}_${Date.now()}`,
          name: formData?.serviceName,
          price: parseFloat(formData?.servicePrice),
          active: formData?.serviceActive,
        }

        setCategories((prev) => ({
          ...prev,
          [selectedCategory]: {
            ...prev?.[selectedCategory],
            services: [...prev?.[selectedCategory]?.services, newService],
          },
        }))

        await logger?.success(
          'service_added',
          'SERVICE',
          newService?.id,
          `New service added: ${newService?.name} to ${selectedCategory}`,
          { serviceData: newService, category: selectedCategory }
        )
      } else if (formMode === 'edit') {
        // Edit existing service
        setCategories((prev) => ({
          ...prev,
          [selectedCategory]: {
            ...prev?.[selectedCategory],
            services: prev?.[selectedCategory]?.services?.map((service) =>
              service?.id === formData?.serviceId
                ? {
                    ...service,
                    name: formData?.serviceName,
                    price: parseFloat(formData?.servicePrice),
                    active: formData?.serviceActive,
                  }
                : service
            ),
          },
        }))

        await logger?.success(
          'service_updated',
          'SERVICE',
          formData?.serviceId,
          `Service updated: ${formData?.serviceName}`,
          { serviceData: formData, category: selectedCategory }
        )
      }

      resetForm()
    } catch (error) {
      console.error('Error saving service:', error)
      await logger?.error(
        'service_save_error',
        'SERVICE',
        formMode === 'edit' ? formData?.serviceId : 'new',
        `Failed to ${formMode} service: ${error?.message}`,
        { error: error?.message, formData, mode: formMode }
      )
    }
  }

  const handleDeleteService = async (categoryKey, serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return

    try {
      const service = categories?.[categoryKey]?.services?.find((s) => s?.id === serviceId)

      setCategories((prev) => ({
        ...prev,
        [categoryKey]: {
          ...prev?.[categoryKey],
          services: prev?.[categoryKey]?.services?.filter((s) => s?.id !== serviceId),
        },
      }))

      await logger?.success(
        'service_deleted',
        'SERVICE',
        serviceId,
        `Service deleted: ${service?.name}`,
        { serviceData: service, category: categoryKey }
      )
    } catch (error) {
      console.error('Error deleting service:', error)
      await logger?.error(
        'service_delete_error',
        'SERVICE',
        serviceId,
        `Failed to delete service: ${error?.message}`,
        { error: error?.message, serviceId, category: categoryKey }
      )
    }
  }

  const handleToggleService = async (categoryKey, serviceId) => {
    try {
      setCategories((prev) => ({
        ...prev,
        [categoryKey]: {
          ...prev?.[categoryKey],
          services: prev?.[categoryKey]?.services?.map((service) =>
            service?.id === serviceId ? { ...service, active: !service?.active } : service
          ),
        },
      }))

      const service = categories?.[categoryKey]?.services?.find((s) => s?.id === serviceId)
      await logger?.info(
        'service_toggled',
        'SERVICE',
        serviceId,
        `Service ${!service?.active ? 'activated' : 'deactivated'}: ${service?.name}`,
        { serviceId, category: categoryKey, newStatus: !service?.active }
      )
    } catch (error) {
      console.error('Error toggling service:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      categoryName: '',
      categoryIcon: '',
      categoryColor: 'blue',
      serviceName: '',
      servicePrice: '',
      serviceActive: true,
      serviceId: '',
    })
    setSelectedCategory('')
    setShowForm(false)
    setFormMode('add')
  }

  const toggleCategory = (categoryKey) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev?.[categoryKey],
    }))
  }

  const filteredCategories = Object?.entries(categories)?.reduce((acc, [key, category]) => {
    const filteredServices = category?.services?.filter((service) =>
      service?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase())
    )

    if (searchTerm === '' || filteredServices?.length > 0) {
      acc[key] = {
        ...category,
        services: searchTerm === '' ? category?.services : filteredServices,
      }
    }

    return acc
  }, {})

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
  }

  return (
    <div className="p-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Input
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e?.target?.value)}
            className="w-64"
          />

          <Button
            onClick={() => {
              const allExpanded = Object?.values(expandedCategories)?.every((v) => v)
              const newState = {}
              Object?.keys(categories)?.forEach((key) => {
                newState[key] = !allExpanded
              })
              setExpandedCategories(newState)
            }}
            className="bg-gray-500 hover:bg-gray-600 text-white text-sm"
          >
            {Object?.values(expandedCategories)?.every((v) => v) ? 'Collapse All' : 'Expand All'}
          </Button>
        </div>

        <Button onClick={handleAddCategory} className="bg-blue-600 hover:bg-blue-700 text-white">
          Add New Category
        </Button>
      </div>
      {/* Service Categories */}
      <div className="space-y-6">
        {Object?.entries(filteredCategories)?.map(([categoryKey, category]) => (
          <div
            key={categoryKey}
            className={`border rounded-lg ${colorClasses?.[category?.color] || colorClasses?.blue}`}
          >
            {/* Category Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => toggleCategory(categoryKey)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{category?.icon}</span>
                <div>
                  <h3 className="font-medium text-lg">{categoryKey}</h3>
                  <p className="text-sm opacity-75">
                    {category?.services?.length} service
                    {category?.services?.length !== 1 ? 's' : ''}
                    {' • '}
                    {category?.services?.filter((s) => s?.active)?.length} active
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  onClick={(e) => {
                    e?.stopPropagation()
                    handleAddService(categoryKey)
                  }}
                  className="text-xs bg-white bg-opacity-20 hover:bg-opacity-30 text-current border border-current border-opacity-20"
                >
                  Add Service
                </Button>
                <span
                  className={`transform transition-transform ${
                    expandedCategories?.[categoryKey] ? 'rotate-90' : ''
                  }`}
                >
                  ▶
                </span>
              </div>
            </div>

            {/* Category Services */}
            {expandedCategories?.[categoryKey] && (
              <div className="border-t border-current border-opacity-20 bg-white bg-opacity-20">
                {category?.services?.length === 0 ? (
                  <div className="p-6 text-center text-current opacity-75">
                    No services in this category yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {category?.services?.map((service) => (
                      <div key={service?.id} className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{service?.name}</h4>
                            <p className="text-lg font-bold text-gray-700">${service?.price}</p>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleToggleService(categoryKey, service?.id)}
                              className={`w-8 h-4 rounded-full flex items-center transition-colors ${
                                service?.active ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                            >
                              <div
                                className={`w-3 h-3 bg-white rounded-full transition-transform ${
                                  service?.active ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              service?.active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {service?.active ? 'Active' : 'Inactive'}
                          </span>

                          <div className="flex space-x-1">
                            <Button
                              onClick={() => handleEditService(categoryKey, service)}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1"
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleDeleteService(categoryKey, service?.id)}
                              className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {Object?.keys(filteredCategories)?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">🔧</div>
          <p>No service categories found matching your search.</p>
        </div>
      )}
      {/* Service Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {formMode === 'add-category'
                  ? 'Add New Category'
                  : formMode === 'add'
                    ? 'Add New Service'
                    : 'Edit Service'}
              </h3>
              <Button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                ✕
              </Button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {formMode === 'add-category' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category Name *
                    </label>
                    <Input
                      value={formData?.categoryName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, categoryName: e?.target?.value }))
                      }
                      required
                      placeholder="Enter category name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                    <Input
                      value={formData?.categoryIcon}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, categoryIcon: e?.target?.value }))
                      }
                      placeholder="Enter emoji icon (e.g., 🔧)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Color Theme
                    </label>
                    <Select
                      value={formData?.categoryColor}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, categoryColor: e?.target?.value }))
                      }
                    >
                      <option value="blue">Blue</option>
                      <option value="purple">Purple</option>
                      <option value="red">Red</option>
                      <option value="green">Green</option>
                      <option value="yellow">Yellow</option>
                      <option value="gray">Gray</option>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service Name *
                    </label>
                    <Input
                      value={formData?.serviceName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, serviceName: e?.target?.value }))
                      }
                      required
                      placeholder="Enter service name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData?.servicePrice}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, servicePrice: e?.target?.value }))
                      }
                      required
                      placeholder="Enter price"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData?.serviceActive}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, serviceActive: e?.target?.checked }))
                      }
                      className="rounded"
                    />
                    <label className="ml-2 text-sm text-gray-700">Active Service</label>
                  </div>
                </>
              )}

              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  {formMode === 'add-category'
                    ? 'Add Category'
                    : formMode === 'add'
                      ? 'Add Service'
                      : 'Update Service'}
                </Button>
                <Button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-gray-500 hover:bg-gray-600 text-white"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServiceCategories
