// Note: vehicles may not have org_id; tenant scoping flows via dealer_id and RLS.
import { supabase } from '@/lib/supabase'
import { buildUserProfileSelectFragment, resolveUserProfileName } from '@/utils/userProfileName'

export const claimsService = {
  // Get all claims with vehicle and product details
  async getAllClaims(orgId = null) {
    try {
      const profileFrag = buildUserProfileSelectFragment()
      let q = supabase
        ?.from('claims')
        ?.select(
          `
          *,
          vehicle:vehicles(make, model, year, vin, owner_name),
          product:products(name, brand, category),
          submitted_by_profile:user_profiles!submitted_by${profileFrag},
          assigned_to_profile:user_profiles!assigned_to${profileFrag}
        `
        )
        ?.order('created_at', { ascending: false })
      if (orgId) q = q?.eq('dealer_id', orgId)
      const { data } = await q.throwOnError()
      return (data || []).map((c) => ({
        ...c,
        submitted_by_profile: c?.submitted_by_profile
          ? {
              ...c.submitted_by_profile,
              display_name: resolveUserProfileName(c.submitted_by_profile),
            }
          : null,
        assigned_to_profile: c?.assigned_to_profile
          ? {
              ...c.assigned_to_profile,
              display_name: resolveUserProfileName(c.assigned_to_profile),
            }
          : null,
      }))
    } catch (error) {
      throw new Error(`Failed to fetch claims: ${error.message}`)
    }
  },

  // Get claims for customer portal (filtered by customer info)
  async getCustomerClaims(customerEmail, orgId = null) {
    try {
      let q = supabase
        ?.from('claims')
        ?.select(
          `
          *,
          vehicle:vehicles(make, model, year, owner_name),
          product:products(name, brand, category),
          attachments:claim_attachments(*)
        `
        )
        ?.eq('customer_email', customerEmail)
        ?.order('created_at', { ascending: false })
      if (orgId) q = q?.eq('dealer_id', orgId)
      const { data } = await q.throwOnError()
      return data || []
    } catch (error) {
      throw new Error(`Failed to fetch customer claims: ${error.message}`)
    }
  },

  // Get customer's vehicles for dropdown
  async getCustomerVehicles(customerEmail, orgId = null) {
    try {
      let q = supabase
        ?.from('vehicles')
        ?.select('id, make, model, year, vin')
        ?.eq('owner_email', customerEmail)
        ?.eq('vehicle_status', 'active')
      if (orgId) q = q?.eq('dealer_id', orgId)
      const { data } = await q.throwOnError()
      return data || []
    } catch (error) {
      throw new Error(`Failed to fetch customer vehicles: ${error.message}`)
    }
  },

  // Get products for claims
  async getProducts(orgId = null) {
    try {
      let q = supabase
        ?.from('products')
        ?.select('id, name, brand, category, unit_price')
        ?.order('name')
      if (orgId) q = q?.eq('dealer_id', orgId)
      const { data } = await q.throwOnError()
      return data || []
    } catch (error) {
      throw new Error(`Failed to fetch products: ${error.message}`)
    }
  },

  // Create new claim
  async createClaim(claimData) {
    try {
      // Generate claim number
      const { data: claimNumber, error: numberError } = await supabase?.rpc('generate_claim_number')

      if (numberError) throw numberError

      const newClaim = {
        ...claimData,
        claim_number: claimNumber,
      }

      const { data, error } = await supabase?.from('claims')?.insert([newClaim])?.select(`
          *,
          vehicle:vehicles(make, model, year),
          product:products(name, brand)
        `)

      if (error) throw error
      return data?.[0]
    } catch (error) {
      throw new Error(`Failed to create claim: ${error.message}`)
    }
  },

  // Update claim status and details
  async updateClaim(claimId, updates) {
    try {
      const profileFrag2 = buildUserProfileSelectFragment()
      const { data, error } = await supabase?.from('claims')?.update(updates)?.eq('id', claimId)
        ?.select(`
          *,
          vehicle:vehicles(make, model, year),
          product:products(name, brand),
          assigned_to_profile:user_profiles!assigned_to${profileFrag2}
        `)

      if (error) throw error

      // Under RLS, UPDATE may succeed with 0 rows affected; detect and surface a clear error.
      if (!Array.isArray(data) || data.length === 0) {
        const { data: stillThere, error: checkErr } = await supabase
          ?.from('claims')
          ?.select('id')
          ?.eq('id', claimId)
          ?.limit(1)

        if (checkErr) throw checkErr
        if (Array.isArray(stillThere) && stillThere.length > 0) {
          throw new Error('Update was blocked by permissions (RLS).')
        }

        throw new Error('Claim not found (or you do not have access).')
      }

      const row = data[0]
      if (row?.assigned_to_profile) {
        row.assigned_to_profile.display_name = resolveUserProfileName(row.assigned_to_profile)
      }
      return row
    } catch (error) {
      throw new Error(`Failed to update claim: ${error.message}`)
    }
  },

  // Upload claim photo
  async uploadClaimPhoto(claimId, file, description) {
    try {
      const fileName = `${Date.now()}-${file?.name}`
      const filePath = `claim-${claimId}/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase?.storage
        ?.from('claim-photos')
        ?.upload(filePath, file)

      if (uploadError) throw uploadError

      // Save attachment record
      const { data, error } = await supabase
        ?.from('claim_attachments')
        ?.insert([
          {
            claim_id: claimId,
            file_name: file?.name,
            file_path: filePath,
            file_type: file?.type,
            file_size: file?.size,
            description: description,
          },
        ])
        ?.select()

      if (error) throw error
      return data?.[0]
    } catch (error) {
      throw new Error(`Failed to upload photo: ${error.message}`)
    }
  },

  // Get signed URL for claim photo with enhanced error handling
  async getClaimPhotoUrl(filePath) {
    try {
      // Validate file path
      if (!filePath) {
        console.warn('No file path provided for signed URL')
        return null
      }

      // Safely parse folder and filename
      const pathParts = filePath?.split('/')
      if (!pathParts || pathParts?.length < 2) {
        console.warn(`Invalid file path format: ${filePath}`)
        return null
      }

      const folderName = pathParts?.[0]
      const fileName = pathParts?.slice(-1)?.[0]

      // Check if file exists first with enhanced error handling
      const { data: fileExists, error: existsError } = await supabase?.storage
        ?.from('claim-photos')
        ?.list(folderName, {
          search: fileName,
        })

      // Handle list operation errors gracefully
      if (existsError) {
        console.warn('Error checking file existence:', {
          error: existsError,
          filePath,
          folderName,
          fileName,
        })
        return null // Return null instead of throwing
      }

      // Check if file was found in the list
      if (!fileExists || !Array.isArray(fileExists) || fileExists?.length === 0) {
        console.info(`File not found in storage: ${filePath}`)
        return null
      }

      // Verify the exact file exists in the results
      const fileFound = fileExists?.find((file) => file?.name === fileName)
      if (!fileFound) {
        console.info(`Specific file not found in folder: ${fileName} in ${folderName}`)
        return null
      }

      // Create signed URL with error handling
      const { data, error } = await supabase?.storage
        ?.from('claim-photos')
        ?.createSignedUrl(filePath, 7200) // 2 hour expiry for images

      if (error) {
        console.warn('Error creating signed URL:', {
          error,
          filePath,
          errorMessage: error?.message,
          statusCode: error?.statusCode,
        })
        return null
      }

      if (!data?.signedUrl) {
        console.warn('No signed URL returned from Supabase:', { filePath, data })
        return null
      }

      return data?.signedUrl
    } catch (error) {
      console.warn('Unexpected error in getClaimPhotoUrl:', {
        error: error?.message || error,
        filePath,
        stack: error?.stack,
      })
      return null
    }
  },

  // Get claim attachments with enhanced error isolation
  async getClaimAttachments(claimId) {
    try {
      if (!claimId) {
        console.warn('No claim ID provided for attachments')
        return []
      }

      const { data, error } = await supabase
        ?.from('claim_attachments')
        ?.select('*')
        ?.eq('claim_id', claimId)
        ?.order('created_at', { ascending: false })

      if (error) {
        console.error('Database error fetching claim attachments:', {
          error: error?.message,
          claimId,
        })
        throw error
      }

      // Return empty array if no attachments
      if (!data || data?.length === 0) {
        console.info(`No attachments found for claim ${claimId}`)
        return []
      }

      console.info(`Processing ${data?.length} attachments for claim ${claimId}`)

      // Process attachments with better error isolation
      const attachmentPromises = data?.map(async (attachment, index) => {
        try {
          // Validate attachment data
          if (!attachment?.file_path) {
            console.warn(`Attachment ${attachment?.id} has no file path`)
            return {
              ...attachment,
              signedUrl: null,
              hasValidUrl: false,
              error: 'No file path',
            }
          }

          console.info(
            `Processing attachment ${index + 1}/${data?.length}: ${attachment?.file_name}`
          )

          const signedUrl = await this.getClaimPhotoUrl(attachment?.file_path)

          return {
            ...attachment,
            signedUrl: signedUrl,
            hasValidUrl: !!signedUrl,
            error: signedUrl ? null : 'Failed to generate signed URL',
          }
        } catch (attachmentError) {
          console.warn(`Error processing attachment ${attachment?.id}:`, {
            error: attachmentError?.message,
            attachmentId: attachment?.id,
            fileName: attachment?.file_name,
          })

          return {
            ...attachment,
            signedUrl: null,
            hasValidUrl: false,
            error: attachmentError?.message || 'Processing error',
          }
        }
      })

      // Use Promise.allSettled to handle all attachments regardless of individual failures
      const settledResults = await Promise.allSettled(attachmentPromises)

      const processedAttachments = settledResults?.map((result, index) => {
        if (result?.status === 'fulfilled') {
          return result?.value
        } else {
          console.error(`Failed to process attachment ${index}:`, result?.reason)
          return {
            id: `failed_${index}`,
            signedUrl: null,
            hasValidUrl: false,
            error: result?.reason?.message || 'Promise rejected',
          }
        }
      })

      // Filter out any completely invalid results
      const validAttachments = processedAttachments?.filter(
        (attachment) =>
          (attachment && attachment?.id && typeof attachment?.id !== 'string') ||
          !attachment?.id?.startsWith('failed_')
      )

      const successCount = validAttachments?.filter((a) => a?.hasValidUrl)?.length
      const totalCount = validAttachments?.length

      console.info(
        `Successfully processed ${successCount}/${totalCount} attachments for claim ${claimId}`
      )

      return validAttachments
    } catch (error) {
      console.error('Critical error in getClaimAttachments:', {
        error: error?.message,
        claimId,
        stack: error?.stack,
      })

      // Instead of throwing, return empty array to prevent UI breaks
      return []
    }
  },

  // Add method to clean up orphaned attachment records
  async validateClaimAttachments(claimId) {
    try {
      const attachments = await supabase
        ?.from('claim_attachments')
        ?.select('*')
        ?.eq('claim_id', claimId)

      if (!attachments?.data) return { valid: 0, invalid: 0 }

      let validCount = 0
      let invalidCount = 0

      for (const attachment of attachments?.data) {
        const signedUrl = await this.getClaimPhotoUrl(attachment?.file_path)
        if (signedUrl) {
          validCount++
        } else {
          invalidCount++
          console.warn(`Invalid attachment found: ${attachment?.id} - ${attachment?.file_name}`)
        }
      }

      return { valid: validCount, invalid: invalidCount, total: attachments?.data?.length }
    } catch (error) {
      console.error('Error validating claim attachments:', error)
      return { valid: 0, invalid: 0, total: 0 }
    }
  },

  // List files in storage bucket for debugging
  async listClaimFiles(claimId) {
    try {
      const folderPath = `claim-${claimId}`
      const { data, error } = await supabase?.storage?.from('claim-photos')?.list(folderPath, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error listing claim files:', error)
      throw new Error(`Failed to list claim files: ${error.message}`)
    }
  },

  // Download claim photo directly
  async downloadClaimPhoto(filePath) {
    try {
      const { data, error } = await supabase?.storage?.from('claim-photos')?.download(filePath)

      if (error) throw error

      // Create download link
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = filePath?.split('/')?.pop()
      document.body?.appendChild(link)
      link?.click()
      document.body?.removeChild(link)
      URL.revokeObjectURL(url)

      return true
    } catch (error) {
      console.error('Error downloading claim photo:', error)
      throw new Error(`Failed to download photo: ${error.message}`)
    }
  },

  // Get claims statistics for management dashboard
  async getClaimsStats(orgId = null) {
    try {
      let q = supabase?.from('claims')?.select('status, priority, claim_amount, created_at')
      if (orgId) q = q?.eq('dealer_id', orgId)
      const { data, error } = await q

      if (error) throw error

      const stats = {
        total: data?.length || 0,
        byStatus: {},
        byPriority: {},
        totalAmount: 0,
        avgAmount: 0,
        recentClaims: 0,
      }

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo?.setDate(thirtyDaysAgo?.getDate() - 30)

      data?.forEach((claim) => {
        // Count by status
        stats.byStatus[claim.status] = (stats?.byStatus?.[claim?.status] || 0) + 1

        // Count by priority
        stats.byPriority[claim.priority] = (stats?.byPriority?.[claim?.priority] || 0) + 1

        // Sum amounts
        if (claim?.claim_amount) {
          stats.totalAmount += parseFloat(claim?.claim_amount)
        }

        // Count recent claims
        if (new Date(claim.created_at) > thirtyDaysAgo) {
          stats.recentClaims++
        }
      })

      stats.avgAmount = stats?.total > 0 ? stats?.totalAmount / stats?.total : 0

      return stats
    } catch (error) {
      throw new Error(`Failed to fetch claims statistics: ${error.message}`)
    }
  },

  // Get staff for assignment dropdown
  async getStaff(orgId = null) {
    try {
      let q = supabase
        ?.from('user_profiles')
        ?.select('id, full_name, email, role')
        ?.in('role', ['admin', 'manager', 'staff'])
        ?.eq('is_active', true)
        ?.order('full_name')
      if (orgId) q = q?.eq('dealer_id', orgId)
      const { data, error } = await q

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(`Failed to fetch staff: ${error.message}`)
    }
  },
}
