# Dropdown Scoping: Org + Global

## Contract

All dropdowns for staff, vendors, and products (DealForm, NewDealModal, etc.) use org-aware queries that include both:

- Records where `org_id = {orgId}` (the current tenant)
- Records where `org_id IS NULL` (global/shared)

This ensures forms always show both tenant-specific and global options, even if the org has no local staff or products.

## Implementation

- `src/services/dropdownService.js` and `src/services/tenantService.js` use `.or(org_id.eq.{orgId},org_id.is.null)` for all relevant queries.
- Option shape: `{ id, value, label }` for staff/vendors; `{ id, value, label, unit_price }` for products.
- Caching: DropdownService caches results per orgId and query params for performance.

## Testing

- E2E: DealForm and NewDealModal tests assert dropdowns populate with org+global options.
- Unit: Mock supabase and assert `.or(org_id.eq.{orgId},org_id.is.null)` is used for users/vendors/products.

## Known Gotchas

- RLS must allow org users to read both org-scoped and global rows.
- Debug-auth page now uses the same logic for counts.

## Example

```js
// Example query for staff
supabase.from('user_profiles').select('id, full_name, ...').or(`org_id.eq.${orgId},org_id.is.null`)
```

## See Also

- `src/services/dropdownService.js`
- `src/services/tenantService.js`
- `src/pages/debug-auth.jsx` (for diagnostic counts)
