-- Seed minimal data for E2E runs: one org, staff entries, vendors, products
-- Idempotent upserts

-- Create organization if missing
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-0000000000e2', 'E2E Org')
on conflict (id) do update set name = excluded.name;

-- Vendors
insert into public.vendors (id, name, is_active, org_id)
values
  ('00000000-0000-0000-0000-0000000000v1', 'E2E Vendor 1', true, '00000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000v2', 'E2E Vendor 2', true, '00000000-0000-0000-0000-0000000000e2')
on conflict (id) do update set name = excluded.name, is_active = excluded.is_active, org_id = excluded.org_id;

-- Products
insert into public.products (id, name, brand, unit_price, is_active, org_id)
values
  ('00000000-0000-0000-0000-0000000000p1', 'E2E Product 1', 'Brand A', 100, true, '00000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000p2', 'E2E Product 2', 'Brand B', 200, true, '00000000-0000-0000-0000-0000000000e2')
on conflict (id) do update set name = excluded.name, brand = excluded.brand, unit_price = excluded.unit_price, is_active = excluded.is_active, org_id = excluded.org_id;

-- Staff (directory entries, not auth users)
insert into public.user_profiles (id, full_name, email, department, role, is_active, org_id)
values
  ('00000000-0000-0000-0000-0000000000s1', 'E2E Sales 1', 'sales1@example.com', 'Sales Consultants', 'staff', true, '00000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000s2', 'E2E Finance 1', 'finance1@example.com', 'Finance Manager', 'staff', true, '00000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000s3', 'E2E Delivery 1', 'delivery1@example.com', 'Delivery Coordinator', 'staff', true, '00000000-0000-0000-0000-0000000000e2')
on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, department = excluded.department, role = excluded.role, is_active = excluded.is_active, org_id = excluded.org_id;
