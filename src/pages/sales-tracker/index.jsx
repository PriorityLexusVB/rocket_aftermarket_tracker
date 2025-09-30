import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';



import SpreadsheetTable from './components/SpreadsheetTable';
import SummaryCards from './components/SummaryCards';
import NewSaleModal from './components/NewSaleModal';
import salesTrackerService from '../../services/salesTrackerService';
import { useLogger } from '../../hooks/useLogger';
import vendorService from '../../services/vendorService';

const SalesTracker = () => {
  const [salesData, setSalesData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    transactionCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [staffMembers, setStaffMembers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [filters, setFilters] = useState({
    salesperson: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);

  const { logPageView, logSalesAction, logError, logUserInteraction } = useLogger();

  // Enhanced data loading with logging
  const loadSalesData = useCallback(async () => {
    try {
      setLoading(true);
      const startTime = Date.now(); // Add this line - declare startTime variable
      
      await logUserInteraction(
        'sales-data-load',
        'data_fetch_initiated',
        { timestamp: new Date()?.toISOString() }
      );
      
      const data = await salesTrackerService?.getAllSales();
      setSalesData(data);
      
      await logSalesAction(
        'sales_data_loaded',
        'bulk',
        `Loaded ${data?.length || 0} sales records`,
        { recordCount: data?.length, loadTime: Date.now() - startTime }
      );
      
    } catch (error) {
      await logError(error, { 
        action: 'load_sales_data',
        component: 'SalesTracker'
      });
      
      console.error('Error loading sales data:', error);
    } finally {
      setLoading(false);
    }
  }, [logUserInteraction, logSalesAction, logError]);

  // Enhanced new sale creation with logging
  const handleCreateSale = useCallback(async (saleData) => {
    try {
      await logSalesAction(
        'sale_creation_initiated',
        'new',
        `Creating new sale for ${saleData?.year} ${saleData?.make} ${saleData?.model}`,
        { saleData }
      );

      const newSale = await salesTrackerService?.createSale(saleData);
      setSalesData(prev => [newSale, ...prev]);
      setIsModalOpen(false);

      await logSalesAction(
        'sale_created',
        newSale?.id,
        `Successfully created sale for stock #${saleData?.stockNumber}`,
        { 
          newSale,
          vehicleInfo: {
            stockNumber: saleData?.stockNumber,
            year: saleData?.year,
            make: saleData?.make,
            model: saleData?.model,
            color: saleData?.color
          }
        }
      );

    } catch (error) {
      await logError(error, {
        action: 'create_sale',
        saleData: saleData
      });
      
      console.error('Error creating sale:', error);
    }
  }, [logSalesAction, logError]);

  // Enhanced sale update with detailed logging
  const handleUpdateSale = useCallback(async (saleId, updates) => {
    try {
      const existingSale = salesData?.find(s => s?.id === saleId);
      
      await logSalesAction(
        'sale_update_initiated',
        saleId,
        `Updating sale for ${existingSale?.stockNumber || saleId}`,
        { 
          oldData: existingSale,
          updates 
        }
      );

      const updatedSale = await salesTrackerService?.updateSale(saleId, updates);
      
      setSalesData(prev => 
        prev?.map(s => s?.id === saleId ? updatedSale : s)
      );

      await logSalesAction(
        'sale_updated',
        saleId,
        `Successfully updated sale for stock #${existingSale?.stockNumber}`,
        { 
          oldData: existingSale,
          newData: updatedSale,
          changes: updates
        }
      );

    } catch (error) {
      await logError(error, {
        action: 'update_sale',
        saleId,
        updates
      });
      
      console.error('Error updating sale:', error);
    }
  }, [salesData, logSalesAction, logError]);

  // Enhanced sale deletion with logging
  const handleDeleteSale = useCallback(async (saleId) => {
    try {
      const saleToDelete = salesData?.find(s => s?.id === saleId);
      
      await logSalesAction(
        'sale_deletion_initiated',
        saleId,
        `Deleting sale for ${saleToDelete?.stockNumber || saleId}`,
        { saleData: saleToDelete }
      );

      await salesTrackerService?.deleteSale(saleId);
      setSalesData(prev => prev?.filter(s => s?.id !== saleId));

      await logSalesAction(
        'sale_deleted',
        saleId,
        `Successfully deleted sale for stock #${saleToDelete?.stockNumber}`,
        { deletedSale: saleToDelete }
      );

    } catch (error) {
      await logError(error, {
        action: 'delete_sale',
        saleId
      });
      
      console.error('Error deleting sale:', error);
    }
  }, [salesData, logSalesAction, logError]);

  // Enhanced modal handlers with logging
  const handleOpenModal = useCallback(async () => {
    try {
      setIsModalOpen(true);
      await logUserInteraction(
        'new-sale-modal',
        'modal_opened',
        { timestamp: new Date()?.toISOString() }
      );
    } catch (error) {
      await logError(error, { action: 'open_modal' });
    }
  }, [logUserInteraction, logError]);

  const handleCloseModal = useCallback(async () => {
    try {
      setIsModalOpen(false);
      await logUserInteraction(
        'new-sale-modal',
        'modal_closed',
        { timestamp: new Date()?.toISOString() }
      );
    } catch (error) {
      await logError(error, { action: 'close_modal' });
    }
  }, [logUserInteraction, logError]);

  // Log page load on mount
  useEffect(() => {
    const logPageLoad = async () => {
      try {
        await logPageView('sales-tracker', {
          userAgent: navigator?.userAgent,
          timestamp: new Date()?.toISOString(),
          referrer: document?.referrer
        });
      } catch (error) {
        console.error('Failed to log page view:', error);
      }
    };

    logPageLoad();
    loadSalesData();
  }, [logPageView, loadSalesData]);

  // Load staff members and vendors
  useEffect(() => {
    const loadStaffMembers = async () => {
      try {
        const staff = await salesTrackerService?.getStaffMembers() || [];
        setStaffMembers(staff);
      } catch (error) {
        console.error('Error loading staff members:', error);
        setStaffMembers([]);
      }
    };
    
    const loadVendors = async () => {
      try {
        const vendorData = await vendorService?.getAllVendors() || [];
        setVendors(vendorData);
      } catch (error) {
        console.error('Error loading vendors:', error);
        setVendors([]);
      }
    };
    
    loadStaffMembers();
    loadVendors();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced header with logging */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sales Tracker</h1>
              <p className="mt-2 text-gray-600">
                Manage sales transactions and track service options
              </p>
            </div>
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Sale
            </button>
          </div>
        </div>

        {/* Summary Cards with enhanced data */}
        <SummaryCards 
          data={salesData}
          stats={summaryStats}
          onCardClick={async (cardType) => {
            await logUserInteraction(
              `summary-card-${cardType}`,
              'card_clicked',
              { cardType, dataLength: salesData?.length }
            );
          }}
        />

        {/* Enhanced Spreadsheet Table */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <SpreadsheetTable
            data={salesData}
            onEdit={(sale) => {
              setEditingSale(sale);
              setIsModalOpen(true);
            }}
            onDelete={handleDeleteSale}
          />
        )}

        {/* Enhanced Modal */}
        {isModalOpen && (
          <NewSaleModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSubmit={editingSale ? 
              (data) => handleUpdateSale(editingSale?.id, data) : 
              handleCreateSale
            }
            editData={editingSale}
            staffMembers={staffMembers}
            vendors={vendors}
          />
        )}
      </div>
    </div>
  );
};

export default SalesTracker;