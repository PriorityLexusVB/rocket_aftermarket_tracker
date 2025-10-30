-- Schema Analysis: Products table exists with all required columns
-- Integration Type: Data addition only - no schema changes needed
-- Dependencies: Existing products table with columns: name, cost, unit_price, op_code, brand, category, description

-- Add requested aftermarket products to existing products table
DO $$
BEGIN
    -- Insert the requested aftermarket products
    INSERT INTO public.products (name, op_code, cost, unit_price, brand, category, description, is_active)
    VALUES
        ('EverNew 3yr', 'EN3', 499, 499, 'EverNew', 'Protection', '3-year paint protection warranty', true),
        ('EverNew 5yr', 'EN5', 549, 549, 'EverNew', 'Protection', '5-year paint protection warranty', true),
        ('Exterior Protection', 'EXT', 338, 338, 'Premium', 'Protection', 'Comprehensive exterior protection package', true),
        ('Interior Protection', 'INT', 240, 240, 'Premium', 'Protection', 'Complete interior protection and treatment', true),
        ('Windshield Protection', 'WS', 465, 465, 'SafeGuard', 'Protection', 'Advanced windshield protection film', true),
        ('Rust Guard', 'RG', 250, 250, 'RustShield', 'Protection', 'Long-term rust prevention treatment', true);

    RAISE NOTICE 'Successfully added 6 aftermarket products to the database';

EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Some products may already exist (unique constraint violation): %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding products: %', SQLERRM;
END $$;