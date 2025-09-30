-- Location: supabase/migrations/20250101000000_advanced_features_enhancement.sql
-- Schema Analysis: Existing aftermarket system with jobs, vehicles, vendors, user_profiles tables
-- Integration Type: Enhancement - Adding SMS templates, filter presets, and advanced features
-- Dependencies: jobs, user_profiles, vendors, vehicles tables

-- 1. SMS Template Management System
CREATE TYPE public.template_type AS ENUM ('job_status', 'overdue_alert', 'customer_notification', 'vendor_assignment', 'completion_notice');

CREATE TABLE public.sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    template_type public.template_type NOT NULL,
    subject TEXT,
    message_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Advanced Filter Presets System
CREATE TABLE public.filter_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    page_type TEXT NOT NULL, -- 'vehicles', 'jobs', 'vendors', 'transactions'
    name TEXT NOT NULL,
    filters JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Notification Preferences System
CREATE TYPE public.notification_method AS ENUM ('email', 'sms', 'desktop', 'in_app');

CREATE TABLE public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL, -- 'overdue_job', 'status_change', 'new_assignment'
    method public.notification_method NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Enhanced Activity Logging
ALTER TABLE public.activity_history 
ADD COLUMN IF NOT EXISTS action_type TEXT,
ADD COLUMN IF NOT EXISTS old_values JSONB,
ADD COLUMN IF NOT EXISTS new_values JSONB,
ADD COLUMN IF NOT EXISTS ip_address INET;

-- 5. Indexes for Performance
CREATE INDEX idx_sms_templates_type ON public.sms_templates(template_type);
CREATE INDEX idx_sms_templates_active ON public.sms_templates(is_active);
CREATE INDEX idx_filter_presets_user_page ON public.filter_presets(user_id, page_type);
CREATE INDEX idx_filter_presets_public ON public.filter_presets(is_public) WHERE is_public = true;
CREATE INDEX idx_notification_preferences_user ON public.notification_preferences(user_id);
CREATE INDEX idx_activity_history_action ON public.activity_history(action_type);

-- 6. Enhanced Overdue Job Function (Improve existing function)
CREATE OR REPLACE FUNCTION public.get_overdue_jobs_enhanced()
RETURNS TABLE(
    id uuid,
    job_number text,
    title text,
    due_date timestamptz,
    job_status text,
    priority text,
    vendor_name text,
    vendor_contact text,
    vehicle_info text,
    owner_contact text,
    days_overdue integer,
    severity_level text,
    assigned_to_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    j.id,
    j.job_number,
    j.title,
    j.due_date,
    j.job_status::TEXT,
    j.priority::TEXT,
    v.name as vendor_name,
    v.phone as vendor_contact,
    CONCAT(vh.year::TEXT, ' ', vh.make, ' ', vh.model, ' (', vh.license_plate, ')') as vehicle_info,
    vh.owner_phone as owner_contact,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - j.due_date))::INTEGER as days_overdue,
    CASE 
        WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - j.due_date)) <= 1 THEN 'low'
        WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - j.due_date)) <= 3 THEN 'medium'
        WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - j.due_date)) <= 7 THEN 'high'
        ELSE 'critical'
    END as severity_level,
    up.full_name as assigned_to_name
FROM public.jobs j
LEFT JOIN public.vendors v ON j.vendor_id = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
LEFT JOIN public.user_profiles up ON j.assigned_to = up.id
WHERE j.due_date < CURRENT_TIMESTAMP
AND j.job_status::TEXT NOT IN ('completed', 'cancelled', 'delivered')
ORDER BY j.due_date ASC, j.priority DESC;
$$;

-- 7. Advanced Export Functions
CREATE OR REPLACE FUNCTION public.generate_export_data(
    export_type TEXT,
    filters JSONB DEFAULT '{}'::jsonb,
    user_role TEXT DEFAULT 'staff'
)
RETURNS TABLE(export_data JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    start_date DATE;
    end_date DATE;
    status_filter TEXT;
    vendor_filter UUID;
BEGIN
    -- Extract common filters
    start_date := (filters->>'start_date')::DATE;
    end_date := (filters->>'end_date')::DATE;
    status_filter := filters->>'status';
    vendor_filter := (filters->>'vendor_id')::UUID;

    -- Jobs export
    IF export_type = 'jobs' THEN
        RETURN QUERY
        SELECT jsonb_build_object(
            'job_number', j.job_number,
            'title', j.title,
            'status', j.job_status,
            'priority', j.priority,
            'vehicle', CONCAT(v.year::TEXT, ' ', v.make, ' ', v.model),
            'vendor', vnd.name,
            'assigned_to', up.full_name,
            'due_date', j.due_date,
            'estimated_cost', j.estimated_cost,
            'actual_cost', j.actual_cost,
            'profit', COALESCE(j.estimated_cost, 0) - COALESCE(j.actual_cost, 0),
            'created_at', j.created_at
        ) as export_data
        FROM public.jobs j
        LEFT JOIN public.vehicles v ON j.vehicle_id = v.id
        LEFT JOIN public.vendors vnd ON j.vendor_id = vnd.id
        LEFT JOIN public.user_profiles up ON j.assigned_to = up.id
        WHERE (start_date IS NULL OR j.created_at::DATE >= start_date)
        AND (end_date IS NULL OR j.created_at::DATE <= end_date)
        AND (status_filter IS NULL OR j.job_status::TEXT = status_filter)
        AND (vendor_filter IS NULL OR j.vendor_id = vendor_filter);

    -- Vehicles export
    ELSIF export_type = 'vehicles' THEN
        RETURN QUERY
        SELECT jsonb_build_object(
            'vin', v.vin,
            'make', v.make,
            'model', v.model,
            'year', v.year,
            'stock_number', v.stock_number,
            'owner_name', v.owner_name,
            'owner_phone', v.owner_phone,
            'status', v.vehicle_status,
            'total_jobs', COALESCE(job_counts.job_count, 0),
            'total_profit', CASE WHEN user_role IN ('admin', 'manager') THEN COALESCE(job_profits.total_profit, 0) ELSE NULL END
        ) as export_data
        FROM public.vehicles v
        LEFT JOIN (
            SELECT vehicle_id, COUNT(*) as job_count
            FROM public.jobs
            GROUP BY vehicle_id
        ) job_counts ON v.id = job_counts.vehicle_id
        LEFT JOIN (
            SELECT vehicle_id, SUM(COALESCE(estimated_cost, 0) - COALESCE(actual_cost, 0)) as total_profit
            FROM public.jobs
            WHERE job_status = 'completed'
            GROUP BY vehicle_id
        ) job_profits ON v.id = job_profits.vehicle_id;

    -- Vendors export
    ELSIF export_type = 'vendors' THEN
        RETURN QUERY
        SELECT jsonb_build_object(
            'name', vnd.name,
            'specialty', vnd.specialty,
            'contact_person', vnd.contact_person,
            'phone', vnd.phone,
            'email', vnd.email,
            'rating', vnd.rating,
            'active_jobs', COALESCE(active_jobs.count, 0),
            'completed_jobs', COALESCE(completed_jobs.count, 0),
            'avg_completion_time', vendor_stats.avg_completion_hours
        ) as export_data
        FROM public.vendors vnd
        LEFT JOIN (
            SELECT vendor_id, COUNT(*) as count
            FROM public.jobs
            WHERE job_status IN ('pending', 'in_progress', 'scheduled')
            GROUP BY vendor_id
        ) active_jobs ON vnd.id = active_jobs.vendor_id
        LEFT JOIN (
            SELECT vendor_id, COUNT(*) as count
            FROM public.jobs
            WHERE job_status = 'completed'
            GROUP BY vendor_id
        ) completed_jobs ON vnd.id = completed_jobs.vendor_id
        LEFT JOIN (
            SELECT vendor_id, AVG(actual_hours) as avg_completion_hours
            FROM public.jobs
            WHERE job_status = 'completed' AND actual_hours IS NOT NULL
            GROUP BY vendor_id
        ) vendor_stats ON vnd.id = vendor_stats.vendor_id;

    END IF;
END;
$func$;

-- 8. Bulk Operations Function
CREATE OR REPLACE FUNCTION public.bulk_update_jobs(
    job_ids UUID[],
    updates JSONB,
    performed_by UUID
)
RETURNS TABLE(success_count INTEGER, failed_count INTEGER, errors TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    job_id UUID;
    success_counter INTEGER := 0;
    failed_counter INTEGER := 0;
    error_messages TEXT[] := ARRAY[]::TEXT[];
    update_data RECORD;
BEGIN
    -- Process each job ID
    FOREACH job_id IN ARRAY job_ids LOOP
        BEGIN
            -- Build dynamic update based on provided JSONB
            UPDATE public.jobs
            SET 
                job_status = COALESCE((updates->>'job_status')::job_status, job_status),
                priority = COALESCE((updates->>'priority')::job_priority, priority),
                assigned_to = COALESCE((updates->>'assigned_to')::UUID, assigned_to),
                vendor_id = COALESCE((updates->>'vendor_id')::UUID, vendor_id),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = job_id;

            -- Log the bulk update
            INSERT INTO public.activity_history (
                performed_by, action_type, description, 
                new_values, created_at
            ) VALUES (
                performed_by, 'bulk_update', 
                'Bulk job update for job: ' || job_id::TEXT,
                updates, CURRENT_TIMESTAMP
            );

            success_counter := success_counter + 1;

        EXCEPTION WHEN OTHERS THEN
            failed_counter := failed_counter + 1;
            error_messages := array_append(error_messages, 
                'Job ' || job_id::TEXT || ': ' || SQLERRM);
        END;
    END LOOP;

    RETURN QUERY SELECT success_counter, failed_counter, error_messages;
END;
$func$;

-- 9. Enhanced RLS Policies
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- SMS Templates - Admin/Manager access
CREATE POLICY "admin_manage_sms_templates" ON public.sms_templates
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('admin', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('admin', 'manager')
    )
);

-- Filter Presets - User ownership + public access
CREATE POLICY "users_manage_own_filter_presets" ON public.filter_presets
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_view_public_filter_presets" ON public.filter_presets
FOR SELECT TO authenticated
USING (is_public = true);

-- Notification Preferences - User ownership
CREATE POLICY "users_manage_own_notification_preferences" ON public.notification_preferences
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 10. Sample Data for Testing
DO $$
DECLARE
    admin_id UUID;
    manager_id UUID;
BEGIN
    -- Get existing users
    SELECT id INTO admin_id FROM public.user_profiles WHERE role = 'admin' LIMIT 1;
    SELECT id INTO manager_id FROM public.user_profiles WHERE role = 'manager' LIMIT 1;

    -- Sample SMS Templates
    INSERT INTO public.sms_templates (name, template_type, subject, message_template, variables, created_by) VALUES
        ('Job Status Update', 'job_status', 'Service Update', 
         'Your {{vehicle_info}} service is now {{status}}. Est. completion: {{completion_date}}. Questions? Call {{contact_phone}}.', 
         '["vehicle_info", "status", "completion_date", "contact_phone"]'::jsonb, admin_id),
        ('Overdue Job Alert', 'overdue_alert', 'Urgent: Overdue Service', 
         'URGENT: Your {{vehicle_info}} service is {{days_overdue}} days overdue. Please contact us at {{contact_phone}} immediately.', 
         '["vehicle_info", "days_overdue", "contact_phone"]'::jsonb, admin_id),
        ('Completion Notice', 'completion_notice', 'Service Complete', 
         'Great news! Your {{vehicle_info}} {{service_type}} is complete. Total: ${{total_cost}}. Ready for pickup!', 
         '["vehicle_info", "service_type", "total_cost"]'::jsonb, admin_id);

    -- Sample Filter Presets
    INSERT INTO public.filter_presets (user_id, page_type, name, filters, is_public) VALUES
        (admin_id, 'jobs', 'High Priority Overdue', 
         '{"status": ["pending", "in_progress"], "priority": ["high", "urgent"], "overdue": true}'::jsonb, true),
        (admin_id, 'vehicles', 'Active with Multiple Jobs', 
         '{"status": "active", "min_job_count": 3}'::jsonb, true),
        (manager_id, 'vendors', 'Top Performers', 
         '{"rating": {"min": 4.0}, "completion_rate": {"min": 90}}'::jsonb, false);

    -- Sample Notification Preferences
    INSERT INTO public.notification_preferences (user_id, notification_type, method, is_enabled, settings) VALUES
        (admin_id, 'overdue_job', 'email', true, '{"frequency": "daily", "hour": 9}'::jsonb),
        (admin_id, 'overdue_job', 'desktop', true, '{"sound": true}'::jsonb),
        (manager_id, 'status_change', 'sms', true, '{"immediate": true}'::jsonb);

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Sample data insertion failed: %', SQLERRM;
END $$;