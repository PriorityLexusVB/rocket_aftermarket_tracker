-- Ensure public.job_photos exists (some environments have history drift).
--
-- The tightening migration (20260113234500) assumes job_photos exists so it can
-- replace overly-broad policies with tenant-scoped ones.
--
-- This migration is safe and idempotent.

CREATE TABLE IF NOT EXISTS public.job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  category text DEFAULT 'progress',
  description text,
  stage text,
  gps_coordinates point,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Basic indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_job_photos_job_id ON public.job_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_vehicle_id ON public.job_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_uploaded_by ON public.job_photos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_job_photos_stage ON public.job_photos(stage);
CREATE INDEX IF NOT EXISTS idx_job_photos_category ON public.job_photos(category);
CREATE INDEX IF NOT EXISTS idx_job_photos_created_at ON public.job_photos(created_at DESC);

ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

-- Ensure the bucket exists (policies are managed by the tightening migration)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;
