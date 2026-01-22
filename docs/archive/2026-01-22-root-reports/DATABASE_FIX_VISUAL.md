# Database Schema Fixes - Visual Reference

## Before Fix: Missing Relationships

```
┌─────────────────┐
│   job_parts     │
│─────────────────│
│ id              │
│ product_id ────┐│
│ vendor_id ❌   ││  (Missing - caused relationship error)
│ unit_price      ││
│ quantity_used   ││
└─────────────────┘│
                   │
                   ▼
          ┌────────────────┐
          │   products     │
          │────────────────│
          │ id             │
          │ name           │
          │ vendor_id ────┐│
          │ org_id ❌     ││  (Missing - RLS policy failed)
          └────────────────┘│
                           │
                           ▼
                  ┌─────────────┐
                  │   vendors   │
                  │─────────────│
                  │ id          │
                  │ name        │
                  │ org_id ❌   │  (Missing - RLS policy failed)
                  └─────────────┘
```

## After Fix: Complete Relationships

```
┌─────────────────┐
│   job_parts     │
│─────────────────│
│ id              │
│ product_id ────┐│
│ vendor_id ✅ ──┼┼─────────────────────┐
│ unit_price      ││                     │
│ quantity_used   ││                     │
└─────────────────┘│                     │
                   │                     │
                   ▼                     ▼
          ┌────────────────┐    ┌─────────────┐
          │   products     │    │   vendors   │
          │────────────────│    │─────────────│
          │ id             │    │ id          │
          │ name           │    │ name        │
          │ vendor_id ────┼───▶│ org_id ✅   │
          │ org_id ✅      │    └─────────────┘
          └────────────────┘            │
                   │                    │
                   │                    │
                   ▼                    ▼
          ┌──────────────────────────────────┐
          │      organizations               │
          │──────────────────────────────────│
          │ id                               │
          │ name (e.g., "Priority Lexus VB") │
          └──────────────────────────────────┘
```

## SMS Templates Column Fix

### Before Fix:

```javascript
// tenantService.js
supabase.from('sms_templates').select('id, name, body, is_active') // ❌ Column 'body' doesn't exist
```

```sql
-- Database Schema
CREATE TABLE sms_templates (
  id UUID,
  name TEXT,
  message_template TEXT,  -- Actual column name
  is_active BOOLEAN
);
```

### After Fix:

```javascript
// tenantService.js
supabase.from('sms_templates').select('id, name, message_template, is_active') // ✅ Correct column name
```

## Multi-Tenant Support (org_id columns)

### Tables that needed org_id added:

- ✅ vendors
- ✅ products
- ✅ sms_templates
- ✅ transactions
- ✅ vehicles

### Result:

Each organization can now have isolated data:

```
Organization: "Priority Lexus VB"
├── Vendors (their vendors only)
├── Products (their products only)
├── SMS Templates (their templates + global)
├── Transactions (their transactions only)
└── Vehicles (their vehicles only)

Organization: "Other Dealership"
├── Vendors (different set)
├── Products (different set)
└── ... (completely isolated data)
```

## Migration Application Order

1. **20251022180000** - Create organizations table, add org_id to user_profiles
2. **20251106000000** - Add vendor_id to job_parts (fix relationship)
3. **20251106120000** - Add org_id to vendors, products, sms_templates, transactions, vehicles

## Key Points

- **Minimal Changes**: Only 3 files modified/added
- **Backward Compatible**: All migrations use `IF NOT EXISTS` clauses
- **Data Preserved**: Backfill ensures existing data gets assigned to default org
- **Build Verified**: Application builds successfully after changes
