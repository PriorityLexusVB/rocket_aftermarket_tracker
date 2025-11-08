import React, { useMemo } from 'react'
import Icon from '../../../components/AppIcon'

export default function LineItemServiceConfig({
  item,
  index,
  vendors = [],
  errors = {},
  updateLineItem,
}) {
  const vendorOptions = useMemo(
    () => vendors?.map((v) => ({ value: v?.id, label: v?.name })),
    [vendors]
  )

  const expanded =
    item?.__ui_schedule_open ??
    Boolean(item?.promised_date || item?.vendor_id || item?.service_type === 'vendor')

  const dateValue = item?.promised_date ? String(item?.promised_date)?.slice(0, 10) : ''

  const toggleExpanded = () => {
    updateLineItem(index, '__ui_schedule_open', !expanded)
  }

  const handleServiceTypeChange = (e) => {
    const val = e?.target?.value // 'in_house' | 'vendor'
    updateLineItem(index, 'service_type', val)
    if (val !== 'vendor' && item?.vendor_id) {
      updateLineItem(index, 'vendor_id', null)
    }
  }

  return (
    <>
      {/* Purple header strip */}
      <div
        className={`rounded-xl border-2 ${
          expanded
            ? 'border-purple-400 bg-purple-50'
            : 'border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50'
        }`}
      >
        <button
          type="button"
          onClick={toggleExpanded}
          className="w-full text-left px-4 py-3 rounded-t-xl flex items-center"
        >
          <span
            className={`mr-3 inline-flex items-center justify-center w-5 h-5 rounded-full border-2 ${
              expanded ? 'border-purple-600' : 'border-purple-400'
            }`}
          >
            {expanded && <span className="w-3 h-3 rounded-full bg-purple-600" />}
          </span>

          <span className="font-semibold text-purple-800 flex items-center">
            <Icon name="Calendar" size={16} className="mr-2 text-purple-600" />
            {dateValue
              ? `Scheduled for ${new Date(dateValue + 'T00:00:00')?.toLocaleDateString()}`
              : 'Need to Schedule'}
          </span>

          <span className="ml-auto">
            <Icon
              name={expanded ? 'ChevronUp' : 'ChevronDown'}
              size={18}
              className="text-purple-600"
            />
          </span>
        </button>

        {expanded && (
          <div className="px-4 pb-4">
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Service Type *
                </label>
                <select
                  value={item?.service_type || 'in_house'}
                  onChange={handleServiceTypeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="in_house">In-House</option>
                  <option value="vendor">Vendor / Off-Site</option>
                </select>
              </div>

              {item?.service_type === 'vendor' && (
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    Vendor *
                  </label>
                  <select
                    value={item?.vendor_id || ''}
                    onChange={(e) => updateLineItem(index, 'vendor_id', e?.target?.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Select vendor…</option>
                    {vendorOptions?.map((v) => (
                      <option key={v?.value} value={v?.value}>
                        {v?.label}
                      </option>
                    ))}
                  </select>
                  {errors?.[`lineItem_${index}_vendor`] && (
                    <p className="text-red-600 text-sm mt-1">
                      {errors?.[`lineItem_${index}_vendor`]}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-base font-semibold text-gray-700 mb-2">
                Promise Date
              </label>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => updateLineItem(index, 'promised_date', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
        )}
      </div>
      {/* Yellow loaner band */}
      <div className="mt-3 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
        <label className="inline-flex items-center space-x-3">
          <input
            type="checkbox"
            checked={!!item?.customer_needs_loaner}
            onChange={(e) => updateLineItem(index, 'customer_needs_loaner', e?.target?.checked)}
            className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-400 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
          />
          <span className="text-base font-semibold text-gray-800">Customer needs loaner</span>
        </label>
      </div>
    </>
  )
}
