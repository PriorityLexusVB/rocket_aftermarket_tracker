-- Location: supabase/migrations/20250106161000_add_finance_managers.sql
-- Schema Analysis: Fix foreign key constraint violation for user_profiles table
-- Integration Type: Addition - Adding new finance manager records with proper auth integration
-- Dependencies: Existing user_profiles table and auth.users table

-- First create auth users for the finance managers
-- Note: These will be created with temporary passwords that should be changed
-- Using ON CONFLICT to handle potential duplicates
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role
) VALUES
    (
        '78841627-1535-4ae6-a793-ddb2dc2570f1',
        '00000000-0000-0000-0000-000000000000',
        'chris.lagarenne@priorityautomotive.com',
        '$2a$10$9OgOj4JeKr4JKqBJ4K4J4e4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4',
        NOW(),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
    ),
    (
        '78841627-1535-4ae6-a793-ddb2dc2570f2',
        '00000000-0000-0000-0000-000000000000',
        'reid.schiff@priorityautomotive.com',
        '$2a$10$9OgOj4JeKr4JKqBJ4K4J4e4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4',
        NOW(),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
    ),
    (
        '78841627-1535-4ae6-a793-ddb2dc2570f3',
        '00000000-0000-0000-0000-000000000000',
        'sammy.custodio@priorityautomotive.com',
        '$2a$10$9OgOj4JeKr4JKqBJ4K4J4e4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4',
        NOW(),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
    )
ON CONFLICT (id) DO NOTHING;

-- Now add the corresponding user profiles using the auth user IDs
-- Using ON CONFLICT to handle potential duplicates
INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    role,
    department,
    is_active,
    created_at,
    updated_at
) VALUES
    (
        '78841627-1535-4ae6-a793-ddb2dc2570f1',
        'chris.lagarenne@priorityautomotive.com',
        'Chris Lagarenne',
        'staff',
        'Finance Manager',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '78841627-1535-4ae6-a793-ddb2dc2570f2',
        'reid.schiff@priorityautomotive.com',
        'Reid Schiff',
        'staff',
        'Finance Manager',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '78841627-1535-4ae6-a793-ddb2dc2570f3',
        'sammy.custodio@priorityautomotive.com',
        'Sammy Custodio',
        'staff',
        'Finance Manager',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    updated_at = CURRENT_TIMESTAMP;