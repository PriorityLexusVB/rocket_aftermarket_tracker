import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRecord {
  id: string
  phone_e164: string
  message_template: string
  variables: Record<string, any> | null
  not_before: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch unsent notifications that are ready to send
    const { data: notifications, error: fetchError } = await supabaseClient
      .from('notification_outbox')
      .select('*')
      .is('sent_at', null)
      .eq('status', 'pending')
      .lte('not_before', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50) // Process max 50 at a time

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError)
      throw fetchError
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending notifications to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioFromNumber = Deno.env.get('TWILIO_FROM')

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      throw new Error('Missing required Twilio environment variables')
    }

    const processedResults = []

    // Process each notification
    for (const notification of notifications as NotificationRecord[]) {
      try {
        // Build message from template and variables
        let finalMessage = notification.message_template

        // Replace template variables
        if (notification.variables) {
          Object.entries(notification.variables).forEach(([key, value]) => {
            const placeholder = `{${key}}`
            finalMessage = finalMessage.replace(new RegExp(placeholder, 'g'), String(value))
          })
        }

        // Ensure message starts with stock number and is under 160 chars
        if (finalMessage.length > 160) {
          finalMessage = finalMessage.substring(0, 157) + '...'
        }

        // Send SMS via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
        
        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: twilioFromNumber,
            To: notification.phone_e164,
            Body: finalMessage,
          }),
        })

        const twilioData = await twilioResponse.json()

        if (twilioResponse.ok) {
          // Mark as sent in database
          const { error: updateError } = await supabaseClient
            .from('notification_outbox')
            .update({
              sent_at: new Date().toISOString(),
              twilio_sid: twilioData.sid,
              status: 'sent'
            })
            .eq('id', notification.id)

          if (updateError) {
            console.error('Error updating notification status:', updateError)
          }

          processedResults.push({
            id: notification.id,
            phone: notification.phone_e164,
            status: 'sent',
            twilio_sid: twilioData.sid,
            message_length: finalMessage.length
          })

        } else {
          // Mark as failed in database
          const { error: updateError } = await supabaseClient
            .from('notification_outbox')
            .update({
              status: 'failed',
              error_message: twilioData.message || 'Unknown Twilio error'
            })
            .eq('id', notification.id)

          if (updateError) {
            console.error('Error updating notification status:', updateError)
          }

          processedResults.push({
            id: notification.id,
            phone: notification.phone_e164,
            status: 'failed',
            error: twilioData.message || 'Unknown error'
          })
        }

      } catch (notificationError) {
        console.error(`Error processing notification ${notification.id}:`, notificationError)
        
        // Mark as failed
        await supabaseClient
          .from('notification_outbox')
          .update({
            status: 'failed',
            error_message: notificationError.message
          })
          .eq('id', notification.id)

        processedResults.push({
          id: notification.id,
          phone: notification.phone_e164,
          status: 'error',
          error: notificationError.message
        })
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Return results
    return new Response(
      JSON.stringify({
        message: 'SMS processing completed',
        processed: processedResults.length,
        results: processedResults,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})