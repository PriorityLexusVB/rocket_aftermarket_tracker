import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const VehicleLookupPanel = ({ onVehicleSelect, selectedVehicle }) => {
  const [searchType, setSearchType] = useState('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [makeFilter, setMakeFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddVehicleForm, setShowAddVehicleForm] = useState(false);
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
    ownerEmail: ''
  });

  // Mock vehicle data
  const mockVehicles = [
    {
      id: 1,
      vin: '1HGBH41JXMN109186',
      stockNumber: 'ST2024001',
      year: 2024,
      make: 'Honda',
      model: 'Civic',
      trim: 'LX',
      color: 'Silver',
      mileage: 15420,
      status: 'Available',
      ownerName: 'John Smith',
      ownerPhone: '(555) 123-4567'
    },
    {
      id: 2,
      vin: '2T1BURHE0JC123456',
      stockNumber: 'ST2024002',
      year: 2023,
      make: 'Toyota',
      model: 'Corolla',
      trim: 'LE',
      color: 'White',
      mileage: 22100,
      status: 'Available',
      ownerName: 'Sarah Johnson',
      ownerPhone: '(555) 987-6543'
    },
    {
      id: 3,
      vin: '3VW2B7AJ8KM123789',
      stockNumber: 'ST2024003',
      year: 2024,
      make: 'Volkswagen',
      model: 'Jetta',
      trim: 'S',
      color: 'Black',
      mileage: 8900,
      status: 'Available',
      ownerName: 'Michael Brown',
      ownerPhone: '(555) 456-7890'
    },
    {
      id: 4,
      vin: '1FA6P8TH5J5123456',
      stockNumber: 'ST2024004',
      year: 2023,
      make: 'Ford',
      model: 'Mustang',
      trim: 'GT',
      color: 'Red',
      mileage: 12500,
      status: 'Available',
      ownerName: 'Lisa Davis',
      ownerPhone: '(555) 321-9876'
    }
  ];

  const searchTypeOptions = [
    { value: 'stock', label: 'Stock Number' },
    { value: 'make_model', label: 'Make/Model' },
    { value: 'vin', label: 'VIN Number' }
  ];

  const makeOptions = [
    { value: '', label: 'All Makes' },
    { value: 'Honda', label: 'Honda' },
    { value: 'Toyota', label: 'Toyota' },
    { value: 'Ford', label: 'Ford' },
    { value: 'Volkswagen', label: 'Volkswagen' }
  ];

  const yearOptions = [
    { value: '', label: 'All Years' },
    { value: '2024', label: '2024' },
    { value: '2023', label: '2023' },
    { value: '2022', label: '2022' },
    { value: '2021', label: '2021' }
  ];

  const handleSearch = () => {
    setIsSearching(true);
    
    setTimeout(() => {
      let results = mockVehicles;

      if (searchType === 'stock' && searchQuery) {
        results = mockVehicles?.filter(vehicle => 
          vehicle?.stockNumber?.toLowerCase()?.includes(searchQuery?.toLowerCase())
        );
      } else if (searchType === 'vin' && searchQuery) {
        results = mockVehicles?.filter(vehicle => 
          vehicle?.vin?.toLowerCase()?.includes(searchQuery?.toLowerCase())
        );
      } else if (searchType === 'make_model') {
        results = mockVehicles?.filter(vehicle => {
          const makeMatch = !makeFilter || vehicle?.make === makeFilter;
          const modelMatch = !modelFilter || vehicle?.model?.toLowerCase()?.includes(modelFilter?.toLowerCase());
          const yearMatch = !yearFilter || vehicle?.year?.toString() === yearFilter;
          return makeMatch && modelMatch && yearMatch;
        });
      }

      setSearchResults(results);
      setIsSearching(false);
    }, 800);
  };

  const handleVehicleSelect = (vehicle) => {
    onVehicleSelect(vehicle);
  };

  const handleAddNewVehicle = () => {
    if (newVehicleData?.year && newVehicleData?.make && newVehicleData?.model) {
      const newVehicle = {
        id: `new_${Date.now()}`,
        vin: newVehicleData?.vin || `NEW${Date.now()}`,
        stockNumber: newVehicleData?.stockNumber || `STK-${new Date()?.getFullYear()}-${String(Date.now())?.slice(-3)}`,
        year: parseInt(newVehicleData?.year),
        make: newVehicleData?.make,
        model: newVehicleData?.model,
        trim: newVehicleData?.trim || '',
        color: newVehicleData?.color || '',
        mileage: parseInt(newVehicleData?.mileage) || 0,
        status: 'Available',
        ownerName: newVehicleData?.ownerName || '',
        ownerPhone: newVehicleData?.ownerPhone || '',
        ownerEmail: newVehicleData?.ownerEmail || '',
        isNew: true
      };

      onVehicleSelect(newVehicle);
      
      // Reset form
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
        ownerEmail: ''
      });
      setShowAddVehicleForm(false);
    }
  };

  const handleNewVehicleInputChange = (field, value) => {
    setNewVehicleData(prev => ({ ...prev, [field]: value }));
  };

  const clearSearch = () => {
    setSearchQuery('');
    setMakeFilter('');
    setModelFilter('');
    setYearFilter('');
    setSearchResults([]);
  };

  useEffect(() => {
    if (searchType === 'make_model') {
      handleSearch();
    }
  }, [makeFilter, modelFilter, yearFilter]);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
            <Icon name="Search" size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Vehicle Selection</h3>
            <p className="text-sm text-muted-foreground">Search existing vehicles or add new vehicle</p>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAddVehicleForm(false)}
            >
              <Icon name="X" size={16} />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input
              label="Stock Number"
              type="text"
              placeholder="STK-2024-001 (auto-generated if blank)"
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
                placeholder="John Smith"
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
            <Button
              variant="outline"
              onClick={() => setShowAddVehicleForm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleAddNewVehicle}
              iconName="Plus"
              iconPosition="left"
              disabled={!newVehicleData?.year || !newVehicleData?.make || !newVehicleData?.model}
            >
              Add Vehicle
            </Button>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Make"
              options={makeOptions}
              value={makeFilter}
              onChange={setMakeFilter}
            />
            <Input
              label="Model"
              type="text"
              placeholder="Enter model name"
              value={modelFilter}
              onChange={(e) => setModelFilter(e?.target?.value)}
            />
            <Select
              label="Year"
              options={yearOptions}
              value={yearFilter}
              onChange={setYearFilter}
            />
          </div>
        )}
      </div>

      {/* Clear Search */}
      {(searchQuery || makeFilter || modelFilter || yearFilter) && (
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={clearSearch}
            iconName="X"
            iconPosition="left"
            size="sm"
          >
            Clear Search
          </Button>
        </div>
      )}

      {/* Search Results */}
      {searchResults?.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Search Results</h4>
            <span className="text-xs text-muted-foreground">{searchResults?.length} vehicles found</span>
          </div>
          
          <div className="max-h-64 overflow-y-auto space-y-2">
            {searchResults?.map((vehicle) => (
              <div
                key={vehicle?.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-elevation-1 ${
                  selectedVehicle?.id === vehicle?.id
                    ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
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
                        <span className="font-medium">Miles:</span> {vehicle?.mileage?.toLocaleString()}
                      </div>
                    </div>
                    {vehicle?.ownerName && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium">Owner:</span> {vehicle?.ownerName} {vehicle?.ownerPhone}
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
              <p className="font-medium text-foreground">{selectedVehicle?.mileage?.toLocaleString()} mi</p>
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
  );
};

export default VehicleLookupPanel;