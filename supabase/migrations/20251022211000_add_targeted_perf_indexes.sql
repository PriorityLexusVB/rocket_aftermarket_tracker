-- Targeted performance indexes based on telemetry
-- - user_profiles ORDER BY full_name and created_at patterns
-- - department ILIKE filters use trigram index
-- - sms_templates ORDER BY created_at

-- Ensure pg_trgm is available for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- user_profiles: accelerate ORDER BY full_name and created_at
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON public.user_profiles (full_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON public.user_profiles (created_at);

-- user_profiles: accelerate ILIKE on department with trigram
CREATE INDEX IF NOT EXISTS idx_user_profiles_department_trgm ON public.user_profiles USING gin (department gin_trgm_ops);

-- sms_templates: accelerate ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_sms_templates_created_at ON public.sms_templates (created_at);
