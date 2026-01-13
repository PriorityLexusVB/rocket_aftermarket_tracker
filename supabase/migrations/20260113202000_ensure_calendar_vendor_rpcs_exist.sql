-- Ensure core calendar/vendor RPCs exist before hardening EXECUTE/security mode.
--
-- PROD drift/partial schema scenarios have been observed where migration history
-- indicates these RPCs should exist, but the actual functions are missing or
-- have incompatible signatures.
--
-- This migration is safe and idempotent:
-- - Drops specific function signatures if present (avoids "cannot change return type")
-- - Recreates canonical implementations used by the app

-- get_overdue_jobs()
DROP FUNCTION IF EXISTS public.get_overdue_jobs();
CREATE FUNCTION public.get_overdue_jobs()
RETURNS TABLE(
  id uuid,
  title text,
  due_date timestamptz,
  job_status text,
  vendor_name text,
  vehicle_info text,
  days_overdue integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT
  j.id,
  j.title,
  j.due_date,
  j.job_status::TEXT,
  v.name as vendor_name,
  CONCAT(vh.year::TEXT, ' ', vh.make, ' ', vh.model) as vehicle_info,
  EXTRACT(DAY FROM (CURRENT_TIMESTAMP - j.due_date))::INTEGER as days_overdue
FROM public.jobs j
LEFT JOIN public.vendors v ON j.vendor_id = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
WHERE j.due_date < CURRENT_TIMESTAMP
  AND j.job_status::TEXT NOT IN ('completed', 'cancelled')
ORDER BY j.due_date ASC;
$$;

-- get_jobs_by_date_range(start_date, end_date, vendor_filter, status_filter)
DROP FUNCTION IF EXISTS public.get_jobs_by_date_range(timestamp with time zone, timestamp with time zone, uuid, text);
CREATE FUNCTION public.get_jobs_by_date_range(
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  vendor_filter uuid DEFAULT NULL::uuid,
  status_filter text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  scheduled_start_time timestamp with time zone,
  scheduled_end_time timestamp with time zone,
  job_status text,
  vendor_name text,
  vendor_id uuid,
  vehicle_info text,
  color_code text,
  priority text,
  estimated_hours integer,
  job_number text,
  location text,
  calendar_notes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH job_schedules AS (
  SELECT
    jp.job_id,
    MIN(jp.scheduled_start_time) as earliest_start,
    MAX(jp.scheduled_end_time) as latest_end,
    COUNT(*) FILTER (WHERE jp.scheduled_start_time IS NOT NULL) as scheduled_count
  FROM public.job_parts jp
  WHERE jp.scheduled_start_time IS NOT NULL
    AND jp.scheduled_end_time IS NOT NULL
  GROUP BY jp.job_id
)
SELECT
  j.id,
  j.title,
  j.description,
  js.earliest_start as scheduled_start_time,
  js.latest_end as scheduled_end_time,
  j.job_status::TEXT,
  COALESCE(v.name, 'Unassigned') as vendor_name,
  j.vendor_id,
  CASE
    WHEN vh.id IS NOT NULL THEN CONCAT(vh.year::TEXT, ' ', vh.make, ' ', vh.model)
    ELSE 'No Vehicle'
  END as vehicle_info,
  COALESCE(j.color_code, '#3b82f6') as color_code,
  j.priority::TEXT,
  j.estimated_hours,
  j.job_number,
  j.location,
  j.calendar_notes
FROM public.jobs j
INNER JOIN job_schedules js ON j.id = js.job_id
LEFT JOIN public.vendors v ON j.vendor_id = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
WHERE (
    (js.earliest_start >= start_date AND js.earliest_start <= end_date)
    OR (js.latest_end >= start_date AND js.latest_end <= end_date)
    OR (js.earliest_start <= start_date AND js.latest_end >= end_date)
)
AND (vendor_filter IS NULL OR j.vendor_id = vendor_filter)
AND (status_filter IS NULL OR j.job_status::TEXT = status_filter)
ORDER BY js.earliest_start ASC;
$$;

-- get_vendor_vehicles(vendor_uuid uuid)
DROP FUNCTION IF EXISTS public.get_vendor_vehicles(uuid);
CREATE FUNCTION public.get_vendor_vehicles(vendor_uuid uuid DEFAULT NULL)
RETURNS TABLE(
  vehicle_id uuid,
  vehicle_vin text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  job_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT
  v.id as vehicle_id,
  v.vin as vehicle_vin,
  v.make as vehicle_make,
  v.model as vehicle_model,
  v.year as vehicle_year,
  COUNT(j.id) as job_count
FROM public.vehicles v
INNER JOIN public.jobs j ON v.id = j.vehicle_id
WHERE j.vendor_id = COALESCE(
  vendor_uuid,
  (SELECT up.vendor_id FROM public.user_profiles up WHERE up.id = auth.uid())
)
GROUP BY v.id, v.vin, v.make, v.model, v.year
ORDER BY v.make, v.model, v.year;
$$;

-- check_vendor_schedule_conflict(vendor_uuid, start_time, end_time, exclude_job_id)
DROP FUNCTION IF EXISTS public.check_vendor_schedule_conflict(uuid, timestamp with time zone, timestamp with time zone, uuid);
CREATE FUNCTION public.check_vendor_schedule_conflict(
  vendor_uuid uuid,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  exclude_job_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1
  FROM public.job_parts jp
  INNER JOIN public.jobs j ON jp.job_id = j.id
  WHERE j.vendor_id = vendor_uuid
    AND jp.scheduled_start_time IS NOT NULL
    AND jp.scheduled_end_time IS NOT NULL
    AND (
      (start_time <= jp.scheduled_start_time AND end_time > jp.scheduled_start_time)
      OR (start_time < jp.scheduled_end_time AND end_time >= jp.scheduled_end_time)
      OR (start_time >= jp.scheduled_start_time AND end_time <= jp.scheduled_end_time)
      OR (jp.scheduled_start_time >= start_time AND jp.scheduled_end_time <= end_time)
    )
    AND (exclude_job_id IS NULL OR j.id != exclude_job_id)
  LIMIT 1
);
$$;

-- log_activity(...)
DROP FUNCTION IF EXISTS public.log_activity(text, uuid, text, text, jsonb, jsonb);
CREATE FUNCTION public.log_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_description text,
  p_old_values jsonb,
  p_new_values jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
INSERT INTO public.activity_history (entity_type, entity_id, action, description, old_values, new_values, performed_by)
VALUES (p_entity_type, p_entity_id, p_action, p_description, p_old_values, p_new_values, auth.uid());
$$;

-- validate_status_progression(current_status, new_status)
DROP FUNCTION IF EXISTS public.validate_status_progression(text, text);
CREATE FUNCTION public.validate_status_progression(current_status text, new_status text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT CASE
  WHEN new_status = 'cancelled' THEN true
  WHEN current_status = 'pending' AND new_status IN ('scheduled', 'in_progress') THEN true
  WHEN current_status = 'scheduled' AND new_status IN ('in_progress', 'completed') THEN true
  WHEN current_status = 'in_progress' AND new_status IN ('quality_check', 'completed') THEN true
  WHEN current_status = 'quality_check' AND new_status IN ('delivered', 'in_progress') THEN true
  WHEN current_status = 'delivered' AND new_status = 'completed' THEN true
  WHEN current_status = new_status THEN true
  WHEN current_status = 'completed' AND new_status IN ('delivered', 'quality_check') THEN true
  WHEN current_status = 'in_progress' AND new_status = 'scheduled' THEN true
  ELSE false
END;
$$;

-- generate_job_number()
-- (keep SECURITY DEFINER; hardening migration will revoke anon/public EXECUTE)
DROP FUNCTION IF EXISTS public.generate_job_number();
CREATE FUNCTION public.generate_job_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
AS $$
SELECT 'JOB-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('job_number_seq')::TEXT, 6, '0');
$$;
