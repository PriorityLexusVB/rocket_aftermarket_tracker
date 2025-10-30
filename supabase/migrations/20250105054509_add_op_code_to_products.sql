-- Location: supabase/migrations/20250105054509_add_op_code_to_products.sql
-- Schema Analysis: products table exists with complete structure
-- Integration Type: MODIFICATIVE - Adding op_code column to existing products table
-- Dependencies: products table (existing)

-- Add op_code column to existing products table
ALTER TABLE public.products
ADD COLUMN op_code TEXT;

-- Add index for op_code for faster searching and filtering
CREATE INDEX idx_products_op_code ON public.products(op_code);

-- Add constraint to ensure op_code is uppercase and alphanumeric only (if provided)
ALTER TABLE public.products
ADD CONSTRAINT chk_products_op_code_format 
CHECK (op_code IS NULL OR (op_code ~ '^[A-Z0-9]+$' AND length(op_code) <= 10));

-- Update existing products with example op_codes based on their names
DO $$
DECLARE
    product_record RECORD;
    new_op_code TEXT;
BEGIN
    -- Loop through existing products and generate op_codes from their names
    FOR product_record IN 
        SELECT id, name, brand FROM public.products 
        WHERE op_code IS NULL
    LOOP
        -- Generate op_code from name (first letters of words, max 6 chars)
        new_op_code := '';
        
        -- Extract first letter of each word from product name
        SELECT string_agg(substr(word, 1, 1), '') INTO new_op_code
        FROM unnest(string_to_array(upper(product_record.name), ' ')) AS word
        WHERE word != '';
        
        -- If brand exists and op_code is short, add brand initial
        IF product_record.brand IS NOT NULL AND length(new_op_code) < 4 THEN
            new_op_code := substr(upper(product_record.brand), 1, 1) || new_op_code;
        END IF;
        
        -- Limit to max 6 characters
        new_op_code := left(new_op_code, 6);
        
        -- Update the product with generated op_code
        UPDATE public.products 
        SET op_code = new_op_code
        WHERE id = product_record.id;
    END LOOP;

    -- Example updates for common product types
    UPDATE public.products SET op_code = 'TG' WHERE name ILIKE '%toughguard%' AND op_code IS NULL;
    UPDATE public.products SET op_code = 'WD' WHERE name ILIKE '%window%' AND name ILIKE '%tint%' AND op_code IS NULL;
    UPDATE public.products SET op_code = 'BP' WHERE name ILIKE '%brake%' AND name ILIKE '%pad%' AND op_code IS NULL;
    UPDATE public.products SET op_code = 'CF' WHERE name ILIKE '%ceramic%' AND name ILIKE '%film%' AND op_code IS NULL;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating op_codes: %', SQLERRM;
END $$;

-- Add comment explaining the op_code column
COMMENT ON COLUMN public.products.op_code IS 'Short abbreviation code for display on trackers, calendars, and summary views. Full product name used in detailed reports.';