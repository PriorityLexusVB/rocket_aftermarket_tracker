import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Validate the X-Twilio-Signature header using HMAC-SHA1.
 * Per Twilio docs: HMAC-SHA1(authToken, url + sorted_params), base64-encoded.
 * Returns true if valid, true if TWILIO_AUTH_TOKEN is unset (dev fallback), false if invalid.
 */
async function validateTwilioSignature(
  req: Request,
  formData: FormData,
  authToken: string | undefined
): Promise<boolean> {
  if (!authToken) {
    // Allow skipping validation only when explicitly opted in (local dev).
    // In production, missing token is a misconfiguration — fail closed.
    const skipValidation = Deno.env.get('TWILIO_SKIP_VALIDATION') === 'true'
    if (skipValidation) {
      console.warn('[twilioInbound] TWILIO_AUTH_TOKEN not set — skipping validation (TWILIO_SKIP_VALIDATION=true)')
      return true
    }
    console.error('[twilioInbound] TWILIO_AUTH_TOKEN not set and TWILIO_SKIP_VALIDATION != true — rejecting request')
    return false
  }

  const signature = req.headers.get('X-Twilio-Signature') ?? ''
  if (!signature) {
    console.warn('[twilioInbound] Missing X-Twilio-Signature header')
    return false
  }

  // Build the signed string: URL + sorted POST params appended as key+value
  // Use TWILIO_WEBHOOK_URL env var if set — Twilio signs the exact public URL it was
  // configured with, which may differ from the internal Supabase edge function URL.
  const url = Deno.env.get('TWILIO_WEBHOOK_URL') ?? req.url
  const paramPairs: [string, string][] = []
  for (const [key, value] of formData.entries()) {
    paramPairs.push([key, String(value)])
  }
  paramPairs.sort((a, b) => a[0].localeCompare(b[0]))

  let signedString = url
  for (const [key, value] of paramPairs) {
    signedString += key + value
  }

  // HMAC-SHA1 using SubtleCrypto
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(signedString))
  const computed = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

  if (computed !== signature) {
    console.warn('[twilioInbound] Signature mismatch — rejecting request')
    return false
  }

  return true
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse Twilio webhook data BEFORE signature validation so we can use
    // the parsed params as part of the HMAC input (Twilio spec requires this).
    // We clone the request body because formData() consumes the stream.
    const formData = await req.formData()

    // P0-1: Validate Twilio HMAC-SHA1 signature
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const isValid = await validateTwilioSignature(req, formData, authToken)
    if (!isValid) {
      return new Response('Forbidden', { status: 403 })
    }

    const from = formData.get('From')?.toString()
    const body = formData.get('Body')?.toString()?.trim().toLowerCase()
    if (!from || !body) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Invalid message format.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle STOP/UNSUBSCRIBE commands
    if (body === 'stop' || body === 'unsubscribe') {
      const { error } = await supabaseClient.from('sms_opt_outs').upsert({
        phone_e164: from,
        opted_out_at: new Date().toISOString(),
        reason: 'User requested STOP',
      })

      if (error) {
        console.error('Error adding to opt-out list:', error)
      }

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from SMS notifications. Text START to re-enable.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Handle START command (re-enable SMS)
    if (body === 'start') {
      const { error } = await supabaseClient.from('sms_opt_outs').delete().eq('phone_e164', from)

      if (error) {
        console.error('Error removing from opt-out list:', error)
      }

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>SMS notifications re-enabled. Reply STOP to opt out anytime.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Handle HELP command
    if (body === 'help') {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Stock tracker help: Reply YES to confirm, NO to cancel, C for complete, R for reschedule. Text STOP to unsubscribe.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Find recent job for this phone number (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentJobs, error: jobsError } = await supabaseClient
      .from('jobs')
      .select(
        `
        *,
        vehicles!inner(stock_number, owner_phone)
      `
      )
      .eq('vehicles.owner_phone', from)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1)

    if (jobsError) {
      console.error('Error finding recent jobs:', jobsError)
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Error processing your message. Please call our shop directly.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    if (!recentJobs || recentJobs.length === 0) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>No recent appointments found. Call us for assistance or text HELP for options.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    const job = recentJobs[0]
    const stockNumber = job.vehicles?.stock_number || 'N/A'
    let responseMessage = 'Thank you for your response.'
    let newStatus = job.job_status
    // P0-2: Track whether the YES branch fired so we can write appointment_confirmed_at
    let appointmentConfirmed = false

    // Handle status change responses
    switch (body) {
      case 'yes':
      case 'y':
      case 'confirm':
        if (job.job_status === 'scheduled') {
          // P0-2: 'confirmed' does not exist in the job_status enum.
          // Keep the job as 'scheduled'; record confirmation via appointment_confirmed_at.
          newStatus = 'scheduled'
          appointmentConfirmed = true
          responseMessage = `Stock ${stockNumber} appointment confirmed. We'll see you then!`
        } else {
          responseMessage = `Stock ${stockNumber} status noted. Thank you!`
        }
        break

      case 'no':
      case 'n':
      case 'cancel':
        newStatus = 'cancelled'
        responseMessage = `Stock ${stockNumber} appointment cancelled. We'll contact you to reschedule.`
        break

      case 'c':
      case 'complete':
      case 'done':
        if (['in_progress', 'quality_check'].includes(job.job_status)) {
          newStatus = 'completed'
          responseMessage = `Stock ${stockNumber} marked as complete. Thank you for the update!`
        } else {
          responseMessage = `Stock ${stockNumber} status noted.`
        }
        break

      case 'r':
      case 'reschedule':
        responseMessage = `We'll contact you to reschedule Stock ${stockNumber}. Thank you!`
        break

      default:
        // Check if message contains stock number (customer asking about specific vehicle)
        if (
          body.includes(stockNumber.toLowerCase()) ||
          body.includes('status') ||
          body.includes('when')
        ) {
          const statusMessage = job.job_status.replace('_', ' ')
          const scheduleTime = job.scheduled_start_time
            ? new Date(job.scheduled_start_time).toLocaleDateString()
            : 'TBD'
          responseMessage = `Stock ${stockNumber} status: ${statusMessage}. Scheduled: ${scheduleTime}`
        } else {
          responseMessage = 'Reply YES/NO/C/R for appointment actions, or text HELP for options.'
        }
    }

    // Update job status if it changed, or if we need to record appointment confirmation
    if (newStatus !== job.job_status || appointmentConfirmed) {
      const updateData: Record<string, string> = {
        job_status: newStatus,
        updated_at: new Date().toISOString(),
      }

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString()
      }

      // P0-2: Record appointment confirmation timestamp when customer replies YES
      if (appointmentConfirmed) {
        updateData.appointment_confirmed_at = new Date().toISOString()
      }

      const { error: updateError } = await supabaseClient
        .from('jobs')
        .update(updateData)
        .eq('id', job.id)

      if (updateError) {
        console.error('Error updating job status:', updateError)
      }
    }

    // Log the interaction as a communication record
    const { error: commError } = await supabaseClient.from('communications').insert({
      job_id: job.id,
      vehicle_id: job.vehicle_id,
      communication_type: 'sms',
      message: `Inbound: "${formData.get('Body')}" → Response: "${responseMessage}"`,
      recipient: from,
      subject: 'Inbound SMS Response',
      is_successful: true,
      sent_at: new Date().toISOString(),
    })

    if (commError) {
      console.error('Error logging communication:', commError)
    }

    // Return TwiML response
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${responseMessage}</Message></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  } catch (error) {
    console.error('Inbound SMS processing error:', error)

    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Error processing your message. Please call our shop directly for assistance.</Message></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
})
