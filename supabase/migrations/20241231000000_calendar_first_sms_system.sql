-- Calendar-First Aftermarket Tracker - SMS System & Stock-First Enhancements
-- Schema Analysis: Existing schema has vehicles (stock_number), jobs, vendors, communications tables
-- Integration Type: Addition - Adding SMS outbox system and stock-first search enhancements
-- Dependencies: vehicles, jobs, vendors, user_profiles tables

-- 1. Create notification outbox table for Twilio SMS queue
CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164 TEXT NOT NULL,
    message_template TEXT NOT NULL,
    variables JSONB,
    not_before TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    twilio_sid TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create vendor hours table for capacity management
CREATE TABLE IF NOT EXISTS public.vendor_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity_per_slot INTEGER DEFAULT 1,
    slot_duration_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create SMS opt-outs table
CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
    phone_e164 TEXT PRIMARY KEY,
    opted_out_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

-- 4. Stock-first indexes for performance (critical for stock-first UX)
CREATE INDEX IF NOT EXISTS idx_vehicles_stock_exact ON public.vehicles(stock_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_stock_lower ON public.vehicles((lower(stock_number)));
CREATE INDEX IF NOT EXISTS idx_vehicles_owner_search ON public.vehicles(owner_name, owner_phone, owner_email);

-- 5. Notification outbox indexes
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending ON public.notification_outbox(not_before) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_outbox_phone ON public.notification_outbox(phone_e164);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON public.notification_outbox(status);

-- 6. Vendor hours indexes
CREATE INDEX IF NOT EXISTS idx_vendor_hours_vendor_day ON public.vendor_hours(vendor_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_vendor_hours_active ON public.vendor_hours(is_active) WHERE is_active = true;

-- 7. Enable RLS on new tables
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies

-- Pattern 2: Simple user ownership for vendor hours (vendors manage their own hours)
CREATE POLICY "vendors_manage_own_hours"
ON public.vendor_hours
FOR ALL
TO authenticated
USING (
    vendor_id IN (
        SELECT v.id FROM public.vendors v 
        JOIN public.user_profiles up ON v.created_by = up.id 
        WHERE up.id = auth.uid()
    )
)
WITH CHECK (
    vendor_id IN (
        SELECT v.id FROM public.vendors v 
        JOIN public.user_profiles up ON v.created_by = up.id 
        WHERE up.id = auth.uid()
    )
);

-- Admin access to notification outbox
CREATE POLICY "admin_manage_notification_outbox"
ON public.notification_outbox
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('admin', 'manager')
    )
);

-- SMS opt-outs are publicly readable but admin-manageable
CREATE POLICY "public_read_sms_opt_outs"
ON public.sms_opt_outs
FOR SELECT
TO public
USING (true);

CREATE POLICY "admin_manage_sms_opt_outs"
ON public.sms_opt_outs
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('admin', 'manager')
    )
);

-- 9. Functions for SMS automation

-- Function to enqueue SMS notifications
CREATE OR REPLACE FUNCTION public.enqueue_sms_notification(
    recipient_phone TEXT,
    template_message TEXT,
    template_vars JSONB DEFAULT NULL,
    delay_minutes INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notification_id UUID;
    send_time TIMESTAMPTZ;
BEGIN
    -- Calculate send time
    send_time := CURRENT_TIMESTAMP + (delay_minutes || ' minutes')::INTERVAL;
    
    -- Insert notification into outbox
    INSERT INTO public.notification_outbox (
        phone_e164,
        message_template,
        variables,
        not_before
    ) VALUES (
        recipient_phone,
        template_message,
        template_vars,
        send_time
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$;

-- Function to get vendor availability (for calendar scheduling)
CREATE OR REPLACE FUNCTION public.get_vendor_availability(
    vendor_uuid UUID,
    check_date DATE,
    start_time TIME,
    duration_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.vendor_hours vh
    WHERE vh.vendor_id = vendor_uuid
    AND vh.day_of_week = EXTRACT(dow FROM check_date)::INTEGER
    AND vh.is_active = true
    AND start_time >= vh.start_time
    AND (start_time + (duration_minutes || ' minutes')::INTERVAL)::TIME <= vh.end_time
);
$$;

-- 10. Sample SMS templates and vendor hours data
DO $$
DECLARE
    vendor_1_id UUID;
    vendor_2_id UUID;
BEGIN
    -- Get existing vendor IDs
    SELECT id INTO vendor_1_id FROM public.vendors LIMIT 1;
    
    -- Insert sample vendor hours (if vendors exist)
    IF vendor_1_id IS NOT NULL THEN
        -- Monday-Friday 8 AM to 6 PM for first vendor
        INSERT INTO public.vendor_hours (vendor_id, day_of_week, start_time, end_time, capacity_per_slot)
        SELECT vendor_1_id, generate_series(1, 5), '08:00'::TIME, '18:00'::TIME, 2
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Sample SMS templates in outbox (for reference)
    INSERT INTO public.notification_outbox (
        phone_e164,
        message_template,
        variables,
        status
    ) VALUES
        ('+15551234567', 
         'Stock {STOCK} service confirmed for {DATE}. Reply YES to confirm or CALL {PHONE}',
         '{"STOCK": "P12345", "DATE": "Dec 31", "PHONE": "555-SHOP"}'::JSONB,
         'sent'),
        ('+15551234567',
         'Stock {STOCK} service complete! Total: ${AMOUNT}. Ready for pickup. Call {PHONE}',
         '{"STOCK": "P12345", "AMOUNT": "150.00", "PHONE": "555-SHOP"}'::JSONB,
         'sent')
    ON CONFLICT DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Sample data insertion failed: %', SQLERRM;
END $$;

-- 11. Update existing jobs table to ensure proper stock number relationship
-- Add computed column for easier stock-first searches
CREATE INDEX IF NOT EXISTS idx_jobs_vehicle_stock ON public.jobs(vehicle_id) 
INCLUDE (title, job_status, scheduled_start_time);

-- 12. Trigger to auto-enqueue SMS on job status changes
CREATE OR REPLACE FUNCTION public.auto_enqueue_status_sms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    vehicle_phone TEXT;
    stock_num TEXT;
    template_msg TEXT;
    sms_vars JSONB;
BEGIN
    -- Get vehicle phone and stock number
    SELECT v.owner_phone, v.stock_number 
    INTO vehicle_phone, stock_num
    FROM public.vehicles v 
    WHERE v.id = NEW.vehicle_id;
    
    -- Skip if no phone number
    IF vehicle_phone IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Check if customer opted out
    IF EXISTS (SELECT 1 FROM public.sms_opt_outs WHERE phone_e164 = vehicle_phone) THEN
        RETURN NEW;
    END IF;
    
    -- Determine message template based on status change
    IF OLD.job_status != NEW.job_status THEN
        CASE NEW.job_status
            WHEN 'scheduled' THEN
                template_msg := 'Stock {STOCK} appointment confirmed for {DATE} at {TIME}. Reply YES to confirm.';
            WHEN 'in_progress' THEN
                template_msg := 'Stock {STOCK} service started. Estimated completion: {ETA}.';
            WHEN 'completed' THEN
                template_msg := 'Stock {STOCK} service complete! Ready for pickup. Call {PHONE} for details.';
            WHEN 'cancelled' THEN
                template_msg := 'Stock {STOCK} appointment cancelled. Call {PHONE} to reschedule.';
            ELSE
                RETURN NEW; -- No SMS for other status changes
        END CASE;
        
        -- Build variables
        sms_vars := jsonb_build_object(
            'STOCK', COALESCE(stock_num, 'N/A'),
            'DATE', to_char(NEW.scheduled_start_time AT TIME ZONE 'America/New_York', 'Mon DD'),
            'TIME', to_char(NEW.scheduled_start_time AT TIME ZONE 'America/New_York', 'HH12:MI AM'),
            'ETA', to_char((NEW.scheduled_end_time) AT TIME ZONE 'America/New_York', 'HH12:MI AM'),
            'PHONE', '555-SHOP'
        );
        
        -- Enqueue SMS
        PERFORM public.enqueue_sms_notification(
            vehicle_phone,
            template_msg,
            sms_vars
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for auto SMS on job status changes
DROP TRIGGER IF EXISTS trigger_auto_sms_on_job_status ON public.jobs;
CREATE TRIGGER trigger_auto_sms_on_job_status
    AFTER UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_enqueue_status_sms();

-- 13. Comments for documentation
COMMENT ON TABLE public.notification_outbox IS 'SMS outbox queue for Twilio processing via edge functions';
COMMENT ON TABLE public.vendor_hours IS 'Vendor availability and capacity management for calendar scheduling';
COMMENT ON TABLE public.sms_opt_outs IS 'Phone numbers that have opted out of SMS notifications';
COMMENT ON FUNCTION public.enqueue_sms_notification IS 'Queue SMS notifications for processing by edge functions';
COMMENT ON FUNCTION public.get_vendor_availability IS 'Check if vendor is available for a specific time slot';