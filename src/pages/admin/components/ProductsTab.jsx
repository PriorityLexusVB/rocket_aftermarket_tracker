import React from 'react'
import UIButton from '../../../components/ui/Button'
import { Building, Edit, Plus, Trash2 } from 'lucide-react'

const ProductsTab = ({
  products,
  onlyMyOrg,
  setOnlyMyOrg,
  orgId,
  submitting,
  deletingId,
  productsActionMsg,
  assignOrgToProducts,
  openModal,
  handleDelete,
}) => (
  <div>
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-semibold">Aftermarket Products ({products.length})</h3>
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
          onClick={assignOrgToProducts}
          disabled={!orgId || submitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-50"
        >
          <Building className="w-4 h-4" />
          Assign Org to Products
        </UIButton>
        <UIButton
          onClick={() => openModal('product')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Product
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
              Brand
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Op Code
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cost
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Unit Price
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
          {products?.map((product) => (
            <tr key={product?.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {product?.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {product?.brand || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {product?.category || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex px-2 py-1 text-xs font-mono bg-gray-100 text-gray-800 rounded">
                  {product?.op_code || 'N/A'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${product?.cost || '0.00'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${product?.unit_price || '0.00'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    product?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {product?.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal('product', product)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('products', product?.id)}
                    disabled={deletingId === product?.id}
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

    {products?.length === 0 && (
      <div className="text-center py-8 text-gray-500">
        No products found. Click "Add Product" to create one.
      </div>
    )}
    {productsActionMsg ? (
      <div className="mt-3 p-3 rounded bg-blue-50 text-blue-700">{productsActionMsg}</div>
    ) : null}
  </div>
)

export default ProductsTab
