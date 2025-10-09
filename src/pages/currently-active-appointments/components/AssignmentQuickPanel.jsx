import React, { useState } from 'react';
import { X, Users, Clock, Car, UserPlus, CheckCircle } from 'lucide-react';

const AssignmentQuickPanel = ({ unassignedJobs, staffMembers, selectedAppointments, onQuickAssign, onBulkAssign, onClose }) => {
  const [selectedStaff, setSelectedStaff] = useState('');
  const [assignmentMode, setAssignmentMode] = useState(selectedAppointments?.size > 0 ? 'bulk' : 'individual');

  const handleBulkAssign = () => {
    if (!selectedStaff || selectedAppointments?.size === 0) return;
    onBulkAssign(selectedStaff);
    setSelectedStaff('');
  };

  const handleQuickAssign = (jobId) => {
    if (!selectedStaff) return;
    onQuickAssign(jobId, selectedStaff);
  };

  const formatJobTime = (timestamp) => {
    if (!timestamp) return 'Not scheduled';
    return new Date(timestamp)?.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Assignment Center</h3>
                <p className="text-sm text-gray-600">
                  {selectedAppointments?.size > 0 
                    ? `Manage ${selectedAppointments?.size} selected appointment${selectedAppointments?.size !== 1 ? 's' : ''} and ${unassignedJobs?.length} unassigned job${unassignedJobs?.length !== 1 ? 's' : ''}`
                    : `Assign ${unassignedJobs?.length} unassigned job${unassignedJobs?.length !== 1 ? 's' : ''}`
                  }
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all duration-200"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Mode Toggle */}
          {selectedAppointments?.size > 0 && (
            <div className="flex items-center space-x-4 mb-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-200">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="bulk"
                  name="assignmentMode"
                  value="bulk"
                  checked={assignmentMode === 'bulk'}
                  onChange={(e) => setAssignmentMode(e?.target?.value)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="bulk" className="text-sm font-medium text-gray-900">
                  Bulk assign {selectedAppointments?.size} selected appointment{selectedAppointments?.size !== 1 ? 's' : ''}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="individual"
                  name="assignmentMode"
                  value="individual"
                  checked={assignmentMode === 'individual'}
                  onChange={(e) => setAssignmentMode(e?.target?.value)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="individual" className="text-sm font-medium text-gray-900">
                  Individual assignments
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Staff Selection */}
            <div className="lg:col-span-1">
              <div className="sticky top-0">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Select Staff Member</span>
                </h4>
                
                <div className="space-y-3">
                  {staffMembers?.map((staff) => (
                    <div
                      key={staff?.id}
                      onClick={() => setSelectedStaff(staff?.id)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                        selectedStaff === staff?.id
                          ? 'border-indigo-500 bg-indigo-50' :'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white ${
                          selectedStaff === staff?.id ? 'bg-indigo-600' : 'bg-gray-400'
                        }`}>
                          {staff?.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{staff?.full_name}</div>
                          <div className="text-sm text-gray-600">{staff?.role} • {staff?.department}</div>
                        </div>
                        {selectedStaff === staff?.id && (
                          <CheckCircle className="w-5 h-5 text-indigo-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bulk Assignment Button */}
                {assignmentMode === 'bulk' && selectedAppointments?.size > 0 && (
                  <button
                    onClick={handleBulkAssign}
                    disabled={!selectedStaff}
                    className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Assign {selectedAppointments?.size} Appointment{selectedAppointments?.size !== 1 ? 's' : ''}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Unassigned Jobs */}
            <div className="lg:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Unassigned Jobs ({unassignedJobs?.length})</span>
              </h4>

              {assignmentMode === 'individual' && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {unassignedJobs?.length > 0 ? (
                    unassignedJobs?.map((job) => (
                      <div key={job?.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-all duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="text-sm font-semibold text-gray-900">#{job?.job_number}</span>
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                job?.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                job?.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                job?.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {job?.priority?.toUpperCase()}
                              </div>
                            </div>
                            
                            <h5 className="font-medium text-gray-900 mb-1">{job?.title}</h5>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <div className="flex items-center space-x-1">
                                <Car className="w-4 h-4" />
                                <span>
                                  {job?.vehicles?.year} {job?.vehicles?.make} {job?.vehicles?.model}
                                </span>
                              </div>
                              {job?.vehicles?.stock_number && (
                                <span>Stock: #{job?.vehicles?.stock_number}</span>
                              )}
                            </div>

                            {job?.vehicles?.owner_name && (
                              <div className="text-sm text-gray-600 mt-1">
                                Customer: {job?.vehicles?.owner_name}
                              </div>
                            )}

                            <div className="text-xs text-gray-500 mt-2">
                              Created: {formatJobTime(job?.created_at)}
                            </div>
                          </div>

                          <button
                            onClick={() => handleQuickAssign(job?.id)}
                            disabled={!selectedStaff}
                            className="ml-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center space-x-2"
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>Assign</span>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-600">No unassigned jobs at the moment</p>
                    </div>
                  )}
                </div>
              )}

              {assignmentMode === 'bulk' && (
                <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-200">
                  <div className="text-center">
                    <UserPlus className="w-12 h-12 mx-auto mb-3 text-indigo-600" />
                    <h5 className="font-semibold text-gray-900 mb-2">Bulk Assignment Mode</h5>
                    <p className="text-gray-600 mb-4">
                      Select a staff member on the left to assign all {selectedAppointments?.size} selected appointment{selectedAppointments?.size !== 1 ? 's' : ''} at once.
                    </p>
                    {selectedStaff && (
                      <div className="text-sm text-indigo-700">
                        Ready to assign to: <strong>{staffMembers?.find(s => s?.id === selectedStaff)?.full_name}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentQuickPanel;