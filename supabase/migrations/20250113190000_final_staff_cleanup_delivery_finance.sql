-- Location: supabase/migrations/20250113190000_final_staff_cleanup_delivery_finance.sql
-- Schema Analysis: Existing user_profiles table with department filtering for staff assignments
-- Integration Type: DESTRUCTIVE - Remove remaining demo/illegitimate employees
-- Dependencies: user_profiles table

-- Final comprehensive cleanup of demo and illegitimate employees
-- Targeting delivery coordinators and finance managers specifically

-- Step 1: Identify and remove demo users with enhanced pattern matching
DO $$
DECLARE
    users_to_remove UUID[];
    removal_count INTEGER := 0;
BEGIN
    -- Collect all user IDs that match demo patterns or are illegitimate
    SELECT ARRAY_AGG(id) INTO users_to_remove
    FROM public.user_profiles
    WHERE 
        -- Enhanced demo pattern detection
        (LOWER(full_name) ~ '(demo|test|sample|fake|example|temp|placeholder)' OR
        LOWER(email) ~ '(demo|test|sample|fake|example|temp|placeholder)' OR
        
        -- Generic/placeholder names
        LOWER(full_name) ~ '^(user|employee|staff|person|individual)\s*\d*$' OR
        
        -- Sequential naming patterns (common in demo data)
        LOWER(full_name) ~ '(user|employee|staff|person)\s*[0-9]+' OR
        
        -- Emails with common demo domains or patterns
        email ~ '@(example\.com|test\.com|demo\.com|localhost|invalid\.com)$' OR
        
        -- Names that are clearly placeholders
        LOWER(full_name) ~ '(lorem|ipsum|placeholder|dummy|mock)' OR
        
        -- Names with suspicious formatting (all caps, numbers only, etc.)
        (full_name ~ '^[A-Z\s]+$' AND LENGTH(full_name) < 15) OR
        full_name ~ '^\d+$' OR
        
        -- Delivery coordinator department with suspicious entries
        (LOWER(department) LIKE '%delivery%' OR LOWER(department) LIKE '%coordinator%') 
            AND (LOWER(full_name) NOT SIMILAR TO '%[a-z]+\s+[a-z]+%' OR full_name ~ '^[A-Z\s]+$') OR
        
        -- Finance department with suspicious entries  
        (LOWER(department) LIKE '%finance%' OR LOWER(department) LIKE '%manager%')
            AND (LOWER(full_name) NOT SIMILAR TO '%[a-z]+\s+[a-z]+%' OR full_name ~ '^[A-Z\s]+$') OR
        
        -- Users without proper email formats or incomplete data
        (email IS NOT NULL AND email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') OR
        full_name IS NULL OR 
        TRIM(full_name) = '' OR
        email IS NULL OR
        TRIM(email) = '');

    -- Get count for logging using proper array length function
    removal_count := COALESCE(array_length(users_to_remove, 1), 0);
    
    IF users_to_remove IS NOT NULL AND removal_count > 0 THEN
        -- Log users being removed for audit trail
        RAISE NOTICE 'Removing % illegitimate users from user_profiles', removal_count;
        
        -- Delete from dependent tables first (to avoid foreign key violations)
        DELETE FROM public.jobs WHERE assigned_to = ANY(users_to_remove);
        DELETE FROM public.jobs WHERE created_by = ANY(users_to_remove);
        DELETE FROM public.jobs WHERE delivery_coordinator_id = ANY(users_to_remove);
        DELETE FROM public.jobs WHERE finance_manager_id = ANY(users_to_remove);
        DELETE FROM public.communications WHERE sent_by = ANY(users_to_remove);
        DELETE FROM public.activity_history WHERE performed_by = ANY(users_to_remove);
        DELETE FROM public.claims WHERE assigned_to = ANY(users_to_remove);
        DELETE FROM public.claims WHERE submitted_by = ANY(users_to_remove);
        DELETE FROM public.vehicles WHERE created_by = ANY(users_to_remove);
        DELETE FROM public.products WHERE created_by = ANY(users_to_remove);
        DELETE FROM public.transactions WHERE processed_by = ANY(users_to_remove);
        DELETE FROM public.filter_presets WHERE user_id = ANY(users_to_remove);
        DELETE FROM public.notification_preferences WHERE user_id = ANY(users_to_remove);
        DELETE FROM public.sms_templates WHERE created_by = ANY(users_to_remove);
        DELETE FROM public.vendors WHERE created_by = ANY(users_to_remove);
        DELETE FROM public.claim_attachments WHERE uploaded_by = ANY(users_to_remove);
        
        -- Finally remove from user_profiles
        DELETE FROM public.user_profiles WHERE id = ANY(users_to_remove);
        
        RAISE NOTICE 'Successfully removed % illegitimate users and their associated records', removal_count;
    ELSE
        RAISE NOTICE 'No illegitimate users found to remove';
    END IF;

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key constraint prevents deletion: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Cleanup failed: %', SQLERRM;
END $$;

-- Step 2: Standardize legitimate department names for better filtering
UPDATE public.user_profiles 
SET department = 'Finance Managers'
WHERE LOWER(department) LIKE '%finance%' 
  AND department != 'Finance Managers'
  AND EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = user_profiles.id AND up.is_active = true);

UPDATE public.user_profiles 
SET department = 'Delivery Coordinators'
WHERE (LOWER(department) LIKE '%delivery%' OR LOWER(department) LIKE '%coordinator%')
  AND department != 'Delivery Coordinators'  
  AND EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = user_profiles.id AND up.is_active = true);

-- Step 3: Ensure only legitimate users remain active (simple validity check)
UPDATE public.user_profiles 
SET is_active = false
WHERE (
    full_name IS NULL OR 
    TRIM(full_name) = '' OR
    email IS NULL OR

    TRIM(email) = '' OR
    email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- Step 4: Create audit function to prevent future demo user insertions
CREATE OR REPLACE FUNCTION public.validate_user_legitimacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Basic validation checks
    IF NEW.full_name IS NULL OR TRIM(NEW.full_name) = '' THEN
        RAISE EXCEPTION 'User must have a valid full name';
    END IF;
    
    IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
        RAISE EXCEPTION 'User must have a valid email';
    END IF;
    
    IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'User must have a properly formatted email address';
    END IF;
    
    -- Check for demo patterns
    IF LOWER(NEW.full_name) ~ '(demo|test|sample|fake|example|temp|placeholder)' OR
       LOWER(NEW.email) ~ '(demo|test|sample|fake|example|temp|placeholder)' THEN
        RAISE EXCEPTION 'Demo or test user patterns are not allowed: %', NEW.full_name;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to validate user legitimacy on insert/update
DROP TRIGGER IF EXISTS validate_user_legitimacy_trigger ON public.user_profiles;
CREATE TRIGGER validate_user_legitimacy_trigger
    BEFORE INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_user_legitimacy();

-- Step 5: Add database constraints to prevent future demo user creation
DO $$
BEGIN
    -- Add constraint to prevent obvious demo names
    BEGIN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT check_no_demo_names 
        CHECK (
            LOWER(full_name) NOT LIKE '%demo%' AND
            LOWER(full_name) NOT LIKE '%test%' AND  
            LOWER(full_name) NOT LIKE '%sample%' AND
            LOWER(full_name) NOT LIKE '%fake%' AND
            LOWER(email) NOT LIKE '%demo%' AND
            LOWER(email) NOT LIKE '%test%' AND
            LOWER(email) NOT LIKE '%sample%' AND
            LOWER(email) NOT LIKE '%fake%'
        );
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Constraint check_no_demo_names already exists';
    END;
    
    -- Add constraint for proper email format
    BEGIN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT check_valid_email_format 
        CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Constraint check_valid_email_format already exists';
    END;
    
    -- Add constraint for proper name format
    BEGIN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT check_valid_name_format 
        CHECK (
            full_name IS NOT NULL AND 
            TRIM(full_name) != '' AND
            LENGTH(TRIM(full_name)) >= 2
        );
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Constraint check_valid_name_format already exists';
    END;
    
END $$;

-- Step 6: Create cleanup function for future use
CREATE OR REPLACE FUNCTION public.cleanup_illegitimate_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleanup_count INTEGER := 0;
BEGIN
    -- Count users to be removed
    SELECT COUNT(*) INTO cleanup_count
    FROM public.user_profiles
    WHERE (full_name IS NULL OR 
           TRIM(full_name) = '' OR
           email IS NULL OR
           TRIM(email) = '' OR
           email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') 
           OR is_active = false;
    
    -- Remove illegitimate users and their dependencies
    DELETE FROM public.jobs WHERE assigned_to IN (
        SELECT id FROM public.user_profiles WHERE (
            full_name IS NULL OR 
            TRIM(full_name) = '' OR
            email IS NULL OR
            TRIM(email) = '' OR
            email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
        )
    );
    
    DELETE FROM public.user_profiles 
    WHERE (full_name IS NULL OR 
           TRIM(full_name) = '' OR
           email IS NULL OR
           TRIM(email) = '' OR
           email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') 
           OR is_active = false;
    
    RETURN cleanup_count;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Cleanup function error: %', SQLERRM;
        RETURN 0;
END;
$$;

-- Final verification query to show remaining legitimate users by department
DO $$
DECLARE 
    finance_count INTEGER;
    delivery_count INTEGER;
    sales_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO finance_count 
    FROM public.user_profiles 
    WHERE LOWER(department) LIKE '%finance%' AND is_active = true;
    
    SELECT COUNT(*) INTO delivery_count 
    FROM public.user_profiles 
    WHERE (LOWER(department) LIKE '%delivery%' OR LOWER(department) LIKE '%coordinator%') 
    AND is_active = true;
    
    SELECT COUNT(*) INTO sales_count 
    FROM public.user_profiles 
    WHERE LOWER(department) LIKE '%sales%' AND is_active = true;
    
    RAISE NOTICE 'Final user counts - Finance: %, Delivery: %, Sales: %', 
                 finance_count, delivery_count, sales_count;
END $$;