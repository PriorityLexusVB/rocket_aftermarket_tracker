import React from 'react';
import { AlertTriangle, Clock, Users } from 'lucide-react';

const KanbanColumn = ({
  column,
  jobs = [],
  stats = { total: 0, overdue: 0, urgent: 0 },
  onJobClick,
  onDragOver,
  onDrop,
  draggedJob,
  children
}) => {
  const handleDragOver = (e) => {
    e?.preventDefault();
    onDragOver?.(e);
  };

  const handleDrop = (e) => {
    e?.preventDefault();
    onDrop?.(e);
  };

  return (
    <div className="flex-shrink-0 w-80">
      {/* Column Header */}
      <div className={`rounded-t-lg border-b-2 p-4 ${column?.headerColor}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">
            {column?.title}
          </h3>
          <div className="flex items-center space-x-2">
            <span className="bg-white bg-opacity-70 text-sm px-2 py-1 rounded-full">
              {stats?.total}
            </span>
          </div>
        </div>

        {/* Column Stats */}
        <div className="flex items-center space-x-4 mt-2">
          {stats?.overdue > 0 && (
            <div className="flex items-center space-x-1 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">{stats?.overdue} overdue</span>
            </div>
          )}
          
          {stats?.urgent > 0 && (
            <div className="flex items-center space-x-1 text-orange-600">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{stats?.urgent} urgent</span>
            </div>
          )}

          {stats?.overdue === 0 && stats?.urgent === 0 && stats?.total > 0 && (
            <div className="flex items-center space-x-1 text-gray-600">
              <Users className="h-4 w-4" />
              <span className="text-sm">All on track</span>
            </div>
          )}
        </div>
      </div>
      {/* Column Content */}
      <div
        className={`
          min-h-96 max-h-[calc(100vh-200px)] overflow-y-auto rounded-b-lg border-2 border-t-0
          ${column?.color} p-2 space-y-2
          ${draggedJob ? 'border-dashed border-blue-400 bg-blue-50' : ''}
        `}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drop zone indicator */}
        {draggedJob && (
          <div className="border-2 border-dashed border-blue-400 rounded-lg p-4 text-center text-blue-600 bg-blue-50">
            Drop to move job to {column?.title}
          </div>
        )}

        {/* Job Cards */}
        {children}

        {/* Empty state */}
        {jobs?.length === 0 && !draggedJob && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm">No jobs in {column?.title?.toLowerCase()}</p>
          </div>
        )}
      </div>
      {/* Column Footer with Quick Stats */}
      <div className="mt-2 text-center">
        <div className="text-xs text-gray-500">
          {stats?.total > 0 && (
            <>
              {stats?.total} job{stats?.total !== 1 ? 's' : ''}
              {stats?.overdue > 0 && (
                <span className="text-red-500 ml-2">
                  ({stats?.overdue} overdue)
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default KanbanColumn;