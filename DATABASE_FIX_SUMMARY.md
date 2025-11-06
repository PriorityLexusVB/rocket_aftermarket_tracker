# Database Errors - Root Cause Analysis and Solutions

## Issue Summary

The application was experiencing two main database errors that prevented it from loading deals and SMS templates:

1. **Missing relationship between `job_parts` and `vendors` tables**
2. **Column mismatch in `sms_templates` table query**
3. **Missing `org_id` columns on multiple tables for multi-tenant support**

## Error Details

### Error 1: Missing job_parts-vendors relationship
```
Failed to load deals: Missing database relationship between job_parts and vendors. 
Please run the migration to add per-line vendor support (vendor_id column to job_parts table). 
Original error: Could not find a relationship between 'job_parts' and 'vendors' in the schema cache
```

**Root Cause:** The `job_parts` table lacked a `vendor_id` column to establish a foreign key relationship with the `vendors` table. The application code in `dealService.js` was attempting to query this relationship:
```javascript
job_parts(id, product_id, vendor_id, unit_price, ..., vendor:vendors(id, name))
```

**Solution:** Migration `20251106000000_add_job_parts_vendor_id.sql` already existed to add this column. There was a duplicate migration file `20251106_add_job_parts_vendor_id.sql` (without proper timestamp) that was removed to avoid migration ordering issues.

**Files Changed:**
- Removed: `supabase/migrations/20251106_add_job_parts_vendor_id.sql` (duplicate)
- Kept: `supabase/migrations/20251106000000_add_job_parts_vendor_id.sql` (proper migration)

### Error 2: SMS Templates column mismatch
```
column sms_templates.body does not exist
```

**Root Cause:** The `sms_templates` table was created with a column named `message_template`, but the code in `tenantService.js` line 77 was trying to select a column named `body`:
```javascript
.select('id, name, body, is_active')  // ❌ Wrong column name
```

All other parts of the application correctly used `message_template`:
- `src/services/notificationService.js`
- `src/pages/admin/index.jsx`
- `src/pages/administrative-configuration-center/components/SmsTemplateManager.jsx`

**Solution:** Updated `tenantService.js` to use the correct column name:
```javascript
.select('id, name, message_template, is_active')  // ✅ Correct column name
```

**Files Changed:**
- `src/services/tenantService.js`: Line 77 changed from `body` to `message_template`

### Error 3: Missing org_id columns for multi-tenant support
```
RLS policies reference org_id columns that don't exist on multiple tables
```

**Root Cause:** The migration `20251022180000_add_organizations_and_minimal_rls.sql` created RLS policies for multi-tenant access control that assume `org_id` columns exist on:
- `vendors`
- `products`
- `sms_templates`
- `transactions`
- `vehicles`

However, only the `user_profiles` table actually had the `org_id` column added. The other tables were created without this column in the base migration `20250922170950_automotive_aftermarket_system.sql`.

**Solution:** Created new migration `20251106120000_add_missing_org_id_columns.sql` that:
1. Adds `org_id UUID NULL REFERENCES organizations(id)` to all required tables
2. Creates indexes on `org_id` for query performance
3. Backfills existing records with the default organization ID ('Priority Lexus VB')
4. Uses idempotent `ADD COLUMN IF NOT EXISTS` to safely apply

**Files Changed:**
- Added: `supabase/migrations/20251106120000_add_missing_org_id_columns.sql`

## Migration Order

Migrations must be applied in this order:
1. `20251022180000_add_organizations_and_minimal_rls.sql` - Creates organizations table and adds org_id to user_profiles
2. `20251106000000_add_job_parts_vendor_id.sql` - Adds vendor_id to job_parts
3. `20251106120000_add_missing_org_id_columns.sql` - Adds org_id to remaining tables

## Testing Recommendations

To verify these fixes work correctly:

1. **Database Migration Testing:**
   ```bash
   npx supabase db push
   ```
   Verify no errors and all migrations apply successfully.

2. **Query Testing:**
   Test the dealService query that was failing:
   ```sql
   SELECT job_parts.*, vendor:vendors(id, name)
   FROM job_parts
   WHERE vendor_id IS NOT NULL;
   ```

3. **SMS Templates Testing:**
   Test the sms_templates query:
   ```sql
   SELECT id, name, message_template, is_active 
   FROM sms_templates 
   WHERE is_active = true;
   ```

4. **Multi-tenant Testing:**
   Verify RLS policies work correctly by querying as different users and ensuring they only see data from their organization.

## Build Verification

Build completed successfully after fixes:
```bash
pnpm run build
✓ built in 10.86s
```

## Remaining Work

- [ ] Apply migrations to the production/staging database
- [ ] Verify the application loads deals correctly after migrations
- [ ] Verify SMS templates dropdown loads without errors
- [ ] Test multi-tenant data isolation with different organization users

## Notes

- All changes are minimal and surgical as per workspace guidelines
- Migrations use idempotent patterns (IF NOT EXISTS, IF EXISTS)
- No changes to application logic beyond fixing the column name
- Build passes with no errors
