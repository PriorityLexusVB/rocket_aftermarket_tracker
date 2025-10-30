-- Location: supabase/migrations/20250923142600_photo_documentation_center.sql
-- Schema Analysis: Existing automotive aftermarket system with jobs, vehicles, communications tables
-- Integration Type: Extension - Adding photo storage and enhanced documentation to existing system
-- Dependencies: jobs, vehicles, user_profiles, communications tables (existing)

-- 1. Add job photo documentation category to communications enum (safely)
DO $$
BEGIN
    -- Check if the enum already has photo_documentation type
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'communication_type' AND e.enumlabel = 'photo_documentation'
    ) THEN
        ALTER TYPE public.communication_type ADD VALUE 'photo_documentation';
    END IF;
END $$;

-- 2. Create job_photos table for visual documentation
CREATE TABLE public.job_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    category TEXT DEFAULT 'progress',
    description TEXT,
    stage TEXT, -- 'before', 'during', 'after', 'quality_check'
    gps_coordinates POINT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create storage bucket for job photos (private for security)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'job-photos',
    'job-photos',
    false, -- Private bucket for job documentation
    10485760, -- 10MB limit per photo
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Add indexes for efficient querying
CREATE INDEX idx_job_photos_job_id ON public.job_photos(job_id);
CREATE INDEX idx_job_photos_vehicle_id ON public.job_photos(vehicle_id);
CREATE INDEX idx_job_photos_uploaded_by ON public.job_photos(uploaded_by);
CREATE INDEX idx_job_photos_stage ON public.job_photos(stage);
CREATE INDEX idx_job_photos_category ON public.job_photos(category);
CREATE INDEX idx_job_photos_created_at ON public.job_photos(created_at DESC);

-- 5. Enable RLS for job_photos table
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for job_photos (Pattern 2: Simple User Ownership)
CREATE POLICY "authenticated_users_manage_job_photos"
ON public.job_photos
FOR ALL
TO authenticated
USING (true) -- Allow all authenticated users to view job photos (business requirement)
WITH CHECK (uploaded_by = auth.uid()); -- Only uploader can create/modify

-- 7. Storage RLS policies for job-photos bucket
CREATE POLICY "authenticated_users_view_job_photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'job-photos');

CREATE POLICY "authenticated_users_upload_job_photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'job-photos'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = 'jobs'
);

CREATE POLICY "owners_manage_job_photo_files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'job-photos' AND owner = auth.uid())
WITH CHECK (bucket_id = 'job-photos' AND owner = auth.uid());

CREATE POLICY "owners_delete_job_photo_files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'job-photos' AND owner = auth.uid());

-- 8. Enhanced documentation functions
CREATE OR REPLACE FUNCTION public.get_job_documentation(job_uuid UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT json_build_object(
    'photos', COALESCE((
        SELECT json_agg(
            json_build_object(
                'id', jp.id,
                'file_path', jp.file_path,
                'file_name', jp.file_name,
                'category', jp.category,
                'stage', jp.stage,
                'description', jp.description,
                'uploaded_by', up.full_name,
                'created_at', jp.created_at
            ) ORDER BY jp.created_at DESC
        )
        FROM public.job_photos jp
        LEFT JOIN public.user_profiles up ON jp.uploaded_by = up.id
        WHERE jp.job_id = job_uuid
    ), '[]'::json),
    'notes', COALESCE((
        SELECT json_agg(
            json_build_object(
                'id', c.id,
                'message', c.message,
                'communication_type', c.communication_type,
                'sent_by', up.full_name,
                'sent_at', c.sent_at
            ) ORDER BY c.sent_at DESC
        )
        FROM public.communications c
        LEFT JOIN public.user_profiles up ON c.sent_by = up.id
        WHERE c.job_id = job_uuid 
        AND c.communication_type IN ('note', 'photo_documentation')
    ), '[]'::json)
);
$$;

-- 9. Mock data for testing photo documentation system
DO $$
DECLARE
    existing_job_id UUID;
    existing_vehicle_id UUID;
    existing_user_id UUID;
    demo_photo_id UUID := gen_random_uuid();
BEGIN
    -- Get existing IDs from the system
    SELECT id INTO existing_job_id FROM public.jobs LIMIT 1;
    SELECT id INTO existing_vehicle_id FROM public.vehicles LIMIT 1;
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

    -- Only add mock data if we have existing jobs and users
    IF existing_job_id IS NOT NULL AND existing_user_id IS NOT NULL AND existing_vehicle_id IS NOT NULL THEN
        -- Add sample photo documentation records
        INSERT INTO public.job_photos (
            id, job_id, vehicle_id, uploaded_by, file_path, file_name, 
            file_size, mime_type, category, description, stage
        ) VALUES
            (
                demo_photo_id,
                existing_job_id,
                existing_vehicle_id,
                existing_user_id,
                'jobs/' || existing_job_id::text || '/before_work_' || extract(epoch from now())::bigint || '.jpg',
                'before_work.jpg',
                2048576,
                'image/jpeg',
                'progress',
                'Vehicle condition before brake work began',
                'before'
            ),
            (
                gen_random_uuid(),
                existing_job_id,
                existing_vehicle_id,
                existing_user_id,
                'jobs/' || existing_job_id::text || '/during_work_' || extract(epoch from now())::bigint || '.jpg',
                'brake_inspection.jpg',
                1876543,
                'image/jpeg',
                'quality',
                'Brake pad wear inspection documentation',
                'during'
            );

        -- Add sample photo documentation communication entries
        INSERT INTO public.communications (
            job_id, vehicle_id, sent_by, communication_type, subject, message
        ) VALUES
            (
                existing_job_id,
                existing_vehicle_id,
                existing_user_id,
                'photo_documentation'::public.communication_type,
                'Before Work Photos',
                'Documented initial vehicle condition with ' || 2 || ' photos before beginning brake service'
            ),
            (
                existing_job_id,
                existing_vehicle_id,
                existing_user_id,
                'note'::public.communication_type,
                'Quality Check Notes',
                'Brake pad replacement completed successfully. Customer notified of additional rotor wear - recommended replacement within 5000 miles.'
            );

        RAISE NOTICE 'Photo documentation mock data created for job ID: %', existing_job_id;
    ELSE
        RAISE NOTICE 'No existing jobs or users found. Photo documentation tables created but no mock data added.';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding photo documentation mock data: %', SQLERRM;
END $$;

-- 10. Create helper function for file cleanup
CREATE OR REPLACE FUNCTION public.cleanup_job_photo(photo_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    photo_record RECORD;
    file_deleted BOOLEAN := false;
BEGIN
    -- Get photo record
    SELECT * INTO photo_record FROM public.job_photos WHERE id = photo_uuid;
    
    IF photo_record IS NULL THEN
        RETURN false;
    END IF;
    
    -- Delete from storage (this will be handled by the application)
    -- Database record cleanup
    DELETE FROM public.job_photos WHERE id = photo_uuid;
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error cleaning up photo: %', SQLERRM;
        RETURN false;
END $$;