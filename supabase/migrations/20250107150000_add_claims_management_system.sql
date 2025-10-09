-- Location: supabase/migrations/20250107150000_add_claims_management_system.sql
-- Schema Analysis: Existing aftermarket automotive system with vehicles, jobs, products, user_profiles
-- Integration Type: Addition - Adding claims module that references existing schema
-- Dependencies: vehicles, products, user_profiles, communications tables

-- 1. Create claims status enum
CREATE TYPE public.claim_status AS ENUM (
    'submitted',
    'under_review',
    'approved', 
    'denied',
    'resolved'
);

-- 2. Create claims priority enum
CREATE TYPE public.claim_priority AS ENUM (
    'low',
    'medium', 
    'high',
    'urgent'
);

-- 3. Create claims table
CREATE TABLE public.claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    issue_description TEXT NOT NULL,
    preferred_resolution TEXT,
    claim_amount NUMERIC(10,2),
    status public.claim_status DEFAULT 'submitted'::public.claim_status,
    priority public.claim_priority DEFAULT 'medium'::public.claim_priority,
    submitted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create claim attachments table for photo documentation
CREATE TABLE public.claim_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    description TEXT,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create indexes for performance
CREATE INDEX idx_claims_claim_number ON public.claims(claim_number);
CREATE INDEX idx_claims_status ON public.claims(status);
CREATE INDEX idx_claims_vehicle_id ON public.claims(vehicle_id);
CREATE INDEX idx_claims_product_id ON public.claims(product_id);
CREATE INDEX idx_claims_assigned_to ON public.claims(assigned_to);
CREATE INDEX idx_claims_submitted_by ON public.claims(submitted_by);
CREATE INDEX idx_claims_created_at ON public.claims(created_at);
CREATE INDEX idx_claim_attachments_claim_id ON public.claim_attachments(claim_id);

-- 6. Create storage bucket for claim photos (private bucket for sensitive documentation)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'claim-photos',
    'claim-photos',
    false,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
);

-- 7. Create function to generate claim numbers
CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 'CLM-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || 
       LPAD((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER % 10000)::TEXT, 4, '0');
$$;

-- 8. Create function to validate claim status progression
CREATE OR REPLACE FUNCTION public.validate_claim_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Auto-set resolved_at when status changes to resolved
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        NEW.resolved_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- Clear resolved_at if status changes from resolved to something else
    IF NEW.status != 'resolved' AND OLD.status = 'resolved' THEN
        NEW.resolved_at = NULL;
    END IF;
    
    -- Update timestamp
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$;

-- 9. Enable RLS on tables
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_attachments ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies using Pattern 6 (Role-Based Access)

-- Staff can view all claims
CREATE POLICY "staff_can_view_all_claims"
ON public.claims
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid()
    )
);

-- Staff can create claims
CREATE POLICY "staff_can_create_claims"
ON public.claims
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid()
    )
);

-- Managers can manage all claims, staff can update assigned claims
CREATE POLICY "users_can_update_claims"
ON public.claims
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (up.role IN ('admin', 'manager') OR assigned_to = auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (up.role IN ('admin', 'manager') OR assigned_to = auth.uid())
    )
);

-- Staff can view all claim attachments
CREATE POLICY "staff_can_view_claim_attachments"
ON public.claim_attachments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid()
    )
);

-- Staff can upload claim attachments
CREATE POLICY "staff_can_create_claim_attachments"
ON public.claim_attachments
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid()
    )
);

-- Storage policies for claim photos
CREATE POLICY "staff_can_view_claim_photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'claim-photos');

CREATE POLICY "staff_can_upload_claim_photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'claim-photos'
    AND (storage.foldername(name))[1] ~ '^claim-[0-9a-f-]+$'
);

CREATE POLICY "staff_can_delete_claim_photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'claim-photos' AND owner = auth.uid());

-- 11. Create triggers
CREATE TRIGGER validate_claim_status_progression
BEFORE UPDATE ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.validate_claim_status_change();

-- 12. Mock data for testing
DO $$
DECLARE
    vehicle1_id UUID;
    vehicle2_id UUID;
    product1_id UUID;
    product2_id UUID;
    user1_id UUID;
    user2_id UUID;
    claim1_id UUID := gen_random_uuid();
    claim2_id UUID := gen_random_uuid();
    claim3_id UUID := gen_random_uuid();
BEGIN
    -- Get existing data IDs
    SELECT id INTO vehicle1_id FROM public.vehicles LIMIT 1;
    SELECT id INTO vehicle2_id FROM public.vehicles OFFSET 1 LIMIT 1;
    SELECT id INTO product1_id FROM public.products LIMIT 1;
    SELECT id INTO product2_id FROM public.products OFFSET 1 LIMIT 1;
    SELECT id INTO user1_id FROM public.user_profiles LIMIT 1;
    SELECT id INTO user2_id FROM public.user_profiles OFFSET 1 LIMIT 1;

    -- Insert sample claims
    INSERT INTO public.claims (
        id, claim_number, customer_name, customer_email, customer_phone,
        vehicle_id, product_id, issue_description, preferred_resolution,
        claim_amount, status, priority, submitted_by, assigned_to
    ) VALUES
    (claim1_id, 'CLM-20250107-0001', 'John Smith', 'john.smith@email.com', '555-0123',
     vehicle1_id, product1_id, 'Paint protection film is peeling off after 6 months. Expected it to last much longer based on warranty terms.',
     'Replacement or full refund', 499.00, 'under_review', 'high', user1_id, user2_id),
    
    (claim2_id, 'CLM-20250107-0002', 'Sarah Johnson', 'sarah.j@email.com', '555-0456',
     vehicle2_id, product2_id, 'Ceramic coating appears to be failing. Water is not beading properly and there are visible water spots.',
     'Warranty replacement', 549.00, 'submitted', 'medium', user1_id, NULL),
    
    (claim3_id, 'CLM-20250107-0003', 'Mike Wilson', 'mike.wilson@email.com', '555-0789',
     vehicle1_id, product1_id, 'Product was installed incorrectly causing damage to vehicle paint. Seeking compensation for repair costs.',
     'Payment for paint repair', 1200.00, 'approved', 'urgent', user2_id, user1_id);

    -- Insert sample attachments
    INSERT INTO public.claim_attachments (
        claim_id, file_name, file_path, file_type, description, uploaded_by
    ) VALUES
    (claim1_id, 'peeling_film_1.jpg', 'claim-' || claim1_id || '/peeling_film_1.jpg', 'image/jpeg', 'Photo showing peeling paint protection film', user1_id),
    (claim1_id, 'peeling_film_2.jpg', 'claim-' || claim1_id || '/peeling_film_2.jpg', 'image/jpeg', 'Close-up of damaged area', user1_id),
    (claim2_id, 'water_spots.jpg', 'claim-' || claim2_id || '/water_spots.jpg', 'image/jpeg', 'Water spots on ceramic coating', user1_id),
    (claim3_id, 'paint_damage.jpg', 'claim-' || claim3_id || '/paint_damage.jpg', 'image/jpeg', 'Paint damage from improper installation', user2_id);

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error inserting mock data: %', SQLERRM;
END $$;