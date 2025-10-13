-- Migration: Add finance_manager_id column to jobs table
-- File: 20250113160000_add_finance_manager_to_jobs.sql

-- Add finance_manager_id column to jobs table
ALTER TABLE jobs 
ADD COLUMN finance_manager_id UUID REFERENCES user_profiles(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_finance_manager_id ON jobs(finance_manager_id);

-- Add some sample finance managers if they don't exist
DO $$
DECLARE
    finance_manager_1_id UUID;
    finance_manager_2_id UUID;
    admin_user_id UUID;
BEGIN
    -- Get admin user for created_by
    SELECT id INTO admin_user_id FROM user_profiles WHERE role = 'admin' LIMIT 1;
    
    -- Insert finance managers if they don't exist
    INSERT INTO user_profiles (id, full_name, email, role, department, is_active)
    VALUES 
        (gen_random_uuid(), 'JENNIFER THOMPSON', 'jennifer.thompson@priorityautomotive.com', 'manager', 'Finance', true),
        (gen_random_uuid(), 'MICHAEL DAVIS', 'michael.davis@priorityautomotive.com', 'manager', 'Finance', true)
    ON CONFLICT (email) DO NOTHING;
    
    -- Insert delivery coordinators if they don't exist
    INSERT INTO user_profiles (id, full_name, email, role, department, is_active)
    VALUES 
        (gen_random_uuid(), 'SARAH WILSON', 'sarah.wilson@priorityautomotive.com', 'staff', 'Delivery Coordination', true),
        (gen_random_uuid(), 'ROBERT JOHNSON', 'robert.johnson@priorityautomotive.com', 'staff', 'Delivery Coordination', true)
    ON CONFLICT (email) DO NOTHING;
    
END $$;

-- Create auth users for the new staff members
DO $$
DECLARE
    new_user_record RECORD;
    user_metadata JSONB;
    user_app_metadata JSONB;
BEGIN
    -- Create auth users for each new profile that doesn't have one
    FOR new_user_record IN 
        SELECT up.id, up.email, up.full_name, up.role 
        FROM user_profiles up 
        WHERE up.email IN (
            'jennifer.thompson@priorityautomotive.com',
            'michael.davis@priorityautomotive.com', 
            'sarah.wilson@priorityautomotive.com',
            'robert.johnson@priorityautomotive.com'
        )
        AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = up.id)
    LOOP
        -- Set up metadata
        user_metadata := jsonb_build_object(
            'full_name', new_user_record.full_name,
            'role', new_user_record.role
        );
        
        user_app_metadata := jsonb_build_object(
            'provider', 'email',
            'providers', ARRAY['email']
        );
        
        -- Insert into auth.users
        INSERT INTO auth.users (
            id,
            instance_id,
            email, 
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            role,
            aud,
            confirmation_token,
            email_change_token_new,
            recovery_token
        )
        VALUES (
            new_user_record.id,
            '00000000-0000-0000-0000-000000000000',
            new_user_record.email,
            crypt('priorityauto123', gen_salt('bf')), -- Default password
            NOW(),
            NOW(), 
            NOW(),
            user_app_metadata,
            user_metadata,
            FALSE,
            'authenticated',
            'authenticated',
            '',
            '',
            ''
        );
        
    END LOOP;
END $$;

-- Update existing sample deals to include finance manager assignments
UPDATE jobs 
SET finance_manager_id = (
    SELECT id FROM user_profiles 
    WHERE department ILIKE '%finance%' 
    AND is_active = true 
    LIMIT 1
)
WHERE finance_manager_id IS NULL 
AND job_number IS NOT NULL;

-- Add comment
COMMENT ON COLUMN jobs.finance_manager_id IS 'References the finance manager assigned to oversee this job/deal';