-- Location: supabase/migrations/20250114214500_undo_service_appointments_module.sql
-- Purpose: Undo the Service Appointments Module from 20250114213328_add_service_appointments_module.sql
-- Action: Complete rollback of service appointments functionality

-- =============================================================================
-- UNDO SERVICE APPOINTMENTS MODULE
-- Removes all service appointments functionality added in previous migration
-- =============================================================================

-- 1. Drop Triggers (must be done before dropping functions)
DROP TRIGGER IF EXISTS set_appointment_number_trigger ON public.service_appointments;
DROP TRIGGER IF EXISTS update_appointment_timestamp_trigger ON public.service_appointments;

-- 2. Drop Trigger Functions
DROP FUNCTION IF EXISTS public.set_appointment_number();

-- 3. Drop RLS Policies
DROP POLICY IF EXISTS "customers_manage_own_appointments" ON public.service_appointments;
DROP POLICY IF EXISTS "vendors_manage_assigned_appointments" ON public.service_appointments;
DROP POLICY IF EXISTS "technicians_view_assigned_appointments" ON public.service_appointments;
DROP POLICY IF EXISTS "users_manage_appointment_reminders" ON public.appointment_reminders;
DROP POLICY IF EXISTS "users_manage_own_appointment_slots" ON public.appointment_slots;
DROP POLICY IF EXISTS "public_can_view_available_slots" ON public.appointment_slots;

-- 4. Drop Business Logic Functions
DROP FUNCTION IF EXISTS public.generate_appointment_number();
DROP FUNCTION IF EXISTS public.is_appointment_slot_available(UUID, DATE, TIME, TIME, UUID);
DROP FUNCTION IF EXISTS public.get_vendor_appointment_availability(UUID, DATE, DATE);

-- 5. Drop Indexes (explicit cleanup)
DROP INDEX IF EXISTS public.idx_service_appointments_customer_id;
DROP INDEX IF EXISTS public.idx_service_appointments_vehicle_id;
DROP INDEX IF EXISTS public.idx_service_appointments_vendor_id;
DROP INDEX IF EXISTS public.idx_service_appointments_technician_id;
DROP INDEX IF EXISTS public.idx_service_appointments_scheduled_date;
DROP INDEX IF EXISTS public.idx_service_appointments_status;
DROP INDEX IF EXISTS public.idx_service_appointments_number;

DROP INDEX IF EXISTS public.idx_appointment_reminders_appointment_id;
DROP INDEX IF EXISTS public.idx_appointment_reminders_send_at;
DROP INDEX IF EXISTS public.idx_appointment_reminders_status;

DROP INDEX IF EXISTS public.idx_appointment_slots_vendor_id;
DROP INDEX IF EXISTS public.idx_appointment_slots_technician_id;
DROP INDEX IF EXISTS public.idx_appointment_slots_date;
DROP INDEX IF EXISTS public.idx_appointment_slots_availability;

-- Composite indexes
DROP INDEX IF EXISTS public.idx_appointments_vendor_date;
DROP INDEX IF EXISTS public.idx_appointments_customer_status;

-- 6. Drop Tables (in reverse dependency order to avoid foreign key conflicts)
-- Drop child tables first, then parent tables
DROP TABLE IF EXISTS public.appointment_reminders CASCADE;
DROP TABLE IF EXISTS public.appointment_slots CASCADE;
DROP TABLE IF EXISTS public.service_appointments CASCADE;

-- 7. Drop Custom Types (must be done after tables that use them)
DROP TYPE IF EXISTS public.appointment_status CASCADE;
DROP TYPE IF EXISTS public.appointment_type CASCADE;
DROP TYPE IF EXISTS public.reminder_type CASCADE;

-- 8. Verification Notice
DO $$
BEGIN
    RAISE NOTICE 'Service Appointments Module has been completely removed';
    RAISE NOTICE 'All tables, functions, triggers, policies, indexes, and types have been dropped';
    RAISE NOTICE 'Database has been restored to pre-service-appointments state';
END $$;

-- =============================================================================
-- END UNDO SERVICE APPOINTMENTS MODULE
-- =============================================================================