import React, { useState, useEffect } from 'react';
import { Camera, Upload, FileText, Plus, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import photoDocumentationService from '../../services/photoDocumentationService';
import { jobService } from '../../services/jobService';
import { vehicleService } from '../../services/vehicleService';
import PhotoGalleryPanel from './components/PhotoGalleryPanel';
import DocumentationNotesPanel from './components/DocumentationNotesPanel';
import PhotoUploadModal from './components/PhotoUploadModal';
import NoteCreationModal from './components/NoteCreationModal';

const PhotoDocumentationCenter = () => {
  const { user } = useAuth();
  const [selectedJob, setSelectedJob] = useState(null);
  const [documentation, setDocumentation] = useState({ photos: [], notes: [], totalPhotos: 0, totalNotes: 0 });
  const [jobs, setJobs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    stage: 'all',
    category: 'all',
    dateRange: 'all',
    searchTerm: ''
  });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Load initial data
  useEffect(() => {
    loadJobs();
    loadVehicles();
  }, []);

  // Load documentation when job is selected
  useEffect(() => {
    if (selectedJob?.id) {
      loadJobDocumentation(selectedJob?.id);
    }
  }, [selectedJob]);

  const loadJobs = async () => {
    const result = await jobService?.getAllJobs();
    if (result?.success) {
      setJobs(result?.data || []);
      // Auto-select first job if available
      if (result?.data?.length > 0 && !selectedJob) {
        setSelectedJob(result?.data?.[0]);
      }
    }
  };

  const loadVehicles = async () => {
    const result = await vehicleService?.getAllVehicles();
    if (result?.success) {
      setVehicles(result?.data || []);
    }
  };

  const loadJobDocumentation = async (jobId) => {
    if (!jobId) return;
    
    setLoading(true);
    try {
      const result = await photoDocumentationService?.getCompleteJobDocumentation(jobId);
      if (result?.success) {
        setDocumentation(result?.data || { photos: [], notes: [], totalPhotos: 0, totalNotes: 0 });
      } else {
        setDocumentation({ photos: [], notes: [], totalPhotos: 0, totalNotes: 0 });
      }
    } catch (error) {
      console.error('Error loading documentation:', error);
      setDocumentation({ photos: [], notes: [], totalPhotos: 0, totalNotes: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (uploadData) => {
    if (!selectedJob?.id) return;

    const result = await photoDocumentationService?.uploadJobPhoto(
      selectedJob?.id,
      selectedJob?.vehicle_id,
      uploadData?.file,
      {
        category: uploadData?.category,
        stage: uploadData?.stage,
        description: uploadData?.description
      }
    );

    if (result?.success) {
      // Refresh documentation
      loadJobDocumentation(selectedJob?.id);
      setShowUploadModal(false);
      return { success: true };
    } else {
      return { success: false, error: result?.error };
    }
  };

  const handleNoteAdd = async (noteData) => {
    if (!selectedJob?.id) return;

    const result = await photoDocumentationService?.addDocumentationNote(
      selectedJob?.id,
      selectedJob?.vehicle_id,
      noteData?.message,
      noteData?.category
    );

    if (result?.success) {
      // Refresh documentation
      loadJobDocumentation(selectedJob?.id);
      setShowNoteModal(false);
      return { success: true };
    } else {
      return { success: false, error: result?.error };
    }
  };

  const getVehicleInfo = (vehicleId) => {
    return vehicles?.find(v => v?.id === vehicleId) || {};
  };

  const filteredPhotos = documentation?.photos?.filter(photo => {
    if (filters?.stage !== 'all' && photo?.stage !== filters?.stage) return false;
    if (filters?.category !== 'all' && photo?.category !== filters?.category) return false;
    if (filters?.searchTerm && !photo?.description?.toLowerCase()?.includes(filters?.searchTerm?.toLowerCase())) return false;
    return true;
  }) || [];

  const filteredNotes = documentation?.notes?.filter(note => {
    if (filters?.searchTerm && !note?.message?.toLowerCase()?.includes(filters?.searchTerm?.toLowerCase())) return false;
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Camera className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Photo Documentation Center</h1>
                <p className="text-sm text-gray-600">Visual progress tracking and comprehensive note logging</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {selectedJob && (
                <>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </button>
                  <button
                    onClick={() => setShowNoteModal(true)}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-140px)]">
        {/* Job Selection Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Active Jobs</h2>
            <p className="text-sm text-gray-600">Select job to view documentation</p>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {jobs?.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No jobs available</p>
                <p className="text-sm">Create a job to start documentation</p>
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {jobs?.map((job) => {
                  const vehicle = getVehicleInfo(job?.vehicle_id);
                  const isSelected = selectedJob?.id === job?.id;
                  
                  return (
                    <div
                      key={job?.id}
                      onClick={() => setSelectedJob(job)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' :'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{job?.title}</p>
                          <p className="text-sm text-gray-600 truncate">
                            {vehicle?.year} {vehicle?.make} {vehicle?.model}
                          </p>
                          <p className="text-sm text-gray-500">Job #{job?.job_number}</p>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            job?.job_status === 'completed' ? 'bg-green-100 text-green-800' :
                            job?.job_status === 'in_progress'? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {job?.job_status?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary Stats */}
          {selectedJob && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{documentation?.totalPhotos || 0}</div>
                  <div className="text-sm text-gray-600">Photos</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{documentation?.totalNotes || 0}</div>
                  <div className="text-sm text-gray-600">Notes</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Documentation Area */}
        <div className="flex-1 flex">
          {selectedJob ? (
            <>
              {/* Photo Gallery Panel (40%) */}
              <div className="w-2/5 border-r border-gray-200">
                <PhotoGalleryPanel
                  photos={filteredPhotos}
                  loading={loading}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>

              {/* Notes Panel (60%) */}
              <div className="flex-1">
                <DocumentationNotesPanel
                  notes={filteredNotes}
                  loading={loading}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ImageIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-xl mb-2">Select a Job to Begin Documentation</p>
                <p className="text-sm">Choose a job from the sidebar to view and manage photos and notes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photo Upload Modal */}
      {showUploadModal && (
        <PhotoUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handlePhotoUpload}
          jobInfo={selectedJob}
          vehicleInfo={getVehicleInfo(selectedJob?.vehicle_id)}
        />
      )}

      {/* Note Creation Modal */}
      {showNoteModal && (
        <NoteCreationModal
          isOpen={showNoteModal}
          onClose={() => setShowNoteModal(false)}
          onSave={handleNoteAdd}
          jobInfo={selectedJob}
          vehicleInfo={getVehicleInfo(selectedJob?.vehicle_id)}
        />
      )}
    </div>
  );
};

export default PhotoDocumentationCenter;