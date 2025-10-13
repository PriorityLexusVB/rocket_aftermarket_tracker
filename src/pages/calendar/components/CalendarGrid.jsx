import React from 'react';
import { format, addDays, startOfWeek, parseISO, getHours, isSameDay } from 'date-fns';
import { Clock, MapPin } from 'lucide-react';
import { estLabel } from '../../../lib/time';

const CalendarGrid = ({ 
  view, 
  showVendorLanes, 
  currentDate, 
  appointments, 
  vendors, 
  vendorCapacity,
  onAppointmentClick, 
  onCreateClick,
  onDrop,
  onDragOver,
  dragging,
  getStatusColor,
  isMobile = false
}) => {

  // Week View (Mon-Sat, 8a-6p EST) with mobile optimization
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // Mon-Sat
    const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM - 6 PM

    if (showVendorLanes) {
      return renderVendorLaneView(days, hours);
    }

    return (
      <div className="bg-white rounded-lg shadow flex flex-col h-full">
        {/* Header - Mobile responsive */}
        <div className={`grid border-b border-gray-200 flex-shrink-0 ${
          isMobile ? 'grid-cols-4' : 'grid-cols-7'
        }`}>
          <div className={`p-2 md:p-4 font-medium text-gray-900 border-r ${
            isMobile ? 'text-xs' : 'text-sm'
          }`}>
            Time
          </div>
          {days?.slice(0, isMobile ? 3 : 6)?.map((day, i) => (
            <div key={i} className={`p-2 md:p-4 text-center border-r border-gray-200 last:border-r-0 ${
              isMobile ? 'text-xs' : 'text-sm'
            }`}>
              <div className="font-medium text-gray-900">{format(day, isMobile ? 'EE' : 'EEE')}</div>
              <div className="text-xs text-gray-500">{format(day, 'MMM d')}</div>
            </div>
          ))}
        </div>
        
        {/* Time Grid - Mobile optimized */}
        <div className="flex-1 overflow-auto">
          {hours?.map(hour => (
            <div key={hour} className={`grid border-b border-gray-100 min-h-16 md:min-h-20 ${
              isMobile ? 'grid-cols-4' : 'grid-cols-7'
            }`}>
              <div className={`p-2 md:p-4 text-xs md:text-sm text-gray-500 border-r border-gray-200 flex items-start ${
                isMobile ? 'px-1 py-2' : ''
              }`}>
                {format(new Date()?.setHours(hour, 0), isMobile ? 'ha' : 'h:mm a')}
              </div>
              {days?.slice(0, isMobile ? 3 : 6)?.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className="p-1 md:p-2 border-r border-gray-100 last:border-r-0 relative hover:bg-blue-50 cursor-pointer"
                  onClick={() => onCreateClick({
                    startTime: new Date(day.setHours(hour, 0))?.toISOString(),
                    endTime: new Date(day.setHours(hour + 1, 0))?.toISOString()
                  })}
                  onDrop={(e) => onDrop(e, {
                    startTime: new Date(day.setHours(hour, 0))?.toISOString(),
                    endTime: new Date(day.setHours(hour + 1, 0))?.toISOString(),
                    vendorId: null
                  })}
                  onDragOver={onDragOver}
                >
                  {/* Render appointments for this time slot */}
                  {appointments?.filter(apt => {
                      const aptDate = parseISO(apt?.scheduled_start_time);
                      return isSameDay(aptDate, day) && getHours(aptDate) === hour;
                    })?.map(apt => (
                      <div
                        key={apt?.id}
                        onClick={(e) => {
                          e?.stopPropagation();
                          onAppointmentClick(apt);
                        }}
                        className={`p-1 md:p-2 rounded-lg text-xs cursor-pointer mb-1 border ${apt?._isDueOnly ? 'border-dashed' : ''} shadow-sm ${getStatusColor(apt?.job_status)} ${
                          dragging?.id === apt?.id ? 'opacity-50' : ''
                        } ${isMobile ? 'min-h-12' : 'min-h-16'}`}
                        draggable
                        onDragStart={(e) => {
                          e?.dataTransfer?.setData('text/plain', '');
                          // This would be handled by parent component
                        }}
                      >
                        <div className="font-semibold text-xs mb-1 truncate leading-tight">
                          {apt?.vehicle_info?.includes('Stock:') ? 
                            apt?.vehicle_info?.split('Stock:')?.[1]?.split('•')?.[0]?.trim() || 
                            apt?.title : apt?.title}
                        </div>
                        {!isMobile && (
                          <>
                            <div className="text-xs opacity-75 truncate">{apt?.vehicle_info}</div>
                            <div className="text-xs opacity-75 truncate">{apt?.vendor_name}</div>
                          </>
                        )}
                        <div className="text-xs font-medium mt-1">
                          {estLabel(apt?.scheduled_start_time, isMobile ? 'h:mm' : 'h:mm a')}
                          {apt?._isDueOnly && <span className="ml-2 text-[10px] font-semibold uppercase">DUE</span>}
                        </div>
                      </div>
                    ))}
                    
                  {/* Drop zone indicator */}
                  {dragging && (
                    <div className="absolute inset-0 border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-50 rounded pointer-events-none" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Vendor Lane View with mobile optimization
  const renderVendorLaneView = (days, hours) => {
    return (
      <div className="bg-white rounded-lg shadow flex flex-col h-full">
        <div className="p-3 md:p-4 border-b border-gray-200">
          <h3 className={`font-medium ${isMobile ? 'text-base' : 'text-lg'}`}>Vendor Resources</h3>
          <p className="text-sm text-gray-500">
            {format(days?.[0], 'MMM d')} - {format(days?.[5], 'MMM d')}
          </p>
        </div>
        <div className="flex-1 overflow-auto p-3 md:p-4 space-y-3 md:space-y-4">
          {vendors?.map(vendor => {
            const vendorAppointments = appointments?.filter(apt => apt?.vendor_id === vendor?.id);
            const capacity = vendorCapacity?.[vendor?.id] || { total: 1, used: 0 };
            const capacityUsed = vendorAppointments?.length;
            const remaining = Math.max(0, capacity?.total - capacityUsed);
            
            return (
              <div key={vendor?.id} className="border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-3 md:px-4 py-2 md:py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className={`font-medium text-gray-900 truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
                        {vendor?.name}
                      </h4>
                      <p className="text-xs md:text-sm text-gray-600 truncate">{vendor?.specialty}</p>
                    </div>
                    <div className="text-right ml-2">
                      <div className="flex items-center space-x-1 md:space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          remaining > 0 
                            ? 'bg-green-100 text-green-800' :'bg-red-100 text-red-800'
                        }`}>
                          {capacityUsed}/{capacity?.total}
                        </span>
                        {!isMobile && (
                          <span className="text-xs text-gray-500">
                            {remaining} remaining
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div 
                  className="p-3 md:p-4 min-h-24 md:min-h-32"
                  onDrop={(e) => onDrop(e, {
                    vendorId: vendor?.id,
                    startTime: new Date()?.toISOString(),
                    endTime: new Date(Date.now() + 3600000)?.toISOString()
                  })}
                  onDragOver={onDragOver}
                >
                  <div className="space-y-2">
                    {vendorAppointments?.length === 0 ? (
                      <div className="text-center py-3 md:py-4 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <div className={isMobile ? 'text-xs' : 'text-sm'}>
                          Drop appointments here {!isMobile && 'or click to create'}
                        </div>
                      </div>
                    ) : (
                      vendorAppointments?.map(apt => (
                        <div
                          key={apt?.id}
                          onClick={() => onAppointmentClick(apt)}
                          className={`p-2 md:p-3 rounded-lg cursor-pointer border ${apt?._isDueOnly ? 'border-dashed' : ''} shadow-sm ${getStatusColor(apt?.job_status)} ${
                            dragging?.id === apt?.id ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <div className={`font-medium truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
                                {apt?.vehicle_info?.includes('Stock:') ? 
                                  apt?.vehicle_info?.split('Stock:')?.[1]?.split('•')?.[0]?.trim() || 
                                  apt?.title : apt?.title}
                              </div>
                              <div className="text-xs md:text-sm text-gray-600 truncate">{apt?.vehicle_info}</div>
                              {!isMobile && (
                                <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                                  <span className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {apt?.estimated_hours}h
                                  </span>
                                  <span className="flex items-center">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {apt?.location}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-2">
                              <div className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                {estLabel(apt?.scheduled_start_time, isMobile ? 'h:mm' : 'h:mm a')}
                                {apt?._isDueOnly && <span className="ml-2 text-[10px] font-semibold uppercase">DUE</span>}
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(parseISO(apt?.scheduled_start_time), 'MMM d')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Drop zone indicator for vendor lane */}
                  {dragging && (
                    <div className="absolute inset-2 border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-30 rounded pointer-events-none" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Day View with mobile optimization
  const renderDayView = () => {
    const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM - 6 PM
    const dayAppointments = appointments?.filter(apt => 
      isSameDay(parseISO(apt?.scheduled_start_time), currentDate)
    );

    return (
      <div className="bg-white rounded-lg shadow flex flex-col h-full">
        <div className="p-3 md:p-4 border-b border-gray-200">
          <h3 className={`font-medium ${isMobile ? 'text-base' : 'text-lg'}`}>
            {format(currentDate, isMobile ? 'MMM d, yyyy' : 'EEEE, MMMM d, yyyy')}
          </h3>
          <p className="text-sm text-gray-500">{dayAppointments?.length} appointments</p>
        </div>
        <div className="flex-1 overflow-auto">
          {hours?.map(hour => (
            <div key={hour} className={`border-b border-gray-100 flex ${isMobile ? 'min-h-16' : 'min-h-20'}`}>
              <div className={`border-r border-gray-200 flex items-start text-gray-500 ${
                isMobile ? 'w-16 p-2 text-xs' : 'w-20 p-4 text-sm'
              }`}>
                {format(new Date()?.setHours(hour, 0), isMobile ? 'ha' : 'h:mm a')}
              </div>
              <div 
                className="flex-1 p-2 hover:bg-blue-50 cursor-pointer relative"
                onClick={() => onCreateClick({
                  startTime: new Date(currentDate.setHours(hour, 0))?.toISOString(),
                  endTime: new Date(currentDate.setHours(hour + 1, 0))?.toISOString()
                })}
                onDrop={(e) => onDrop(e, {
                  startTime: new Date(currentDate.setHours(hour, 0))?.toISOString(),
                  endTime: new Date(currentDate.setHours(hour + 1, 0))?.toISOString()
                })}
                onDragOver={onDragOver}
              >
                {dayAppointments?.filter(apt => getHours(parseISO(apt?.scheduled_start_time)) === hour)?.map(apt => (
                    <div
                      key={apt?.id}
                      onClick={(e) => {
                        e?.stopPropagation();
                        onAppointmentClick(apt);
                      }}
                      className={`p-2 md:p-3 rounded-lg cursor-pointer mb-2 border ${apt?._isDueOnly ? 'border-dashed' : ''} shadow-sm ${getStatusColor(apt?.job_status)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className={`font-medium truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
                            {apt?.vehicle_info?.includes('Stock:') ? 
                              apt?.vehicle_info?.split('Stock:')?.[1]?.split('•')?.[0]?.trim() || 
                              apt?.title : apt?.title}
                          </div>
                          <div className="text-xs md:text-sm text-gray-600 truncate">{apt?.vehicle_info}</div>
                          {!isMobile && (
                            <div className="text-sm text-gray-600">{apt?.vendor_name}</div>
                          )}
                        </div>
                        <div className="text-right ml-2">
                          <div className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            {estLabel(apt?.scheduled_start_time, isMobile ? 'h:mm' : 'h:mm a')} 
                            {!isMobile && ` - ${estLabel(apt?.scheduled_end_time, 'h:mm a')}`}
                            {apt?._isDueOnly && <span className="ml-2 text-[10px] font-semibold uppercase">DUE</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                {/* Drop zone indicator */}
                {dragging && (
                  <div className="absolute inset-0 border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-50 rounded pointer-events-none" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Agenda View with mobile optimization
  const renderAgendaView = () => {
    const sortedAppointments = [...appointments]?.sort((a, b) => 
      new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time)
    );

    return (
      <div className="bg-white rounded-lg shadow flex flex-col h-full">
        <div className="p-3 md:p-4 border-b border-gray-200">
          <h3 className={`font-medium ${isMobile ? 'text-base' : 'text-lg'}`}>Agenda View</h3>
          <p className="text-sm text-gray-500">{appointments?.length} appointments</p>
        </div>
        <div className="flex-1 overflow-auto p-3 md:p-4">
          <div className="space-y-3">
            {sortedAppointments?.map(apt => (
              <div
                key={apt?.id}
                onClick={() => onAppointmentClick(apt)}
                className={`p-3 md:p-4 rounded-lg cursor-pointer border shadow-sm hover:shadow-md transition-shadow ${getStatusColor(apt?.job_status)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`font-medium ${isMobile ? 'text-base' : 'text-lg'} truncate pr-2`}>
                    {apt?.vehicle_info?.includes('Stock:') ? 
                      apt?.vehicle_info?.split('Stock:')?.[1]?.split('•')?.[0]?.trim() || 
                      apt?.title : apt?.title}
                  </div>
                  <div className={`font-medium text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {estLabel(apt?.scheduled_start_time, isMobile ? 'M/d h:mm a' : 'MMM d, h:mm a')}
                  </div>
                </div>
                
                {/* Mobile: Simplified grid */}
                {isMobile ? (
                  <div className="space-y-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Vehicle:</span>
                      <div className="truncate">{apt?.vehicle_info}</div>
                    </div>
                    <div>
                      <span className="font-medium">Vendor:</span>
                      <div className="truncate">{apt?.vendor_name}</div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Vehicle:</span>
                      <div>{apt?.vehicle_info}</div>
                    </div>
                    <div>
                      <span className="font-medium">Vendor:</span>
                      <div>{apt?.vendor_name}</div>
                    </div>
                    <div>
                      <span className="font-medium">Location:</span>
                      <div>{apt?.location || 'Not specified'}</div>
                    </div>
                  </div>
                )}
                
                {apt?.description && !isMobile && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Notes:</span> {apt?.description}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-3">
                  <div className={`flex items-center space-x-2 md:space-x-4 text-xs text-gray-500 ${
                    isMobile ? 'flex-wrap' : ''
                  }`}>
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {apt?.estimated_hours}h
                    </span>
                    <span>Job #{apt?.job_number}</span>
                    {!isMobile && (
                      <span className="capitalize">{apt?.priority} priority</span>
                    )}
                  </div>
                  
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(apt?.job_status)}`}>
                    {apt?.job_status?.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))}
            
            {sortedAppointments?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No appointments scheduled</p>
                <button 
                  onClick={() => onCreateClick()}
                  className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Schedule your first appointment
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render based on view
  if (view === 'day') return renderDayView();
  if (view === 'agenda') return renderAgendaView();
  return renderWeekView();
};

export default CalendarGrid;