-- Location: supabase/migrations/20250922170950_automotive_aftermarket_system.sql
-- Schema Analysis: Existing schema has chat functionality, unrelated to automotive management
-- Integration Type: Complete new automotive management system
-- Dependencies: Will replace existing unrelated schema

-- 1. DROP existing policies that depend on functions FIRST
DROP POLICY IF EXISTS "parents_access_own_session_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;

-- 2. DROP existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.can_access_chat_message(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_sample_rows() CASCADE;

-- 3. DROP existing tables and types (safe to remove chat system)
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_sessions CASCADE; 
DROP TABLE IF EXISTS public.child_profiles CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TYPE IF EXISTS public.profile_status CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- 4. Create Automotive Management System Types
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'staff');
CREATE TYPE public.vehicle_status AS ENUM ('active', 'maintenance', 'retired', 'sold');
CREATE TYPE public.job_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.job_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'refunded');
CREATE TYPE public.communication_type AS ENUM ('sms', 'email', 'phone_call', 'note');

-- 5. Core User Management Table
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role public.user_role DEFAULT 'staff'::public.user_role,
    phone TEXT,
    department TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Vehicle Management Tables
CREATE TABLE public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vin TEXT UNIQUE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    license_plate TEXT,
    color TEXT,
    mileage INTEGER,
    vehicle_status public.vehicle_status DEFAULT 'active'::public.vehicle_status,
    owner_name TEXT,
    owner_phone TEXT,
    owner_email TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Vendor Management Tables
CREATE TABLE public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    specialty TEXT,
    rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Parts/Products Management
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    part_number TEXT UNIQUE,
    description TEXT,
    category TEXT,
    brand TEXT,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity_in_stock INTEGER DEFAULT 0,
    minimum_stock_level INTEGER DEFAULT 0,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Job Management Tables
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_number TEXT UNIQUE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    job_status public.job_status DEFAULT 'pending'::public.job_status,
    priority public.job_priority DEFAULT 'medium'::public.job_priority,
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    estimated_hours INTEGER,
    actual_hours INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Job Parts Junction Table
CREATE TABLE public.job_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_used INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity_used * unit_price) STORED,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Sales Transactions
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number TEXT UNIQUE NOT NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method TEXT,
    transaction_status public.transaction_status DEFAULT 'pending'::public.transaction_status,
    processed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Communication Log
CREATE TABLE public.communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    communication_type public.communication_type NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    sent_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_successful BOOLEAN DEFAULT true,
    error_message TEXT
);

-- 13. Activity History
CREATE TABLE public.activity_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'vehicle', 'job', 'transaction', etc.
    entity_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed', etc.
    description TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. Essential Indexes
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_vehicles_status ON public.vehicles(vehicle_status);
CREATE INDEX idx_vehicles_created_by ON public.vehicles(created_by);
CREATE INDEX idx_vehicles_vin ON public.vehicles(vin);
CREATE INDEX idx_vendors_active ON public.vendors(is_active);
CREATE INDEX idx_products_part_number ON public.products(part_number);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_vendor_id ON public.products(vendor_id);
CREATE INDEX idx_jobs_status ON public.jobs(job_status);
CREATE INDEX idx_jobs_vehicle_id ON public.jobs(vehicle_id);
CREATE INDEX idx_jobs_assigned_to ON public.jobs(assigned_to);
CREATE INDEX idx_jobs_job_number ON public.jobs(job_number);
CREATE INDEX idx_transactions_status ON public.transactions(transaction_status);
CREATE INDEX idx_transactions_job_id ON public.transactions(job_id);
CREATE INDEX idx_communications_vehicle_id ON public.communications(vehicle_id);
CREATE INDEX idx_activity_history_entity ON public.activity_history(entity_type, entity_id);

-- 15. Create sequences for auto-generated numbers
CREATE SEQUENCE IF NOT EXISTS job_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS transaction_number_seq START 1001;

-- 16. Utility Functions
CREATE OR REPLACE FUNCTION public.generate_job_number()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
AS $$
SELECT 'JOB-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('job_number_seq')::TEXT, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.generate_transaction_number()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
AS $$
SELECT 'TXN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('transaction_number_seq')::TEXT, 4, '0');
$$;

-- Function for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')::public.user_role
  );  
  RETURN NEW;
END;
$$;

-- Function to update activity history
CREATE OR REPLACE FUNCTION public.log_activity(
    p_entity_type TEXT,
    p_entity_id UUID,
    p_action TEXT,
    p_description TEXT,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
INSERT INTO public.activity_history (entity_type, entity_id, action, description, old_values, new_values, performed_by)
VALUES (p_entity_type, p_entity_id, p_action, p_description, p_old_values, p_new_values, auth.uid());
$$;

-- 17. Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;

-- 18. Role-based access utility functions
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT COALESCE(
    (SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid()),
    'staff'
);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT public.get_user_role() IN ('admin', 'manager');
$$;

-- 19. RLS Policies
-- User profiles: Users can manage their own profiles
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Vehicles: Staff can view all, managers+ can manage
CREATE POLICY "staff_can_view_vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "managers_manage_vehicles"
ON public.vehicles
FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Vendors: Similar pattern
CREATE POLICY "staff_can_view_vendors"
ON public.vendors
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "managers_manage_vendors"
ON public.vendors
FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Products: Similar pattern
CREATE POLICY "staff_can_view_products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "managers_manage_products"
ON public.products
FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Jobs: Staff can view all, manage assigned ones
CREATE POLICY "staff_can_view_jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "staff_manage_assigned_jobs"
ON public.jobs
FOR UPDATE
TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "managers_manage_jobs"
ON public.jobs
FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Job Parts: Follow job permissions
CREATE POLICY "users_can_view_job_parts"
ON public.job_parts
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.jobs j 
        WHERE j.id = job_id
    )
);

CREATE POLICY "managers_manage_job_parts"
ON public.job_parts
FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Transactions: Staff can view, managers can manage
CREATE POLICY "staff_can_view_transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "managers_manage_transactions"
ON public.transactions
FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Communications: View all, manage based on role
CREATE POLICY "users_can_view_communications"
ON public.communications
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "users_can_create_communications"
ON public.communications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Activity History: View all, system manages creation
CREATE POLICY "users_can_view_activity_history"
ON public.activity_history
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "system_manages_activity_history"
ON public.activity_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 20. Triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 21. Complete Mock Data for Automotive System
DO $$
DECLARE
    admin_uuid UUID := gen_random_uuid();
    manager_uuid UUID := gen_random_uuid();  
    staff_uuid UUID := gen_random_uuid();
    vehicle1_id UUID := gen_random_uuid();
    vehicle2_id UUID := gen_random_uuid();
    vendor1_id UUID := gen_random_uuid();
    product1_id UUID := gen_random_uuid();
    job1_id UUID := gen_random_uuid();
    transaction1_id UUID := gen_random_uuid();
BEGIN
    -- Create auth users with required fields
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'admin@rocketaftermarket.com', crypt('Admin123!', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "System Administrator", "role": "admin"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (manager_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'manager@rocketaftermarket.com', crypt('Manager123!', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "Operations Manager", "role": "manager"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (staff_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'staff@rocketaftermarket.com', crypt('Staff123!', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "Workshop Staff", "role": "staff"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null);

    -- Create sample vehicles
    INSERT INTO public.vehicles (id, vin, make, model, year, license_plate, color, mileage, owner_name, owner_phone, owner_email, created_by) VALUES
        (vehicle1_id, '1HGBH41JXMN109186', 'Honda', 'Civic', 2018, 'ABC-123', 'Blue', 45000, 'John Smith', '555-0123', 'john.smith@email.com', manager_uuid),
        (vehicle2_id, '2T3ZFREV4DW123456', 'Toyota', 'Highlander', 2020, 'XYZ-789', 'White', 32000, 'Sarah Johnson', '555-0456', 'sarah.j@email.com', manager_uuid);

    -- Create sample vendor
    INSERT INTO public.vendors (id, name, contact_person, email, phone, specialty, rating, created_by) VALUES
        (vendor1_id, 'Premium Auto Parts', 'Mike Wilson', 'mike@premiumauto.com', '555-PARTS', 'Engine Components', 4.5, manager_uuid);

    -- Create sample product
    INSERT INTO public.products (id, name, part_number, description, category, brand, unit_price, quantity_in_stock, vendor_id, created_by) VALUES
        (product1_id, 'Brake Pads Set', 'BP-001-HONDA', 'High performance ceramic brake pads for Honda Civic', 'Braking System', 'Premium', 89.99, 25, vendor1_id, manager_uuid);

    -- Create sample job
    INSERT INTO public.jobs (id, job_number, vehicle_id, assigned_to, title, description, job_status, priority, estimated_cost, estimated_hours, created_by) VALUES
        (job1_id, 'JOB-2025-001001', vehicle1_id, staff_uuid, 'Brake Pad Replacement', 'Replace front brake pads and inspect brake system', 'in_progress', 'medium', 150.00, 2, manager_uuid);

    -- Create sample job parts
    INSERT INTO public.job_parts (job_id, product_id, quantity_used, unit_price) VALUES
        (job1_id, product1_id, 1, 89.99);

    -- Create sample transaction
    INSERT INTO public.transactions (id, transaction_number, job_id, vehicle_id, customer_name, customer_email, customer_phone, subtotal, tax_amount, total_amount, processed_by) VALUES
        (transaction1_id, 'TXN-20250922-1001', job1_id, vehicle1_id, 'John Smith', 'john.smith@email.com', '555-0123', 150.00, 12.00, 162.00, manager_uuid);

    -- Create sample communication
    INSERT INTO public.communications (vehicle_id, job_id, communication_type, recipient, subject, message, sent_by) VALUES
        (vehicle1_id, job1_id, 'sms', '555-0123', 'Service Update', 'Your Honda Civic brake service is in progress. Expected completion: 2 hours.', staff_uuid);

    -- Create sample activity
    INSERT INTO public.activity_history (entity_type, entity_id, action, description, performed_by) VALUES
        ('job', job1_id, 'status_changed', 'Job status changed from pending to in_progress', staff_uuid);

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key error: %', SQLERRM;
    WHEN unique_violation THEN
        RAISE NOTICE 'Unique constraint error: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error: %', SQLERRM;
END $$;