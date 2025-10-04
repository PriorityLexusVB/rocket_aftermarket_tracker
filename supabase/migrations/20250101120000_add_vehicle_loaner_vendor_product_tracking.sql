-- Location: supabase/migrations/20250101120000_add_vehicle_loaner_vendor_product_tracking.sql
-- Schema Analysis: Existing vehicles, vendors, products, jobs, job_parts tables
-- Integration Type: Enhancement - Adding loaner tracking and initial vendor/product assignment
-- Dependencies: vehicles, vendors, products tables

-- Add needs_loaner field to existing vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN needs_loaner BOOLEAN DEFAULT false;

-- Add primary_vendor_id to vehicles for initial vendor assignment
ALTER TABLE public.vehicles
ADD COLUMN primary_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Create initial vehicle products assignment table
CREATE TABLE public.vehicle_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC,
    is_initial_assignment BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

-- Add indexes for performance
CREATE INDEX idx_vehicles_needs_loaner ON public.vehicles(needs_loaner);
CREATE INDEX idx_vehicles_primary_vendor_id ON public.vehicles(primary_vendor_id);
CREATE INDEX idx_vehicle_products_vehicle_id ON public.vehicle_products(vehicle_id);
CREATE INDEX idx_vehicle_products_product_id ON public.vehicle_products(product_id);

-- Enable RLS for new table
ALTER TABLE public.vehicle_products ENABLE ROW LEVEL SECURITY;

-- RLS policies for vehicle_products using Pattern 2 (Simple User Ownership via created_by)
CREATE POLICY "users_can_view_vehicle_products"
ON public.vehicle_products
FOR SELECT
TO authenticated
USING (true); -- Allow all authenticated users to view

CREATE POLICY "managers_manage_vehicle_products"
ON public.vehicle_products
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.role IN ('admin', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.role IN ('admin', 'manager')
    )
);

-- Mock data for testing - Add some sample vehicle-product assignments
DO $$
DECLARE
    existing_vehicle_id UUID;
    existing_product_id UUID;
    existing_vendor_id UUID;
    existing_user_id UUID;
BEGIN
    -- Get existing IDs (don't create new ones)
    SELECT id INTO existing_vehicle_id FROM public.vehicles LIMIT 1;
    SELECT id INTO existing_product_id FROM public.products LIMIT 1;
    SELECT id INTO existing_vendor_id FROM public.vendors LIMIT 1;
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

    -- Only proceed if we have existing data
    IF existing_vehicle_id IS NOT NULL AND existing_product_id IS NOT NULL THEN
        -- Update existing vehicle with loaner need and vendor assignment
        UPDATE public.vehicles 
        SET needs_loaner = true,
            primary_vendor_id = existing_vendor_id
        WHERE id = existing_vehicle_id;

        -- Add initial product assignment
        INSERT INTO public.vehicle_products (
            vehicle_id, product_id, quantity, unit_price, 
            is_initial_assignment, notes, created_by
        )
        VALUES (
            existing_vehicle_id, existing_product_id, 1, 89.99,
            true, 'Initial aftermarket product assignment', existing_user_id
        );
        
        RAISE NOTICE 'Successfully added loaner tracking and product assignment to existing vehicle';
    ELSE
        RAISE NOTICE 'No existing vehicles or products found. Skipping mock data insertion.';
    END IF;
END $$;