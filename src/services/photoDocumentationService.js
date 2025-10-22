// Photo Documentation Service - Handles photo uploads and documentation management
import { supabase } from '@/lib/supabase'
import { safeSelect } from '../lib/supabase/safeSelect'

export const photoDocumentationService = {
  // Upload photo with metadata
  async uploadJobPhoto(jobId, vehicleId, file, metadata = {}) {
    try {
      const user = (await supabase?.auth?.getSession())?.data?.session?.user
      if (!user) throw new Error('User not authenticated')

      const fileExt = file?.name?.split('.')?.pop()
      const timestamp = Date.now()
      const fileName = `${metadata?.stage || 'progress'}_${timestamp}.${fileExt}`
      const filePath = `jobs/${jobId}/${fileName}`

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase?.storage
        ?.from('job-photos')
        ?.upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Save photo metadata to database
      const { data: photoData, error: photoError } = await supabase
        ?.from('job_photos')
        ?.insert({
          job_id: jobId,
          vehicle_id: vehicleId,
          uploaded_by: user?.id,
          file_path: uploadData?.path,
          file_name: file?.name,
          file_size: file?.size,
          mime_type: file?.type,
          category: metadata?.category || 'progress',
          description: metadata?.description || '',
          stage: metadata?.stage || 'progress',
        })
        ?.select()
        ?.single()

      if (photoError) throw photoError

      return { success: true, data: photoData }
    } catch (error) {
      return { success: false, error: error?.message }
    }
  },

  // Get all photos for a job
  async getJobPhotos(jobId, orgId = null) {
    try {
      let q = supabase
        ?.from('job_photos')
        ?.select(
          `
          id,
          job_id,
          vehicle_id,
          file_path,
          file_name,
          file_size,
          mime_type,
          category,
          description,
          stage,
          created_at,
          uploaded_by,
          user_profiles:uploaded_by (
            id,
            full_name
          )
        `
        )
        ?.eq('job_id', jobId)
        ?.order('created_at', { ascending: false })
      if (orgId) q = q?.eq('org_id', orgId)
      const data = await safeSelect(q, 'photoDocs:getJobPhotos')

      return { success: true, data: data || [] }
    } catch (error) {
      return { success: false, error: error?.message, data: [] }
    }
  },

  // Get signed URL for photo viewing
  async getPhotoSignedUrl(filePath, expiresIn = 3600) {
    try {
      const { data, error } = await supabase?.storage
        ?.from('job-photos')
        ?.createSignedUrl(filePath, expiresIn)

      if (error) throw error

      return { success: true, signedUrl: data?.signedUrl }
    } catch (error) {
      return { success: false, error: error?.message }
    }
  },

  // Get multiple signed URLs for photo gallery
  async getPhotoGalleryUrls(photos) {
    try {
      const photosWithUrls = await Promise.all(
        photos?.map(async (photo) => {
          const { signedUrl } = await this.getPhotoSignedUrl(photo?.file_path)
          return {
            ...photo,
            signedUrl: signedUrl || null,
          }
        }) || []
      )

      return { success: true, data: photosWithUrls?.filter((p) => p?.signedUrl) || [] }
    } catch (error) {
      return { success: false, error: error?.message, data: [] }
    }
  },

  // Add documentation note
  async addDocumentationNote(jobId, vehicleId, message, category = 'Progress Updates') {
    try {
      const user = (await supabase?.auth?.getSession())?.data?.session?.user
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        ?.from('communications')
        ?.insert({
          job_id: jobId,
          vehicle_id: vehicleId,
          sent_by: user?.id,
          communication_type: 'note',
          subject: category,
          message: message,
          recipient: 'documentation',
        })
        ?.select()
        ?.single()

      if (error) throw error

      return { success: true, data }
    } catch (error) {
      return { success: false, error: error?.message }
    }
  },

  // Get documentation notes for a job
  async getDocumentationNotes(jobId, orgId = null) {
    try {
      let q = supabase
        ?.from('communications')
        ?.select(
          `
          id,
          job_id,
          vehicle_id,
          message,
          subject,
          communication_type,
          sent_at,
          user_profiles:sent_by (
            id,
            full_name
          )
        `
        )
        ?.eq('job_id', jobId)
        ?.in('communication_type', ['note', 'photo_documentation'])
        ?.order('sent_at', { ascending: false })
      if (orgId) q = q?.eq('org_id', orgId)
      const data = await safeSelect(q, 'photoDocs:getDocumentationNotes')

      return { success: true, data: data || [] }
    } catch (error) {
      return { success: false, error: error?.message, data: [] }
    }
  },

  // Get complete job documentation (photos + notes)
  async getCompleteJobDocumentation(jobId) {
    try {
      const [photosResult, notesResult] = await Promise.all([
        this.getJobPhotos(jobId),
        this.getDocumentationNotes(jobId),
      ])

      if (photosResult?.success && notesResult?.success) {
        const photosWithUrls = await this.getPhotoGalleryUrls(photosResult?.data)

        return {
          success: true,
          data: {
            photos: photosWithUrls?.data || [],
            notes: notesResult?.data || [],
            totalPhotos: photosResult?.data?.length || 0,
            totalNotes: notesResult?.data?.length || 0,
          },
        }
      }

      return { success: false, error: 'Failed to fetch complete documentation' }
    } catch (error) {
      return { success: false, error: error?.message }
    }
  },

  // Delete photo and its file
  async deleteJobPhoto(photoId) {
    try {
      const user = (await supabase?.auth?.getSession())?.data?.session?.user
      if (!user) throw new Error('User not authenticated')

      // Get photo details first
      const { data: photo, error: fetchError } = await supabase
        ?.from('job_photos')
        ?.select('file_path, uploaded_by')
        ?.eq('id', photoId)
        ?.single()

      if (fetchError) throw fetchError

      // Check if user owns the photo
      if (photo?.uploaded_by !== user?.id) {
        throw new Error('You can only delete your own photos')
      }

      // Delete from storage
      const { error: storageError } = await supabase?.storage
        ?.from('job-photos')
        ?.remove([photo?.file_path])

      if (storageError) {
        console.warn('Storage deletion failed:', storageError?.message)
      }

      // Delete from database
      const { error: dbError } = await supabase?.from('job_photos')?.delete()?.eq('id', photoId)

      if (dbError) throw dbError

      return { success: true }
    } catch (error) {
      return { success: false, error: error?.message }
    }
  },

  // Filter photos by stage or category
  async getFilteredJobPhotos(jobId, filters = {}, orgId = null) {
    try {
      let query = supabase
        ?.from('job_photos')
        ?.select(
          `
          id,
          job_id,
          vehicle_id,
          file_path,
          file_name,
          category,
          description,
          stage,
          created_at,
          user_profiles:uploaded_by (
            id,
            full_name
          )
        `
        )
        ?.eq('job_id', jobId)
      if (orgId) query = query?.eq('org_id', orgId)

      if (filters?.stage) {
        query = query?.eq('stage', filters?.stage)
      }

      if (filters?.category) {
        query = query?.eq('category', filters?.category)
      }

      if (filters?.dateFrom) {
        query = query?.gte('created_at', filters?.dateFrom)
      }

      if (filters?.dateTo) {
        query = query?.lte('created_at', filters?.dateTo)
      }

      query = query?.order('created_at', { ascending: false })

      const data = await safeSelect(query, 'photoDocs:getFilteredJobPhotos')
      return { success: true, data: data || [] }
    } catch (error) {
      return { success: false, error: error?.message, data: [] }
    }
  },
}

export default photoDocumentationService
