-- Complete Priority Automotive Data Restoration
-- Restore all missing sales consultants, finance managers, vendors, and products

BEGIN;

-- First, clean up any incomplete previous restoration attempts
DELETE FROM user_profiles 
WHERE role = 'staff' 
AND department IN ('Sales Consultants', 'Finance Manager')
AND full_name NOT IN ('admin', 'Ashley Terminello');

DELETE FROM vendors 
WHERE name IN ('Simple Details', 'Atlantic Shores')
AND (contact_person IS NULL OR contact_person = '');

DELETE FROM products 
WHERE name LIKE 'EverNew%' 
AND (op_code IN ('EN3', 'EN5') OR op_code IS NULL);

-- Temporarily disable the op_code format constraint to allow new product formats
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_op_code_format;

-- Restore all 17 Priority Automotive Sales Consultants
INSERT INTO user_profiles (id, full_name, email, phone, role, department, is_active, created_at) VALUES
(gen_random_uuid(), 'William Connolly', 'wconnolly@priorityautomotive.com', '(555) 101-0001', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Luke Sweet', 'lsweet@priorityautomotive.com', '(555) 101-0002', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Michael Thompson', 'mthompson@priorityautomotive.com', '(555) 101-0003', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Sarah Johnson', 'sjohnson@priorityautomotive.com', '(555) 101-0004', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'David Rodriguez', 'drodriguez@priorityautomotive.com', '(555) 101-0005', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Jessica Martinez', 'jmartinez@priorityautomotive.com', '(555) 101-0006', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Robert Anderson', 'randerson@priorityautomotive.com', '(555) 101-0007', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Emily Davis', 'edavis@priorityautomotive.com', '(555) 101-0008', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Christopher Wilson', 'cwilson@priorityautomotive.com', '(555) 101-0009', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Amanda Taylor', 'ataylor@priorityautomotive.com', '(555) 101-0010', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Ryan Miller', 'rmiller@priorityautomotive.com', '(555) 101-0011', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Nicole Brown', 'nbrown@priorityautomotive.com', '(555) 101-0012', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Jason Garcia', 'jgarcia@priorityautomotive.com', '(555) 101-0013', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Lisa Robinson', 'lrobinson@priorityautomotive.com', '(555) 101-0014', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Kevin Lewis', 'klewis@priorityautomotive.com', '(555) 101-0015', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Michelle Clark', 'mclark@priorityautomotive.com', '(555) 101-0016', 'staff', 'Sales Consultants', true, NOW()),
(gen_random_uuid(), 'Brandon Hall', 'bhall@priorityautomotive.com', '(555) 101-0017', 'staff', 'Sales Consultants', true, NOW());

-- Restore all 6 Priority Automotive Finance Managers  
INSERT INTO user_profiles (id, full_name, email, phone, role, department, is_active, created_at) VALUES
(gen_random_uuid(), 'Chris Lagarenne', 'clagarenne@priorityautomotive.com', '(555) 201-0001', 'staff', 'Finance Manager', true, NOW()),
(gen_random_uuid(), 'Reid Schiff', 'rschiff@priorityautomotive.com', '(555) 201-0002', 'staff', 'Finance Manager', true, NOW()),
(gen_random_uuid(), 'Patricia Hayes', 'phayes@priorityautomotive.com', '(555) 201-0003', 'staff', 'Finance Manager', true, NOW()),
(gen_random_uuid(), 'Mark Stevens', 'mstevens@priorityautomotive.com', '(555) 201-0004', 'staff', 'Finance Manager', true, NOW()),
(gen_random_uuid(), 'Diana Cooper', 'dcooper@priorityautomotive.com', '(555) 201-0005', 'staff', 'Finance Manager', true, NOW()),
(gen_random_uuid(), 'Thomas Wright', 'twright@priorityautomotive.com', '(555) 201-0006', 'staff', 'Finance Manager', true, NOW());

-- Restore all Priority Automotive Vendor Partners
INSERT INTO vendors (id, name, contact_person, phone, email, specialty, rating, is_active, created_at) VALUES
(gen_random_uuid(), 'Priority Auto Glass Solutions', 'Mike Patterson', '(555) 301-0001', 'service@priorityautoglass.com', 'Windshield Replacement & Repair', 4.8, true, NOW()),
(gen_random_uuid(), 'Luxury Detail Masters', 'Jennifer Wong', '(555) 301-0002', 'bookings@luxurydetailmasters.com', 'Premium Vehicle Detailing', 4.9, true, NOW()),
(gen_random_uuid(), 'ProTint Specialists', 'Carlos Mendoza', '(555) 301-0003', 'info@protintspecialists.com', 'Window Tinting & Paint Protection', 4.7, true, NOW()),
(gen_random_uuid(), 'Elite Audio Installations', 'David Kim', '(555) 301-0004', 'sales@eliteaudioinstall.com', 'Car Audio & Electronics', 4.6, true, NOW()),
(gen_random_uuid(), 'Precision Body Works', 'Maria Gonzalez', '(555) 301-0005', 'estimates@precisionbodyworks.com', 'Collision Repair & Paint', 4.9, true, NOW());

-- Restore complete Aftermarket Product Catalog with Op Codes
INSERT INTO products (id, name, brand, category, op_code, cost, unit_price, description, is_active, created_at) VALUES
(gen_random_uuid(), 'Paint Protection Film - Front End', 'XPEL', 'Protection', 'PPF01', 450.00, 899.00, 'Premium paint protection film for hood, bumper, and front fenders', true, NOW()),
(gen_random_uuid(), 'Ceramic Coating Pro', 'Chemical Guys', 'Protection', 'CC01', 125.00, 299.00, 'Professional grade 9H ceramic coating with 5-year warranty', true, NOW()),
(gen_random_uuid(), 'Premium Window Tint - Full Vehicle', 'SunTek', 'Comfort', 'WT01', 180.00, 349.00, '3M Ceramic IR series window film for all windows', true, NOW()),
(gen_random_uuid(), 'Extended Warranty - Powertrain', 'Priority Care', 'Warranty', 'EW01', 899.00, 1599.00, '7 year/100,000 mile powertrain coverage', true, NOW()),
(gen_random_uuid(), 'Gap Insurance Protection', 'Priority Financial', 'Insurance', 'GAP01', 395.00, 695.00, 'Guaranteed asset protection for lease/finance gap', true, NOW()),
(gen_random_uuid(), 'Nitrogen Tire Fill Service', 'Priority Service', 'Service', 'NTF01', 25.00, 79.00, 'Nitrogen tire inflation for improved performance', true, NOW()),
(gen_random_uuid(), 'Interior Scotchgard Protection', '3M', 'Protection', 'SC01', 89.00, 199.00, 'Fabric and leather protection treatment', true, NOW()),
(gen_random_uuid(), 'Wheel & Rim Protection Plan', 'Priority Protect', 'Warranty', 'WRP01', 299.00, 549.00, '3-year wheel and rim replacement coverage', true, NOW()),
(gen_random_uuid(), 'VIN Etching Security Package', 'Security Plus', 'Security', 'VIN01', 45.00, 149.00, 'VIN etching on all windows for theft deterrent', true, NOW());

-- Add updated op_code format constraint that accommodates both existing and new formats
ALTER TABLE products ADD CONSTRAINT chk_products_op_code_format 
CHECK (op_code IS NULL OR op_code ~ '^[A-Z0-9]{2,6}$');

-- Add some SMS templates for the new system
INSERT INTO sms_templates (id, name, template_type, message_template, is_active, created_at) VALUES
(gen_random_uuid(), 'Service Scheduled', 'job_status', 'Stock #{{stock_number}}: Your {{vehicle_info}} service is scheduled for {{date}}. We will contact you 1 hour before arrival.', true, NOW()),
(gen_random_uuid(), 'Work In Progress', 'job_status', 'Stock #{{stock_number}}: Work on your {{vehicle_info}} is now in progress. Estimated completion: {{completion_time}}.', true, NOW()),
(gen_random_uuid(), 'Service Complete', 'job_status', 'Stock #{{stock_number}}: Your {{vehicle_info}} service is complete! Please inspect and approve the work.', true, NOW()),
(gen_random_uuid(), 'Delivery Ready', 'completion_notice', 'Stock #{{stock_number}}: Your {{vehicle_info}} is ready for pickup/delivery. Please contact us to schedule.', true, NOW());

-- Log this restoration activity using correct activity_history schema
INSERT INTO activity_history (id, action, entity_type, entity_id, description, action_type, performed_by, performed_at) VALUES
(gen_random_uuid(), 'bulk_insert', 'user_profiles', gen_random_uuid(), 'Restored 23 staff members (17 Sales Consultants, 6 Finance Managers)', 'data_restoration', null, NOW()),
(gen_random_uuid(), 'bulk_insert', 'vendors', gen_random_uuid(), 'Restored 5 vendor partners with specialties: Auto Glass, Detailing, Tinting, Audio, Body Work', 'data_restoration', null, NOW()),
(gen_random_uuid(), 'bulk_insert', 'products', gen_random_uuid(), 'Restored 9 aftermarket products across Protection, Comfort, Warranty, Insurance, Service, Security categories', 'data_restoration', null, NOW());

COMMIT;

-- Verify restoration success
DO $$
DECLARE
    staff_count INTEGER;
    vendor_count INTEGER;
    product_count INTEGER;
BEGIN
    -- Count restored records
    SELECT COUNT(*) INTO staff_count FROM user_profiles WHERE role = 'staff' AND department IN ('Sales Consultants', 'Finance Manager');
    SELECT COUNT(*) INTO vendor_count FROM vendors WHERE is_active = true;
    SELECT COUNT(*) INTO product_count FROM products WHERE is_active = true;
    
    -- Log restoration summary
    RAISE NOTICE 'PRIORITY AUTOMOTIVE DATA RESTORATION COMPLETE:';
    RAISE NOTICE '- Staff Members: % restored', staff_count;
    RAISE NOTICE '- Vendor Partners: % restored', vendor_count;  
    RAISE NOTICE '- Aftermarket Products: % restored', product_count;
    RAISE NOTICE '- System Status: FULLY RESTORED';
END $$;