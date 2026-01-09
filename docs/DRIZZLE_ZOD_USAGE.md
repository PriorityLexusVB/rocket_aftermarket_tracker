# Drizzle + drizzle-zod + Zod Usage Guide

This guide explains how to use the typed data patterns introduced per Section 20 of `.github/copilot-instructions.md`.

## Overview

We now have a single source of truth for schema definitions:

1. **Drizzle** defines table structure in `src/db/schema.ts` (mirrors Supabase exactly)
2. **drizzle-zod** generates Zod schemas in `src/db/schemas.ts`
3. **Service functions** validate data before Supabase calls

## Schema Definitions

### Available Schemas

```typescript
import {
  // Vendors
  vendorInsertSchema,
  vendorSelectSchema,
  VendorInsert,
  Vendor,

  // Jobs
  jobInsertSchema,
  jobSelectSchema,
  JobInsert,
  Job,

  // Job Parts
  jobPartInsertSchema,
  jobPartSelectSchema,
  JobPartInsert,
  JobPart,
} from '@/db/schemas'
```

## Using Typed Service Functions

### Vendor Operations

```javascript
import vendorService from '@/services/vendorService'

// Create a vendor (validated with Zod)
const newVendor = await vendorService.create({
  name: 'Acme Detailing',
  contactPerson: 'John Smith',
  phone: '555-1234',
  email: 'john@acme.com',
  specialty: 'Window Tinting',
  rating: '4.5',
  orgId: currentOrgId,
})

if (newVendor.error) {
  console.error('Validation or DB error:', newVendor.error)
} else {
  console.log('Created vendor:', newVendor.data)
}

// Update a vendor
const updated = await vendorService.update(vendorId, {
  rating: '5.0',
  notes: 'Excellent service',
})

// Delete a vendor
await vendorService.delete(vendorId)
```

### Job Operations

```javascript
import jobService from '@/services/jobService'

// Create a job (validated with Zod)
const newJob = await jobService.createTyped({
  title: 'Install Window Tint',
  jobNumber: 'JOB-2025-001',
  vendorId: vendorId,
  vehicleId: vehicleId,
  jobStatus: 'pending',
  priority: 'high',
  scheduledStartTime: '2025-01-15T09:00:00Z',
  scheduledEndTime: '2025-01-15T11:00:00Z',
  orgId: currentOrgId,
})

// Update a job
const updated = await jobService.updateTyped(jobId, {
  jobStatus: 'in_progress',
  startedAt: new Date().toISOString(),
})
```

### Job Parts Operations

```javascript
import { createJobPartsTyped } from '@/services/jobPartsService'

// Create multiple job parts (validated with Zod)
const result = await createJobPartsTyped([
  {
    jobId: jobId,
    productId: product1Id,
    quantityUsed: 2,
    unitPrice: 99.99,
  },
  {
    jobId: jobId,
    productId: product2Id,
    quantityUsed: 1,
    unitPrice: 149.99,
  },
])

if (result.error) {
  console.error('Failed to create job parts:', result.error)
} else {
  console.log('Created job parts:', result.data)
}
```

## Form Validation Example

### Using with react-hook-form

```javascript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { vendorInsertSchema } from '@/db/schemas'
import vendorService from '@/services/vendorService'

function VendorForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(vendorInsertSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      isActive: true,
    },
  })

  const onSubmit = handleSubmit(async (data) => {
    const result = await vendorService.create(data)
    if (result.error) {
      alert('Error: ' + result.error.message)
    } else {
      alert('Vendor created successfully!')
    }
  })

  return (
    <form onSubmit={onSubmit}>
      <input {...register('name')} placeholder="Vendor Name" />
      {errors.name && <span>{errors.name.message}</span>}

      <input {...register('contactPerson')} placeholder="Contact Person" />

      <input {...register('phone')} placeholder="Phone" />

      <input {...register('email')} type="email" placeholder="Email" />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Vendor'}
      </button>
    </form>
  )
}
```

## Validation Benefits

### Before (Manual Validation)

```javascript
// Scattered validation logic
if (!name || name.trim() === '') {
  throw new Error('Name is required')
}

if (rating && (parseFloat(rating) < 0 || parseFloat(rating) > 5)) {
  throw new Error('Rating must be between 0 and 5')
}

// Direct Supabase insert (no type safety)
const { data, error } = await supabase.from('vendors').insert([{ name, rating /* ... */ }])
```

### After (Zod Validation)

```javascript
// Single source of truth - validation happens automatically
const result = await vendorService.create({
  name,
  rating,
  // TypeScript/JSDoc provides autocomplete for all fields
})
// Zod schema validates:
// - name is required and non-empty
// - rating is between 0 and 5
// - all fields match Supabase schema
```

## Migration Strategy

For existing code:

1. **Service layer first**: Use new typed functions (`vendorService.create()`, `jobService.createTyped()`)
2. **Forms later**: Gradually refactor forms to react-hook-form + zodResolver
3. **Preserve behavior**: Keep existing autosave, debounce, and UX patterns

## Important Notes

- **NO schema changes via Drizzle**: All migrations must go through `supabase/migrations`
- **Drizzle is for types only**: We use `drizzle-kit generate` to validate schema, but never push changes
- **Keep tenant scoping**: All service functions respect `orgId` filtering per Section 2 guardrails
- **Backward compatible**: New typed functions coexist with existing code

## Related Files

- `src/db/schema.ts` - Drizzle table definitions
- `src/db/schemas.ts` - Generated Zod schemas
- `drizzle.config.ts` - Drizzle configuration
- `.github/copilot-instructions.md` Section 20 - Complete schema & forms canon

## Scripts

```bash
# Validate schema compiles
pnpm drizzle:generate

# Open Drizzle Studio (read-only exploration)
pnpm drizzle:studio
```
