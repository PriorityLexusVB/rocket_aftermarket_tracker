# Schema Drift Detection - Fix Summary

## Problem

The nightly RLS drift check workflow was failing with the following issues:

1. **Vite Dev Server Issue**: When the workflow started the dev server with `pnpm dev` and accessed `http://localhost:5173/api/health-deals-rel`, it received the raw transpiled JavaScript source code instead of JSON response.

2. **API Handler Incompatibility**: The health endpoint handlers used Express-style `res.status().json()` syntax which doesn't work with Node.js http module's response object.

3. **Insufficient Schema Checks**: The `checkColumnExists()` and `checkFkExists()` functions were too simplistic and didn't properly detect schema state.

## Root Cause

- Vite doesn't automatically serve `/api/*` routes during development - these are meant to be Vercel serverless functions in production
- The workflow needed a way to serve these endpoints during CI testing
- API handlers needed to support both Vercel (Express-like) and Node.js (http module) response objects

## Solution

### 1. Vite API Plugin (`vite-plugin-api.js`)

Created a Vite plugin that:
- Intercepts requests to `/api/*` routes
- Dynamically imports and executes the corresponding handler from the `/api/` directory
- Properly handles errors and returns JSON responses

```javascript
export function apiPlugin() {
  return {
    name: 'vite-plugin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next()
        }
        // Load and execute handler...
      })
    },
  }
}
```

### 2. Updated API Handlers

Modified both `/api/health-deals-rel.js` and `/src/api/health-deals-rel.js` to:

**Improved Column Detection:**
```javascript
async function checkColumnExists() {
  try {
    const { error } = await supabase.from('job_parts').select('vendor_id').limit(0)
    if (!error) return true
    // Check if it's a column not found error
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('vendor_id')) {
      return false
    }
    return null // Unknown - other error
  } catch {
    return null
  }
}
```

**Improved FK Detection:**
```javascript
async function checkFkExists() {
  try {
    // Test actual FK relationship expansion
    const { error } = await supabase
      .from('job_parts')
      .select('vendor:vendor_id(id)')
      .limit(0)
    if (!error) return true
    // Check if it's a relationship/FK error
    if (error.message?.includes('relationship') || error.message?.includes('foreign key')) {
      return false
    }
    return null
  } catch {
    return null
  }
}
```

**Dual Response Object Support:**
```javascript
// Handle both Express-like and Node.js http response objects
if (typeof res.status === 'function') {
  return res.status(200).json(response)
} else {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(response))
}
```

### 3. Updated Vite Configuration

Added the API plugin to `vite.config.mjs`:
```javascript
import { apiPlugin } from './vite-plugin-api.js'

export default defineConfig({
  plugins: [react(), apiPlugin()],
  // ...
})
```

## Verification

### Local Testing
```bash
# Start dev server
pnpm dev

# In another terminal, test the endpoint
curl http://localhost:5173/api/health-deals-rel
```

Expected response:
```json
{
  "ok": true,
  "classification": "ok",
  "hasColumn": true,
  "hasFk": true,
  "fkName": "job_parts_vendor_id_fkey",
  "cacheRecognized": true,
  "restQueryOk": true,
  "rowsChecked": 1,
  "ms": 514
}
```

### CI Testing

The workflow now properly executes the health endpoint and checks for:
- `"ok":true` - Overall health status
- Column existence detection
- FK relationship detection
- Cache recognition
- REST query success

## Test Automation

Added integration tests at `tests/integration/schema-drift.test.js` to verify:
- Endpoint returns correct JSON structure
- Healthy state is properly detected
- Error classifications are correct
- Diagnostic information is included
- Response time is reasonable

Run tests with:
```bash
# Requires dev server running
pnpm test tests/integration/schema-drift.test.js
```

## Files Changed

1. `/api/health-deals-rel.js` - Vercel serverless function handler
2. `/src/api/health-deals-rel.js` - Vite app handler (for reference)
3. `/vite-plugin-api.js` - New Vite plugin for API routes
4. `/vite.config.mjs` - Updated to use API plugin
5. `/tests/integration/schema-drift.test.js` - New integration tests

## Migration Notes

The migrations that add the `vendor_id` column and FK constraint are:
- `20251106000000_add_job_parts_vendor_id.sql`
- `20251107000000_fix_job_parts_vendor_fkey.sql`
- `20251107093000_verify_job_parts_vendor_fk.sql`

All include `NOTIFY pgrst, 'reload schema'` at the end to ensure PostgREST recognizes the relationship.

## Troubleshooting

If the health check still fails:

1. **Check Supabase Connection**: Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
2. **Verify Migrations**: Run `NOTIFY pgrst, 'reload schema';` in Supabase SQL editor
3. **Check Column Exists**: 
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'job_parts' AND column_name = 'vendor_id';
   ```
4. **Check FK Exists**:
   ```sql
   SELECT conname FROM pg_constraint 
   WHERE conname = 'job_parts_vendor_id_fkey';
   ```

## Future Improvements

- Add RPC functions for direct schema introspection instead of heuristics
- Add more granular error detection for different PostgREST error codes
- Expand tests to cover simulated drift scenarios
- Add metrics/telemetry for health check timing and failures
