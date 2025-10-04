-- Schema Analysis: Complete aftermarket system exists with jobs, transactions, job_parts tables
-- Integration Type: Enhancement - adding promised_date and calendar integration improvements  
-- Dependencies: jobs, transactions, job_parts, products, vehicles, user_profiles tables

-- Add missing promised_date field for deal management
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS promised_date TIMESTAMPTZ;

-- Add service_type field to better categorize in-house vs vendor services
ALTER TABLE public.jobs  
ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'in_house' CHECK (service_type IN ('in_house', 'vendor', 'external'));

-- Add calendar_event_id for integration tracking
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- Add customer_needs_loaner field (MISSING COLUMN CAUSING ERROR)
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS customer_needs_loaner BOOLEAN DEFAULT FALSE;

-- Add cost field to products table if it doesn't exist (for profit calculations)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;

-- Create index for promised_date for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_promised_date ON public.jobs(promised_date);
CREATE INDEX IF NOT EXISTS idx_jobs_service_type ON public.jobs(service_type);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_needs_loaner ON public.jobs(customer_needs_loaner);

-- Create function to automatically set promised_date and calendar integration
CREATE OR REPLACE FUNCTION public.set_deal_dates_and_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Set today's date if not provided
    IF NEW.created_at IS NULL THEN
        NEW.created_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- Set promised date to scheduled_start_time if not set
    IF NEW.promised_date IS NULL AND NEW.scheduled_start_time IS NOT NULL THEN
        NEW.promised_date = NEW.scheduled_start_time;
    END IF;
    
    -- Set service_type based on vendor_id
    IF NEW.vendor_id IS NOT NULL THEN
        NEW.service_type = 'vendor';
    ELSE
        NEW.service_type = 'in_house';
    END IF;
    
    -- Generate calendar event ID for tracking
    IF NEW.calendar_event_id IS NULL AND NEW.scheduled_start_time IS NOT NULL THEN
        NEW.calendar_event_id = 'deal_' || NEW.id || '_' || extract(epoch from NEW.scheduled_start_time);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for automatic date and calendar handling
CREATE TRIGGER set_deal_dates_and_calendar_trigger
    BEFORE INSERT OR UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_deal_dates_and_calendar();

-- Create function to validate line items for date requirements
CREATE OR REPLACE FUNCTION public.validate_deal_line_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    job_record RECORD;
    product_record RECORD;
BEGIN
    -- Get job details
    SELECT * INTO job_record FROM public.jobs WHERE id = NEW.job_id;
    
    -- Get product details  
    SELECT * INTO product_record FROM public.products WHERE id = NEW.product_id;
    
    -- Validate that jobs with vendors have scheduled dates
    IF job_record.vendor_id IS NOT NULL AND job_record.scheduled_start_time IS NULL THEN
        RAISE EXCEPTION 'Vendor jobs must have scheduled dates';
    END IF;
    
    -- Validate that in-house services have proper classification
    IF job_record.vendor_id IS NULL AND job_record.service_type != 'in_house' THEN
        UPDATE public.jobs 
        SET service_type = 'in_house' 
        WHERE id = NEW.job_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for line item validation
CREATE TRIGGER validate_deal_line_items_trigger
    BEFORE INSERT OR UPDATE ON public.job_parts
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_deal_line_items();

-- Create enhanced function for deal calendar integration
CREATE OR REPLACE FUNCTION public.get_deal_calendar_events(
    start_date TIMESTAMPTZ DEFAULT CURRENT_DATE,
    end_date TIMESTAMPTZ DEFAULT (CURRENT_DATE + INTERVAL '30 days')
)
RETURNS TABLE (
    job_id UUID,
    title TEXT,
    promised_date TIMESTAMPTZ,
    scheduled_start_time TIMESTAMPTZ,
    scheduled_end_time TIMESTAMPTZ,
    customer_name TEXT,
    vehicle_info TEXT,
    vendor_name TEXT,
    service_type TEXT,
    calendar_event_id TEXT,
    needs_loaner BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    j.id as job_id,
    j.title,
    j.promised_date,
    j.scheduled_start_time,
    j.scheduled_end_time,
    t.customer_name,
    CONCAT(v.year, ' ', v.make, ' ', v.model, ' (', v.stock_number, ')') as vehicle_info,
    vn.name as vendor_name,
    j.service_type,
    j.calendar_event_id,
    j.customer_needs_loaner as needs_loaner
FROM public.jobs j
LEFT JOIN public.transactions t ON j.id = t.job_id
LEFT JOIN public.vehicles v ON j.vehicle_id = v.id  
LEFT JOIN public.vendors vn ON j.vendor_id = vn.id
WHERE (j.promised_date BETWEEN start_date AND end_date
    OR j.scheduled_start_time BETWEEN start_date AND end_date)
    AND j.job_status IN ('pending', 'scheduled', 'in_progress')
ORDER BY COALESCE(j.promised_date, j.scheduled_start_time);
$$;

-- Create function to get deal profit analysis
CREATE OR REPLACE FUNCTION public.get_deal_profit_analysis(deal_job_id UUID)
RETURNS TABLE (
    job_id UUID,
    total_revenue NUMERIC,
    total_cost NUMERIC,
    total_profit NUMERIC,
    profit_margin NUMERIC,
    line_items_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    j.id as job_id,
    COALESCE(SUM(jp.total_price), 0) as total_revenue,
    COALESCE(SUM(p.cost * jp.quantity_used), 0) as total_cost,
    COALESCE(SUM(jp.total_price), 0) - COALESCE(SUM(p.cost * jp.quantity_used), 0) as total_profit,
    CASE 
        WHEN COALESCE(SUM(jp.total_price), 0) > 0 THEN
            ((COALESCE(SUM(jp.total_price), 0) - COALESCE(SUM(p.cost * jp.quantity_used), 0)) / COALESCE(SUM(jp.total_price), 0)) * 100
        ELSE 0
    END as profit_margin,
    COUNT(jp.id)::INTEGER as line_items_count
FROM public.jobs j
LEFT JOIN public.job_parts jp ON j.id = jp.job_id
LEFT JOIN public.products p ON jp.product_id = p.id
WHERE j.id = deal_job_id
GROUP BY j.id;
$$;

-- Update existing job records to have proper service_type
UPDATE public.jobs 
SET service_type = CASE 
    WHEN vendor_id IS NOT NULL THEN 'vendor'
    ELSE 'in_house'
END
WHERE service_type IS NULL;

-- Update existing job records to set promised_date from scheduled_start_time if missing
UPDATE public.jobs 
SET promised_date = scheduled_start_time 
WHERE promised_date IS NULL AND scheduled_start_time IS NOT NULL;