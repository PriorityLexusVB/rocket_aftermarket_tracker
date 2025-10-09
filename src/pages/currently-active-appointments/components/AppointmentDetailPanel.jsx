import React, { useState, useEffect } from 'react';
import { X, Clock, User, Building2, Phone, MessageCircle, FileText, Edit3, Save, AlertTriangle, RefreshCw, Car, DollarSign, MapPin, CalendarClock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const AppointmentDetailPanel = ({ appointment, onClose, onUpdate }) => {
  const [communications, setCommunications] = useState([]);
  const [jobParts, setJobParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(appointment?.calendar_notes || '');
  const [newCommunication, setNewCommunication] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const StatusIcon = appointment?.statusConfig?.icon;
  const isOverdue = appointment?.isOverdue;

  useEffect(() => {
    loadAppointmentDetails();
  }, [appointment?.id]);

  const loadAppointmentDetails = async () => {
    if (!appointment?.id) return;
    
    try {
      setLoading(true);
      
      // Load communications
      const { data: commsData, error: commsError } = await supabase?.from('communications')?.select(`
          *,
          sent_by_profile:user_profiles!sent_by (full_name, email)
        `)?.eq('job_id', appointment?.id)?.order('sent_at', { ascending: false });

      if (commsError) throw commsError;
      setCommunications(commsData || []);

      // Load job parts/products
      const { data: partsData, error: partsError } = await supabase?.from('job_parts')?.select(`
          *,
          products (name, estimated_cost, vendor_id)
        `)?.eq('job_id', appointment?.id);

      if (partsError) throw partsError;
      setJobParts(partsData || []);
      
    } catch (error) {
      console.error('Error loading appointment details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      const { error } = await supabase?.from('jobs')?.update({ 
          calendar_notes: notes,
          updated_at: new Date()?.toISOString()
        })?.eq('id', appointment?.id);

      if (error) throw error;
      
      setEditingNotes(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newCommunication?.trim()) return;
    
    try {
      setSendingMessage(true);
      
      const { error } = await supabase?.from('communications')?.insert({
          job_id: appointment?.id,
          vehicle_id: appointment?.vehicle_id,
          communication_type: 'note',
          message: newCommunication?.trim(),
          sent_at: new Date()?.toISOString(),
          is_successful: true
        });

      if (error) throw error;
      
      setNewCommunication('');
      loadAppointmentDetails();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Not scheduled';
    return new Date(timestamp)?.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    })?.format(amount);
  };

  const getTimeRemaining = () => {
    if (!appointment?.promised_date) return null;
    
    const now = new Date();
    const promisedDate = new Date(appointment?.promised_date);
    const diffMs = promisedDate - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) return { text: 'Overdue', urgent: true };
    if (diffDays > 0) return { text: `${diffDays}d ${diffHours % 24}h remaining`, urgent: false };
    if (diffHours > 0) return { text: `${diffHours}h remaining`, urgent: diffHours <= 2 };
    return { text: 'Due very soon', urgent: true };
  };

  const timeRemaining = getTimeRemaining();
  const totalEstimatedCost = jobParts?.reduce((sum, part) => sum + (parseFloat(part?.products?.estimated_cost) || 0), 0);

  return (
    <div className="h-full flex flex-col bg-white/95 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 border-b border-gray-200/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Appointment Details</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all duration-200"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Appointment Overview */}
        <div className={`rounded-2xl p-6 border ${
          isOverdue ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200' : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                isOverdue ? 'bg-gradient-to-br from-red-600 to-red-700' : 'bg-gradient-to-br from-indigo-600 to-purple-700'
              }`}>
                <StatusIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <span className="text-lg font-bold text-gray-900">
                    #{appointment?.job_number}
                  </span>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${appointment?.priorityConfig?.bg} ${appointment?.priorityConfig?.color}`}>
                    {appointment?.priority?.toUpperCase()}
                  </div>
                </div>
                <h4 className="text-base font-semibold text-gray-900">{appointment?.title}</h4>
              </div>
            </div>

            <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${appointment?.statusConfig?.bg} ${appointment?.statusConfig?.text} ${appointment?.statusConfig?.border} border`}>
              <StatusIcon className="w-4 h-4 mr-2" />
              {appointment?.statusConfig?.label}
            </div>
          </div>

          {/* Time Remaining Alert */}
          {timeRemaining && (
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl ${
              timeRemaining?.urgent ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'
            }`}>
              {timeRemaining?.urgent ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              <span className="text-sm font-semibold">{timeRemaining?.text}</span>
            </div>
          )}
        </div>
      </div>
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Vehicle & Customer Information */}
        <div className="grid grid-cols-1 gap-6">
          {/* Vehicle Details */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <Car className="w-5 h-5 text-gray-600" />
              <h5 className="font-semibold text-gray-900">Vehicle Information</h5>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Vehicle:</span>
                <div className="text-gray-900 font-semibold">
                  {appointment?.vehicles?.year} {appointment?.vehicles?.make} {appointment?.vehicles?.model}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Stock #:</span>
                <div className="text-gray-900">{appointment?.vehicles?.stock_number || 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Color:</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-4 h-4 rounded-full border`} style={{backgroundColor: appointment?.vehicles?.color?.toLowerCase() || '#gray'}}></div>
                  <span className="text-gray-900">{appointment?.vehicles?.color}</span>
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">License:</span>
                <div className="text-gray-900">{appointment?.vehicles?.license_plate || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <User className="w-5 h-5 text-gray-600" />
              <h5 className="font-semibold text-gray-900">Customer Information</h5>
            </div>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">Name:</span>
                <div className="text-gray-900 font-semibold">{appointment?.vehicles?.owner_name || 'No customer info'}</div>
              </div>
              {appointment?.vehicles?.owner_phone && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-700">Phone:</span>
                    <div className="text-gray-900">{appointment?.vehicles?.owner_phone}</div>
                  </div>
                  <a 
                    href={`tel:${appointment?.vehicles?.owner_phone}`}
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Call
                  </a>
                </div>
              )}
              {appointment?.vehicles?.owner_email && (
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-700">Email:</span>
                    <div className="text-gray-900 truncate">{appointment?.vehicles?.owner_email}</div>
                  </div>
                  <a 
                    href={`mailto:${appointment?.vehicles?.owner_email}`}
                    className="text-indigo-600 hover:text-indigo-700 font-medium ml-2"
                  >
                    Email
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Schedule & Vendor Information */}
        <div className="grid grid-cols-1 gap-6">
          {/* Schedule Details */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <CalendarClock className="w-5 h-5 text-gray-600" />
              <h5 className="font-semibold text-gray-900">Schedule Information</h5>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-700">Scheduled Start:</span>
                  <div className="text-gray-900">{formatTime(appointment?.scheduled_start_time)}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Scheduled End:</span>
                  <div className="text-gray-900">{formatTime(appointment?.scheduled_end_time)}</div>
                </div>
              </div>
              {appointment?.promised_date && (
                <div>
                  <span className="font-medium text-gray-700">Promised Completion:</span>
                  <div className="text-gray-900">{formatTime(appointment?.promised_date)}</div>
                </div>
              )}
              {appointment?.location && (
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <span className="font-medium text-gray-700">Location:</span>
                    <div className="text-gray-900">{appointment?.location}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vendor Details */}
          {appointment?.vendors && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center space-x-2 mb-4">
                <Building2 className="w-5 h-5 text-gray-600" />
                <h5 className="font-semibold text-gray-900">Vendor Information</h5>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Vendor:</span>
                  <div className="text-gray-900 font-semibold">{appointment?.vendors?.name}</div>
                </div>
                {appointment?.vendors?.specialty && (
                  <div>
                    <span className="font-medium text-gray-700">Specialty:</span>
                    <div className="text-gray-900">{appointment?.vendors?.specialty}</div>
                  </div>
                )}
                {appointment?.vendors?.contact_person && (
                  <div>
                    <span className="font-medium text-gray-700">Contact:</span>
                    <div className="text-gray-900">{appointment?.vendors?.contact_person}</div>
                  </div>
                )}
                <div className="flex items-center space-x-4">
                  {appointment?.vendors?.phone && (
                    <a 
                      href={`tel:${appointment?.vendors?.phone}`}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Call Vendor
                    </a>
                  )}
                  {appointment?.vendors?.email && (
                    <a 
                      href={`mailto:${appointment?.vendors?.email}`}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Email Vendor
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cost Information */}
        {(appointment?.estimated_cost || totalEstimatedCost > 0 || appointment?.actual_cost) && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <DollarSign className="w-5 h-5 text-gray-600" />
              <h5 className="font-semibold text-gray-900">Cost Information</h5>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              {appointment?.estimated_cost && (
                <div>
                  <span className="font-medium text-gray-700">Estimated Labor:</span>
                  <div className="text-gray-900 font-semibold">{formatCurrency(appointment?.estimated_cost)}</div>
                </div>
              )}
              {totalEstimatedCost > 0 && (
                <div>
                  <span className="font-medium text-gray-700">Estimated Parts:</span>
                  <div className="text-gray-900 font-semibold">{formatCurrency(totalEstimatedCost)}</div>
                </div>
              )}
              {appointment?.actual_cost && (
                <div>
                  <span className="font-medium text-gray-700">Actual Cost:</span>
                  <div className="text-gray-900 font-semibold">{formatCurrency(appointment?.actual_cost)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-gray-600" />
              <h5 className="font-semibold text-gray-900">Notes</h5>
            </div>
            <button
              onClick={() => editingNotes ? handleSaveNotes() : setEditingNotes(true)}
              className="text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center space-x-1"
            >
              {editingNotes ? (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  <span>Edit</span>
                </>
              )}
            </button>
          </div>
          
          {editingNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e?.target?.value)}
              placeholder="Add appointment notes..."
              className="w-full h-32 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
            />
          ) : (
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {appointment?.calendar_notes || notes || 'No notes available'}
            </div>
          )}
        </div>

        {/* Communications Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-2 mb-4">
            <MessageCircle className="w-5 h-5 text-gray-600" />
            <h5 className="font-semibold text-gray-900">Communications</h5>
          </div>

          {/* Add New Communication */}
          <div className="mb-6">
            <div className="flex space-x-3">
              <textarea
                value={newCommunication}
                onChange={(e) => setNewCommunication(e?.target?.value)}
                placeholder="Add a communication note..."
                className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                rows="2"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newCommunication?.trim() || sendingMessage}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm font-medium"
              >
                {sendingMessage ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
                <span>Add Note</span>
              </button>
            </div>
          </div>

          {/* Communications List */}
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">Loading communications...</p>
            </div>
          ) : communications?.length > 0 ? (
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {communications?.map((comm, index) => (
                <div key={comm?.id || index} className="flex space-x-3 p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {comm?.sent_by_profile?.full_name || 'System'}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                        comm?.communication_type === 'sms' ? 'bg-blue-100 text-blue-800' :
                        comm?.communication_type === 'email'? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {comm?.communication_type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comm?.sent_at)?.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comm?.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">No communications yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetailPanel;