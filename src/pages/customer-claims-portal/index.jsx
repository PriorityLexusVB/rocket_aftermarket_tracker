import React, { useState, useEffect } from 'react';
import { Upload, AlertCircle, CheckCircle, Clock, XCircle, Plus, Search, Filter, Phone, Mail, Calendar, DollarSign } from 'lucide-react';
import { claimsService } from '../../services/claimsService';
import ClaimSubmissionForm from './components/ClaimSubmissionForm';

import ClaimDetailsModal from './components/ClaimDetailsModal';

const CustomerClaimsPortal = () => {
  const [claims, setClaims] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewClaimForm, setShowNewClaimForm] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [customerEmail, setCustomerEmail] = useState('john.smith@email.com'); // Demo customer
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadCustomerData();
  }, [customerEmail]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [claimsData, vehiclesData, productsData] = await Promise.all([
        claimsService?.getCustomerClaims(customerEmail),
        claimsService?.getCustomerVehicles(customerEmail),
        claimsService?.getProducts()
      ]);

      setClaims(claimsData || []);
      setVehicles(vehiclesData || []);
      setProducts(productsData || []);
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async (claimData) => {
    try {
      const newClaim = await claimsService?.createClaim({
        ...claimData,
        customer_email: customerEmail
      });

      setClaims(prev => [newClaim, ...prev]);
      setShowNewClaimForm(false);
      
      // Show success message
      alert('Claim submitted successfully! You will receive email updates on the progress.');
    } catch (err) {
      setError(`Failed to submit claim: ${err?.message}`);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'submitted': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'under_review': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'denied': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'resolved': return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'denied': return 'bg-red-100 text-red-800';
      case 'resolved': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const filteredClaims = claims?.filter(claim => {
    const matchesSearch = searchTerm === '' || 
      claim?.claim_number?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      claim?.issue_description?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      claim?.product?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || claim?.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your claims...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customer Claims Portal</h1>
              <p className="text-gray-600 mt-2">File and track warranty claims for your aftermarket products</p>
            </div>
            <button
              onClick={() => setShowNewClaimForm(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Claim
            </button>
          </div>
        </div>
      </div>
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Claims History Panel (Left) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Your Claims</h2>
                <span className="text-sm text-gray-500">{filteredClaims?.length || 0} claims</span>
              </div>
              
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search claims..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e?.target?.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e?.target?.value)}
                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                  >
                    <option value="all">All Status</option>
                    <option value="submitted">Submitted</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="denied">Denied</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6">
              {filteredClaims?.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-4">No claims found</p>
                  <button
                    onClick={() => setShowNewClaimForm(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Submit your first claim
                  </button>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredClaims?.map(claim => (
                    <div
                      key={claim?.id}
                      onClick={() => setSelectedClaim(claim)}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getPriorityColor(claim?.priority)}`} />
                          <span className="font-medium text-gray-900">{claim?.claim_number}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(claim?.status)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(claim?.status)}`}>
                            {claim?.status?.replace('_', ' ')?.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900">
                            {claim?.product?.name || 'Unknown Product'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {claim?.product?.brand}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {claim?.issue_description}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(claim?.created_at)?.toLocaleDateString()}
                          </div>
                          {claim?.claim_amount && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              ${parseFloat(claim?.claim_amount)?.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions or Claim Form (Right) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {showNewClaimForm ? (
              <ClaimSubmissionForm
                vehicles={vehicles}
                products={products}
                onSubmit={handleSubmitClaim}
                onCancel={() => setShowNewClaimForm(false)}
              />
            ) : (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
                
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Need Help?</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Contact our support team for assistance with your claims
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a
                        href="tel:555-0123"
                        className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        Call Support
                      </a>
                      <a
                        href="mailto:claims@priorityautomotive.com"
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        Email Us
                      </a>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Claims Status Guide</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-blue-500" />
                        <span className="text-gray-600">Submitted - Initial review in progress</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-3 h-3 text-yellow-500" />
                        <span className="text-gray-600">Under Review - Detailed evaluation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-gray-600">Approved - Claim accepted</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-3 h-3 text-red-500" />
                        <span className="text-gray-600">Denied - Claim not covered</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-600">Resolved - Claim completed</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowNewClaimForm(true)}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Submit New Claim
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Claim Details Modal */}
      {selectedClaim && (
        <ClaimDetailsModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
        />
      )}
    </div>
  );
};

export default CustomerClaimsPortal;