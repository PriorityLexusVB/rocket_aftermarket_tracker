-- Location: supabase/migrations/20250114213328_add_service_appointments_module.sql
-- Schema Analysis: Existing comprehensive automotive aftermarket system
-- Integration Type: Addition - Service Appointments Module
-- Dependencies: user_profiles, vehicles, vendors, jobs tables

-- =============================================================================
-- SERVICE APPOINTMENTS MODULE
-- Extends existing system with appointment scheduling functionality
-- =============================================================================

-- 1. Custom Types for Service Appointments
CREATE TYPE public.appointment_status AS ENUM (
    'scheduled', 
    'confirmed', 
    'in_progress', 
    'completed', 
    'cancelled', 
    'no_show'
);

CREATE TYPE public.appointment_type AS ENUM (
    'inspection', 
    'maintenance', 
    'repair', 
    'installation', 
    'warranty_work',
    'consultation'
);

CREATE TYPE public.reminder_type AS ENUM (
    'email', 
    'sms', 
    'phone_call', 
    'in_app'
);

-- 2. Core Tables for Service Appointments Module

-- Service appointments table - extends existing job system
CREATE TABLE public.service_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_number TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    assigned_technician_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    related_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    
    -- Appointment details
    appointment_type public.appointment_type NOT NULL DEFAULT 'maintenance'::public.appointment_type,
    status public.appointment_status NOT NULL DEFAULT 'scheduled'::public.appointment_status,
    priority public.job_priority NOT NULL DEFAULT 'medium'::public.job_priority,
    
    -- Scheduling information
    scheduled_date DATE NOT NULL,
    scheduled_start_time TIME NOT NULL,
    scheduled_end_time TIME NOT NULL,
    estimated_duration_minutes INTEGER DEFAULT 60,
    
    -- Service details
    service_description TEXT NOT NULL,
    special_instructions TEXT,
    customer_notes TEXT,
    internal_notes TEXT,
    
    -- Contact and confirmation
    customer_phone TEXT,
    customer_email TEXT,
    confirmation_sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    
    -- Completion tracking
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    completion_notes TEXT,
    
    -- System fields
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_appointment_time_range 
        CHECK (scheduled_end_time > scheduled_start_time),
    CONSTRAINT valid_estimated_duration 
        CHECK (estimated_duration_minutes > 0 AND estimated_duration_minutes <= 480),
    CONSTRAINT valid_completion_times
        CHECK (actual_end_time IS NULL OR actual_start_time IS NOT NULL)
);

-- Appointment reminders table
CREATE TABLE public.appointment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES public.service_appointments(id) ON DELETE CASCADE,
    reminder_type public.reminder_type NOT NULL,
    
    -- Reminder scheduling
    days_before_appointment INTEGER NOT NULL DEFAULT 1,
    hours_before_appointment INTEGER NOT NULL DEFAULT 2,
    send_at_datetime TIMESTAMPTZ NOT NULL,
    
    -- Status tracking
    sent_at TIMESTAMPTZ,
    delivery_status TEXT DEFAULT 'pending',
    failure_reason TEXT,
    
    -- Content
    reminder_subject TEXT,
    reminder_message TEXT,
    
    -- System fields
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_reminder_timing 
        CHECK (days_before_appointment >= 0 AND hours_before_appointment >= 0)
);

-- Appointment availability slots table
CREATE TABLE public.appointment_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    technician_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Slot timing
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Availability status
    is_available BOOLEAN DEFAULT true,
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern TEXT, -- JSON pattern for recurring slots
    
    -- Slot details
    max_appointments INTEGER DEFAULT 1,
    appointment_type_restrictions TEXT[], -- Array of allowed appointment types
    
    -- System fields
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_slot_time_range 
        CHECK (end_time > start_time),
    CONSTRAINT valid_max_appointments 
        CHECK (max_appointments > 0)
);

-- 3. Essential Indexes for Performance

-- Service appointments indexes
CREATE INDEX idx_service_appointments_customer_id ON public.service_appointments(customer_id);
CREATE INDEX idx_service_appointments_vehicle_id ON public.service_appointments(vehicle_id);
CREATE INDEX idx_service_appointments_vendor_id ON public.service_appointments(vendor_id);
CREATE INDEX idx_service_appointments_technician_id ON public.service_appointments(assigned_technician_id);
CREATE INDEX idx_service_appointments_scheduled_date ON public.service_appointments(scheduled_date);
CREATE INDEX idx_service_appointments_status ON public.service_appointments(status);
CREATE INDEX idx_service_appointments_number ON public.service_appointments(appointment_number);

-- Appointment reminders indexes
CREATE INDEX idx_appointment_reminders_appointment_id ON public.appointment_reminders(appointment_id);
CREATE INDEX idx_appointment_reminders_send_at ON public.appointment_reminders(send_at_datetime);
CREATE INDEX idx_appointment_reminders_status ON public.appointment_reminders(delivery_status);

-- Appointment slots indexes
CREATE INDEX idx_appointment_slots_vendor_id ON public.appointment_slots(vendor_id);
CREATE INDEX idx_appointment_slots_technician_id ON public.appointment_slots(technician_id);
CREATE INDEX idx_appointment_slots_date ON public.appointment_slots(slot_date);
CREATE INDEX idx_appointment_slots_availability ON public.appointment_slots(is_available);

-- Composite indexes for common queries
CREATE INDEX idx_appointments_vendor_date ON public.service_appointments(vendor_id, scheduled_date);
CREATE INDEX idx_appointments_customer_status ON public.service_appointments(customer_id, status);

-- 4. Functions for Business Logic (MUST BE BEFORE RLS POLICIES)

-- Generate appointment number function
CREATE OR REPLACE FUNCTION public.generate_appointment_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_number TEXT;
    year_suffix TEXT;
BEGIN
    year_suffix := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    SELECT 'APT-' || year_suffix || '-' || LPAD(
        COALESCE(
            MAX(
                CAST(
                    SPLIT_PART(
                        SPLIT_PART(appointment_number, 'APT-' || year_suffix || '-', 2), 
                        '-', 1
                    ) AS INTEGER
                )
            ), 0
        ) + 1, 6, '0'
    )
    INTO new_number
    FROM public.service_appointments
    WHERE appointment_number LIKE 'APT-' || year_suffix || '-%';
    
    RETURN new_number;
END;
$$;

-- Check appointment slot availability function
CREATE OR REPLACE FUNCTION public.is_appointment_slot_available(
    vendor_uuid UUID,
    appointment_date DATE,
    start_time_param TIME,
    end_time_param TIME,
    exclude_appointment_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT NOT EXISTS (
    SELECT 1 FROM public.service_appointments sa
    WHERE sa.vendor_id = vendor_uuid
    AND sa.scheduled_date = appointment_date
    AND sa.status NOT IN ('cancelled', 'no_show')
    AND (exclude_appointment_id IS NULL OR sa.id != exclude_appointment_id)
    AND (
        (sa.scheduled_start_time < end_time_param AND sa.scheduled_end_time > start_time_param)
    )
);
$$;

-- Get vendor availability function
CREATE OR REPLACE FUNCTION public.get_vendor_appointment_availability(
    vendor_uuid UUID,
    start_date DATE,
    end_date DATE
)
RETURNS TABLE(
    available_date DATE,
    available_slots INTEGER,
    booked_appointments INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH date_series AS (
    SELECT generate_series(start_date, end_date, '1 day'::interval)::date as date_val
),
daily_bookings AS (
    SELECT 
        scheduled_date,
        COUNT(*) as booked_count
    FROM public.service_appointments
    WHERE vendor_id = vendor_uuid
    AND scheduled_date BETWEEN start_date AND end_date
    AND status NOT IN ('cancelled', 'no_show')
    GROUP BY scheduled_date
),
daily_slots AS (
    SELECT 
        slot_date,
        SUM(max_appointments) as total_slots
    FROM public.appointment_slots
    WHERE vendor_id = vendor_uuid
    AND slot_date BETWEEN start_date AND end_date
    AND is_available = true
    GROUP BY slot_date
)
SELECT 
    ds.date_val,
    COALESCE(dsl.total_slots, 8) as available_slots, -- Default 8 slots per day
    COALESCE(db.booked_count, 0) as booked_appointments
FROM date_series ds
LEFT JOIN daily_bookings db ON ds.date_val = db.scheduled_date
LEFT JOIN daily_slots dsl ON ds.date_val = dsl.slot_date
ORDER BY ds.date_val;
$$;

-- 5. Enable Row Level Security

ALTER TABLE public.service_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies Using Established Patterns

-- Service appointments policies (Pattern 2: Simple User Ownership + Pattern 4: Public Read for vendors)
CREATE POLICY "customers_manage_own_appointments"
ON public.service_appointments
FOR ALL
TO authenticated
USING (customer_id = auth.uid())
WITH CHECK (customer_id = auth.uid());

CREATE POLICY "vendors_manage_assigned_appointments"
ON public.service_appointments
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

CREATE POLICY "technicians_view_assigned_appointments"
ON public.service_appointments
FOR SELECT
TO authenticated
USING (assigned_technician_id = auth.uid());

-- Appointment reminders policies (Pattern 2: Simple ownership via appointment)
CREATE POLICY "users_manage_appointment_reminders"
ON public.appointment_reminders
FOR ALL
TO authenticated
USING (
    appointment_id IN (
        SELECT sa.id FROM public.service_appointments sa
        WHERE sa.customer_id = auth.uid() 
        OR sa.assigned_technician_id = auth.uid()
        OR sa.vendor_id IN (
            SELECT v.id FROM public.vendors v
            JOIN public.user_profiles up ON v.created_by = up.id
            WHERE up.id = auth.uid()
        )
    )
);

-- Appointment slots policies (Pattern 2: Simple User Ownership)
CREATE POLICY "users_manage_own_appointment_slots"
ON public.appointment_slots
FOR ALL
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "public_can_view_available_slots"
ON public.appointment_slots
FOR SELECT
TO authenticated
USING (is_available = true);

-- 7. Triggers for Automatic Updates

-- Auto-generate appointment number trigger
CREATE OR REPLACE FUNCTION public.set_appointment_number()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.appointment_number IS NULL THEN
        NEW.appointment_number := public.generate_appointment_number();
    END IF;
    
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_appointment_number_trigger
    BEFORE INSERT ON public.service_appointments
    FOR EACH ROW EXECUTE FUNCTION public.set_appointment_number();

-- Auto-update timestamp trigger
CREATE TRIGGER update_appointment_timestamp_trigger
    BEFORE UPDATE ON public.service_appointments
    FOR EACH ROW EXECUTE FUNCTION public.set_appointment_number();

-- 8. Mock Data for Service Appointments Module

DO $$
DECLARE
    existing_customer_id UUID;
    existing_vehicle_id UUID;
    existing_vendor_id UUID;
    existing_technician_id UUID;
    appointment1_id UUID := gen_random_uuid();
    appointment2_id UUID := gen_random_uuid();
    appointment3_id UUID := gen_random_uuid();
BEGIN
    -- Get existing user and vendor IDs (don't create new ones)
    SELECT id INTO existing_customer_id 
    FROM public.user_profiles 
    WHERE role = 'staff' 
    LIMIT 1;
    
    SELECT id INTO existing_vehicle_id 
    FROM public.vehicles 
    LIMIT 1;
    
    SELECT id INTO existing_vendor_id 
    FROM public.vendors 
    LIMIT 1;
    
    SELECT id INTO existing_technician_id 
    FROM public.user_profiles 
    WHERE role = 'vendor' 
    LIMIT 1;
    
    -- Only create mock data if we have existing references
    IF existing_customer_id IS NOT NULL AND existing_vehicle_id IS NOT NULL THEN
        
        -- Create service appointments using existing relationships
        INSERT INTO public.service_appointments (
            id, customer_id, vehicle_id, vendor_id, assigned_technician_id,
            appointment_type, status, priority,
            scheduled_date, scheduled_start_time, scheduled_end_time,
            service_description, special_instructions,
            customer_phone, customer_email,
            created_by
        ) VALUES
            (appointment1_id, existing_customer_id, existing_vehicle_id, existing_vendor_id, existing_technician_id,
             'maintenance'::public.appointment_type, 'scheduled'::public.appointment_status, 'medium'::public.job_priority,
             CURRENT_DATE + INTERVAL '3 days', '09:00:00', '11:00:00',
             'Regular maintenance service and oil change',
             'Customer prefers synthetic oil. Vehicle has 45,000 miles.',
             '555-0123', 'customer@example.com',
             existing_customer_id),
             
            (appointment2_id, existing_customer_id, existing_vehicle_id, existing_vendor_id, existing_technician_id,
             'repair'::public.appointment_type, 'confirmed'::public.appointment_status, 'high'::public.job_priority,
             CURRENT_DATE + INTERVAL '1 day', '14:00:00', '16:00:00',
             'Brake system inspection and potential pad replacement',
             'Customer reports squeaking noise when braking.',
             '555-0456', 'customer2@example.com',
             existing_customer_id),
             
            (appointment3_id, existing_customer_id, existing_vehicle_id, existing_vendor_id, existing_technician_id,
             'installation'::public.appointment_type, 'completed'::public.appointment_status, 'low'::public.job_priority,
             CURRENT_DATE - INTERVAL '2 days', '10:00:00', '12:00:00',
             'Aftermarket stereo system installation',
             'Customer provided stereo unit. Wire harness needed.',
             '555-0789', 'customer3@example.com',
             existing_customer_id);
        
        -- Create appointment reminders for scheduled appointments
        INSERT INTO public.appointment_reminders (
            appointment_id, reminder_type, days_before_appointment, hours_before_appointment,
            send_at_datetime, reminder_subject, reminder_message
        ) VALUES
            (appointment1_id, 'email'::public.reminder_type, 1, 2,
             (CURRENT_DATE + INTERVAL '3 days' - INTERVAL '1 day' - INTERVAL '2 hours'),
             'Appointment Reminder - Maintenance Service',
             'This is a reminder that you have a scheduled maintenance appointment tomorrow at 9:00 AM.'),
             
            (appointment2_id, 'sms'::public.reminder_type, 0, 1,
             (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '1 hour'),
             'Appointment Today',
             'Reminder: Your brake inspection appointment is today at 2:00 PM. Please arrive 10 minutes early.');
        
        -- Create some appointment slots for vendors
        IF existing_vendor_id IS NOT NULL AND existing_technician_id IS NOT NULL THEN
            INSERT INTO public.appointment_slots (
                vendor_id, technician_id, slot_date, start_time, end_time,
                is_available, max_appointments, created_by
            ) VALUES
                (existing_vendor_id, existing_technician_id, CURRENT_DATE + INTERVAL '5 days', '08:00:00', '17:00:00',
                 true, 6, existing_technician_id),
                 
                (existing_vendor_id, existing_technician_id, CURRENT_DATE + INTERVAL '6 days', '08:00:00', '17:00:00',
                 true, 8, existing_technician_id),
                 
                (existing_vendor_id, existing_technician_id, CURRENT_DATE + INTERVAL '7 days', '09:00:00', '15:00:00',
                 true, 4, existing_technician_id);
        END IF;
        
        RAISE NOTICE 'Service appointments mock data created successfully';
    ELSE
        RAISE NOTICE 'Insufficient existing data. Please ensure user_profiles and vehicles exist first.';
    END IF;
    
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key constraint error in appointments mock data: %', SQLERRM;
    WHEN unique_violation THEN
        RAISE NOTICE 'Unique constraint error in appointments mock data: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error creating appointments mock data: %', SQLERRM;
END $$;

-- =============================================================================
-- END SERVICE APPOINTMENTS MODULE
-- =============================================================================