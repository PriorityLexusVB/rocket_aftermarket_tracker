import React, { useState } from 'react'
import { Clock, User, Phone, Calendar, Search } from 'lucide-react'

const UnassignedQueue = ({ jobs = [], onAssignJob, onScheduleJob }) => {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter jobs based on search query including phone numbers
  const filteredJobs = jobs?.filter((job) => {
    if (!searchQuery) return true
    const query = searchQuery?.toLowerCase()
    return (
      job?.title?.toLowerCase()?.includes(query) ||
      job?.description?.toLowerCase()?.includes(query) ||
      job?.vehicle?.owner_name?.toLowerCase()?.includes(query) ||
      job?.vehicle?.owner_phone?.toLowerCase()?.includes(query) ||
      job?.vehicle?.owner_email?.toLowerCase()?.includes(query) ||
      job?.vehicle?.make?.toLowerCase()?.includes(query) ||
      job?.vehicle?.model?.toLowerCase()?.includes(query) ||
      job?.vehicle?.vin?.toLowerCase()?.includes(query)
    )
  })

  return (
    <div className="bg-card border border-border rounded-lg h-full">
      {/* Header with Search */}
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground mb-3">
          Needs Scheduling ({filteredJobs?.length})
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="search"
            placeholder="Search jobs by title, customer, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e?.target?.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
      </div>

      {/* Job List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredJobs?.map((job) => (
          <div
            key={job?.id}
            className="bg-background border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-medium text-foreground text-sm mb-1">{job?.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{job?.description}</p>
              </div>
              <div className="flex items-center space-x-1 ml-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    job?.priority === 'urgent'
                      ? 'bg-red-500'
                      : job?.priority === 'high'
                        ? 'bg-orange-500'
                        : job?.priority === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                  }`}
                />
              </div>
            </div>

            {/* Vehicle & Customer Info */}
            <div className="text-xs text-muted-foreground mb-3">
              <div className="flex items-center justify-between">
                <span>
                  {job?.vehicle?.year} {job?.vehicle?.make} {job?.vehicle?.model}
                </span>
                <span className="flex items-center">
                  <User className="w-3 h-3 mr-1" />
                  {job?.vehicle?.owner_name}
                </span>
              </div>
              {job?.vehicle?.owner_phone && (
                <div className="flex items-center mt-1 text-blue-600">
                  <Phone className="w-3 h-3 mr-1" />
                  <a href={`tel:${job?.vehicle?.owner_phone}`} className="hover:underline">
                    {job?.vehicle?.owner_phone}
                  </a>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="w-3 h-3 mr-1" />
                {job?.estimated_hours || 0}h est.
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onScheduleJob?.(job)}
                  className="flex items-center px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  Schedule
                </button>
                <button
                  onClick={() => onAssignJob?.(job)}
                  className="flex items-center px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
                >
                  <User className="w-3 h-3 mr-1" />
                  Assign
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {filteredJobs?.length === 0 && (
          <div className="text-center py-8">
            <div className="text-muted-foreground text-sm">
              {searchQuery ? 'No jobs match your search' : 'No jobs to schedule'}
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UnassignedQueue
