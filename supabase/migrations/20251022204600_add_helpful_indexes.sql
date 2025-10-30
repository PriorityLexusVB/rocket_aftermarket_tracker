-- Create helpful indexes on common join/filter columns. Uses IF NOT EXISTS for idempotency.

-- filter_presets
CREATE INDEX IF NOT EXISTS idx_filter_presets_user_id ON public.filter_presets (user_id);
CREATE INDEX IF NOT EXISTS idx_filter_presets_page_type ON public.filter_presets (page_type);

-- notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_type ON public.notification_preferences (notification_type);

-- products
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products (vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON public.products (created_by);

-- sms_templates
CREATE INDEX IF NOT EXISTS idx_sms_templates_is_active ON public.sms_templates (is_active);
CREATE INDEX IF NOT EXISTS idx_sms_templates_created_by ON public.sms_templates (created_by);

-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_job_id ON public.transactions (job_id);
CREATE INDEX IF NOT EXISTS idx_transactions_vehicle_id ON public.transactions (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transactions_processed_by ON public.transactions (processed_by);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions (created_at);

-- vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_stock_number ON public.vehicles (stock_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON public.vehicles (created_by);

-- vendors
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON public.vendors (is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_created_by ON public.vendors (created_by);
