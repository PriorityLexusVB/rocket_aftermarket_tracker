-- Location: supabase/migrations/20251222173855_add_vehicle_stock_number.sql
-- Schema Analysis: Existing vehicles table with make, model, year, color fields
-- Integration Type: MODIFICATIVE - Adding stock_number field to existing vehicles table
-- Dependencies: References existing vehicles table

-- Add stock_number column to existing vehicles table
ALTER TABLE public.vehicles
ADD COLUMN stock_number TEXT;

-- Add index for stock_number for better performance
CREATE INDEX idx_vehicles_stock_number ON public.vehicles(stock_number);

-- Update existing RLS policies to ensure they still work with new column
-- (Existing policies should continue to work as they are based on user ownership)