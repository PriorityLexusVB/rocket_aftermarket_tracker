import React, { useState, useEffect, useCallback } from 'react'
import Icon from '../../../components/AppIcon'
import Input from '../../../components/ui/Input'
import Button from '../../../components/ui/Button'
import Select from '../../../components/ui/Select'
import { vehicleService } from '../../../services/vehicleService'

const VehicleLookupPanel = ({ onVehicleSelect, selectedVehicle }) => {
  const [searchType, setSearchType] = useState('stock')
  const [searchQuery, setSearchQuery] = useState('')
  const [makeFilter, setMakeFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [showAddVehicleForm, setShowAddVehicleForm] = useState(false)
  const [isCreatingVehicle, setIsCreatingVehicle] = useState(false)
  const [newVehicleData, setNewVehicleData] = useState({
    stockNumber: '',
    vin: '',
    year: '',
    make: '',
    model: '',
    trim: '',
    color: '',
    mileage: '',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
  })

  const searchTypeOptions = [
    { value: 'stock', label: 'Stock Number' },
    { value: 'make_model', label: 'Make/Model' },
    { value: 'vin', label: 'VIN Number' },
  ]

  const normalizeVehicle = useCallback((v) => {
    if (!v) return null
    return {
      ...v,
      stockNumber: v?.stockNumber ?? v?.stock_number ?? '',
      ownerName: v?.ownerName ?? v?.owner_name ?? '',
      ownerPhone: v?.ownerPhone ?? v?.owner_phone ?? '',
      ownerEmail: v?.ownerEmail ?? v?.owner_email ?? '',
      status: v?.status ?? v?.vehicle_status ?? '—',
    }
  }, [])

  const handleSearch = useCallback(async () => {
    setIsSearching(true)
    setSearchError('')

    try {
      if (searchType === 'stock') {
        const q = (searchQuery || '')?.trim()
        if (!q) {
          setSearchResults([])
          return
        }

        const { data, error } = await vehicleService.searchVehiclesStockFirst(q, {
          limit: 25,
          status: 'active',
        })
        if (error) throw new Error(error?.message || 'Failed to search vehicles')
        setSearchResults((data || []).map(normalizeVehicle).filter(Boolean))
        return
      }

      if (searchType === 'vin') {
        const q = (searchQuery || '')?.trim()
        if (!q) {
          setSearchResults([])
          return
        }

        const { data, error } = await vehicleService.searchVehiclesStockFirst(q, {
          limit: 25,
          status: 'active',
        })
        if (error) throw new Error(error?.message || 'Failed to search vehicles')
        setSearchResults((data || []).map(normalizeVehicle).filter(Boolean))
        return
      }

      // make/model/year search
      const make = (makeFilter || '')?.trim()
      const model = (modelFilter || '')?.trim()
      const year = (yearFilter || '')?.trim()

      const yearNum = year ? Number.parseInt(year, 10) : undefined
      const { data, error } = await vehicleService.getVehicles({
        status: 'active',
        make: make || undefined,
        year: Number.isFinite(yearNum) ? yearNum : undefined,
        search: model || undefined,
      })

      if (error) throw new Error(error?.message || 'Failed to search vehicles')
      setSearchResults((data || []).map(normalizeVehicle).filter(Boolean))
    } catch (err) {
      setSearchResults([])
      setSearchError(err?.message || 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }, [makeFilter, modelFilter, normalizeVehicle, searchQuery, searchType, yearFilter])

  const handleVehicleSelect = (vehicle) => {
    onVehicleSelect(vehicle)
  }

  const handleAddNewVehicle = async () => {
    if (!newVehicleData?.year || !newVehicleData?.make || !newVehicleData?.model) return

    setIsCreatingVehicle(true)
    setSearchError('')
    try {
      const yearNum = Number.parseInt(newVehicleData?.year, 10)
      if (!Number.isFinite(yearNum)) throw new Error('Year must be a number')

      const { data: createdVehicle, error } = await vehicleService.createVehicle({
        stock_number: newVehicleData?.stockNumber?.trim() || null,
        vin: newVehicleData?.vin?.trim() || null,
        year: yearNum,
        make: newVehicleData?.make?.trim(),
        model: newVehicleData?.model?.trim(),
        trim: newVehicleData?.trim?.trim() || null,
        color: newVehicleData?.color?.trim() || null,
        mileage: newVehicleData?.mileage ? Number.parseInt(newVehicleData?.mileage, 10) : null,
        owner_name: newVehicleData?.ownerName?.trim() || null,
        owner_phone: newVehicleData?.ownerPhone?.trim() || null,
        owner_email: newVehicleData?.ownerEmail?.trim() || null,
        vehicle_status: 'active',
      })

      if (error) throw new Error(error?.message || 'Failed to create vehicle')
      if (!createdVehicle?.id) throw new Error('Vehicle created but missing id')

      onVehicleSelect({ ...normalizeVehicle(createdVehicle), isNew: true })

      setNewVehicleData({
        stockNumber: '',
        vin: '',
        year: '',
        make: '',
        model: '',
        trim: '',
        color: '',
        mileage: '',
        ownerName: '',
        ownerPhone: '',
        ownerEmail: '',
      })
      setShowAddVehicleForm(false)
    } catch (err) {
      setSearchError(err?.message || 'Failed to create vehicle')
    } finally {
      setIsCreatingVehicle(false)
    }
  }

  const handleNewVehicleInputChange = (field, value) => {
    setNewVehicleData((prev) => ({ ...prev, [field]: value }))
  }

  const clearSearch = () => {
    setSearchQuery('')
    setMakeFilter('')
    setModelFilter('')
    setYearFilter('')
    setSearchResults([])
    setSearchError('')
  }

  useEffect(() => {
    setSearchResults([])
    setSearchError('')
  }, [searchType])

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
            <Icon name="Search" size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Vehicle Selection</h3>
            <p className="text-sm text-muted-foreground">
              Search existing vehicles or add new vehicle
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {selectedVehicle && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-success/10 border border-success/20 rounded-lg">
              <Icon name="CheckCircle" size={16} className="text-success" />
              <span className="text-sm font-medium text-success">Vehicle Selected</span>
            </div>
          )}
          <Button
            variant="default"
            onClick={() => setShowAddVehicleForm(!showAddVehicleForm)}
            iconName="Plus"
            iconPosition="left"
          >
            Add New Vehicle
          </Button>
        </div>
      </div>

      {/* Add New Vehicle Form */}
      {showAddVehicleForm && (
        <div className="mb-6 p-6 bg-accent/5 border border-accent/20 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-foreground">Add New Vehicle</h4>
            <Button variant="ghost" size="icon" onClick={() => setShowAddVehicleForm(false)}>
              <Icon name="X" size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input
              label="Stock Number"
              type="text"
              placeholder="Optional"
              value={newVehicleData?.stockNumber}
              onChange={(e) => handleNewVehicleInputChange('stockNumber', e?.target?.value)}
            />
            <Input
              label="VIN Number"
              type="text"
              placeholder="17-character VIN"
              maxLength={17}
              value={newVehicleData?.vin}
              onChange={(e) => handleNewVehicleInputChange('vin', e?.target?.value?.toUpperCase())}
            />
            <Input
              label="Year *"
              type="number"
              min="1980"
              max="2025"
              required
              placeholder="2024"
              value={newVehicleData?.year}
              onChange={(e) => handleNewVehicleInputChange('year', e?.target?.value)}
            />
            <Input
              label="Make *"
              type="text"
              required
              placeholder="Honda, Toyota, Ford, etc."
              value={newVehicleData?.make}
              onChange={(e) => handleNewVehicleInputChange('make', e?.target?.value)}
            />
            <Input
              label="Model *"
              type="text"
              required
              placeholder="Civic, Camry, F-150, etc."
              value={newVehicleData?.model}
              onChange={(e) => handleNewVehicleInputChange('model', e?.target?.value)}
            />
            <Input
              label="Trim"
              type="text"
              placeholder="LX, LE, Sport, etc."
              value={newVehicleData?.trim}
              onChange={(e) => handleNewVehicleInputChange('trim', e?.target?.value)}
            />
            <Input
              label="Color"
              type="text"
              placeholder="Red, Blue, White, etc."
              value={newVehicleData?.color}
              onChange={(e) => handleNewVehicleInputChange('color', e?.target?.value)}
            />
            <Input
              label="Mileage"
              type="number"
              min="0"
              placeholder="50000"
              value={newVehicleData?.mileage}
              onChange={(e) => handleNewVehicleInputChange('mileage', e?.target?.value)}
            />
          </div>

          <div className="mb-4">
            <h5 className="text-sm font-medium text-foreground mb-3">Vehicle Owner Information</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Owner Name"
                type="text"
                placeholder="Owner name"
                value={newVehicleData?.ownerName}
                onChange={(e) => handleNewVehicleInputChange('ownerName', e?.target?.value)}
              />
              <Input
                label="Owner Phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={newVehicleData?.ownerPhone}
                onChange={(e) => handleNewVehicleInputChange('ownerPhone', e?.target?.value)}
              />
              <Input
                label="Owner Email"
                type="email"
                placeholder="owner@email.com"
                value={newVehicleData?.ownerEmail}
                onChange={(e) => handleNewVehicleInputChange('ownerEmail', e?.target?.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <Button variant="outline" onClick={() => setShowAddVehicleForm(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleAddNewVehicle}
              iconName="Plus"
              iconPosition="left"
              loading={isCreatingVehicle}
              disabled={
                isCreatingVehicle ||
                !newVehicleData?.year ||
                !newVehicleData?.make ||
                !newVehicleData?.model
              }
            >
              Add Vehicle
            </Button>
          </div>
        </div>
      )}

      {searchError && (
        <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error">
          {searchError}
        </div>
      )}

      {/* Search Type Selection */}
      <div className="mb-4">
        <Select
          label="Search Method"
          options={searchTypeOptions}
          value={searchType}
          onChange={setSearchType}
          className="mb-4"
        />
      </div>

      {/* Search Fields */}
      <div className="space-y-4 mb-6">
        {searchType === 'stock' && (
          <div className="flex space-x-3">
            <Input
              label="Stock Number"
              type="text"
              placeholder="Enter stock number (e.g., ST2024001)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e?.target?.value?.toUpperCase())}
              className="flex-1"
            />
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleSearch}
                loading={isSearching}
                iconName="Search"
                className="h-10"
              >
                Search
              </Button>
            </div>
          </div>
        )}

        {searchType === 'vin' && (
          <div className="flex space-x-3">
            <Input
              label="VIN Number"
              type="text"
              placeholder="Enter 17-character VIN"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e?.target?.value?.toUpperCase())}
              maxLength={17}
              className="flex-1"
            />
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleSearch}
                loading={isSearching}
                iconName="Search"
                className="h-10"
              >
                Search
              </Button>
            </div>
          </div>
        )}

        {searchType === 'make_model' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <Input
              label="Make"
              type="text"
              placeholder="e.g., Honda"
              value={makeFilter}
              onChange={(e) => setMakeFilter(e?.target?.value)}
            />
            <Input
              label="Model"
              type="text"
              placeholder="e.g., Civic"
              value={modelFilter}
              onChange={(e) => setModelFilter(e?.target?.value)}
            />
            <Input
              label="Year"
              type="number"
              min="1980"
              max="2025"
              placeholder="e.g., 2024"
              value={yearFilter}
              onChange={(e) => setYearFilter(e?.target?.value)}
            />
            <Button
              variant="outline"
              onClick={handleSearch}
              loading={isSearching}
              iconName="Search"
              className="h-10"
            >
              Search
            </Button>
          </div>
        )}
      </div>

      {/* Clear Search */}
      {(searchQuery || makeFilter || modelFilter || yearFilter) && (
        <div className="mb-4">
          <Button variant="ghost" onClick={clearSearch} iconName="X" iconPosition="left" size="sm">
            Clear Search
          </Button>
        </div>
      )}

      {/* Search Results */}
      {searchResults?.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Search Results</h4>
            <span className="text-xs text-muted-foreground">
              {searchResults?.length} vehicles found
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {searchResults?.map((vehicle) => (
              <div
                key={vehicle?.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-elevation-1 ${
                  selectedVehicle?.id === vehicle?.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => handleVehicleSelect(vehicle)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className="font-medium text-foreground">
                        {vehicle?.year} {vehicle?.make} {vehicle?.model} {vehicle?.trim}
                      </h5>
                      <span className="px-2 py-1 text-xs font-medium bg-success/10 text-success rounded-full">
                        {vehicle?.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">VIN:</span> {vehicle?.vin?.slice(-6)}
                      </div>
                      <div>
                        <span className="font-medium">Stock:</span> {vehicle?.stockNumber}
                      </div>
                      <div>
                        <span className="font-medium">Color:</span> {vehicle?.color}
                      </div>
                      <div>
                        <span className="font-medium">Miles:</span>{' '}
                        {vehicle?.mileage?.toLocaleString()}
                      </div>
                    </div>
                    {vehicle?.ownerName && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium">Owner:</span> {vehicle?.ownerName}{' '}
                        {vehicle?.ownerPhone}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    {selectedVehicle?.id === vehicle?.id ? (
                      <Icon name="CheckCircle" size={20} className="text-primary" />
                    ) : (
                      <Icon name="ChevronRight" size={20} className="text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Vehicle Summary */}
      {selectedVehicle && (
        <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <Icon name="Car" size={20} className="text-primary" />
            <h4 className="font-medium text-foreground">Selected Vehicle</h4>
            {selectedVehicle?.isNew && (
              <span className="px-2 py-1 text-xs bg-accent text-accent-foreground rounded-full">
                New Vehicle
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Vehicle:</span>
              <p className="font-medium text-foreground">
                {selectedVehicle?.year} {selectedVehicle?.make} {selectedVehicle?.model}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">VIN:</span>
              <p className="font-medium text-foreground font-mono">{selectedVehicle?.vin}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Stock:</span>
              <p className="font-medium text-foreground">{selectedVehicle?.stockNumber}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Mileage:</span>
              <p className="font-medium text-foreground">
                {selectedVehicle?.mileage?.toLocaleString()} mi
              </p>
            </div>
          </div>
          {selectedVehicle?.ownerName && (
            <div className="mt-3 pt-3 border-t border-border">
              <span className="text-muted-foreground">Owner:</span>
              <p className="font-medium text-foreground">
                {selectedVehicle?.ownerName} - {selectedVehicle?.ownerPhone}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VehicleLookupPanel
