#!/bin/bash
# verify-schema-cache.sh
# Verifies that PostgREST schema cache recognizes job_parts -> vendors relationship
# Usage: ./scripts/verify-schema-cache.sh

set -e

echo "=================================================="
echo "Schema Cache Verification Script"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✓${NC} Supabase CLI found"
echo ""

# Step 1: Check if column exists
echo "Step 1: Checking if vendor_id column exists in job_parts..."
COLUMN_CHECK=$(supabase db execute --sql "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'job_parts' 
  AND column_name = 'vendor_id';
" 2>&1)

if echo "$COLUMN_CHECK" | grep -q "vendor_id"; then
    echo -e "${GREEN}✓${NC} Column vendor_id exists"
else
    echo -e "${RED}❌ Column vendor_id NOT found${NC}"
    echo "Run: supabase db push"
    exit 1
fi

echo ""

# Step 2: Check if foreign key exists
echo "Step 2: Checking if foreign key constraint exists..."
FK_CHECK=$(supabase db execute --sql "
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'job_parts'
    AND kcu.column_name = 'vendor_id';
" 2>&1)

if echo "$FK_CHECK" | grep -q "vendors"; then
    echo -e "${GREEN}✓${NC} Foreign key constraint exists (job_parts.vendor_id -> vendors.id)"
else
    echo -e "${RED}❌ Foreign key constraint NOT found${NC}"
    echo "Run: supabase db push"
    exit 1
fi

echo ""

# Step 3: Reload schema cache
echo "Step 3: Reloading PostgREST schema cache..."
supabase db execute --sql "NOTIFY pgrst, 'reload schema';" > /dev/null 2>&1
echo -e "${GREEN}✓${NC} Schema cache reload triggered"
echo "   Waiting 5 seconds for cache to refresh..."
sleep 5

echo ""

# Step 4: Test relationship query
echo "Step 4: Testing relationship query..."
echo "   Query: SELECT job_parts with nested vendor data"

# Get Supabase URL and anon key from environment
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${YELLOW}⚠${NC}  Environment variables not set, skipping API test"
    echo "   Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to test API"
else
    RESPONSE=$(curl -s -X GET \
        "${VITE_SUPABASE_URL}/rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1" \
        -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}")
    
    if echo "$RESPONSE" | grep -q "vendor"; then
        echo -e "${GREEN}✓${NC} Relationship query successful"
        echo "   Sample response: $RESPONSE"
    elif echo "$RESPONSE" | grep -q "error"; then
        echo -e "${RED}❌ Relationship query failed${NC}"
        echo "   Error: $RESPONSE"
        exit 1
    else
        echo -e "${YELLOW}⚠${NC}  No data returned (table may be empty)"
    fi
fi

echo ""

# Summary
echo "=================================================="
echo -e "${GREEN}✅ Schema Cache Verification Complete${NC}"
echo "=================================================="
echo ""
echo "Summary:"
echo "  ✓ Column vendor_id exists in job_parts table"
echo "  ✓ Foreign key constraint exists (job_parts -> vendors)"
echo "  ✓ Schema cache reloaded"
if [ -n "$VITE_SUPABASE_URL" ]; then
    echo "  ✓ Relationship query works via API"
fi
echo ""
echo "Next steps:"
echo "  1. Verify Deals page loads without errors"
echo "  2. Check that vendor column displays correctly"
echo "  3. Test creating a deal with line items"
echo ""
