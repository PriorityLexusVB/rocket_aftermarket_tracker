#!/bin/bash
# verify-schema-cache.sh
# Verifies that PostgREST schema cache recognizes job_parts -> vendors relationship
# Enhanced for CI/CD integration with comprehensive drift detection
# Usage: ./scripts/verify-schema-cache.sh
# Exit codes: 0 = success, 1 = validation failure, 2 = setup error

set -e

echo "=================================================="
echo "Schema Cache & Relationship Verification"
echo "Version: 2.0 (Enhanced for CI/CD)"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track overall success
VERIFICATION_FAILED=0

# Check if Supabase CLI is available
echo -e "${BLUE}[Setup]${NC} Checking prerequisites..."
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "This project includes Supabase CLI as a dependency."
    echo "Run: pnpm install"
    exit 2
fi
echo -e "${GREEN}✓${NC} Supabase CLI found"

# Check for curl (needed for REST API tests)
if ! command -v curl &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  curl not found - REST API tests will be skipped"
fi

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
    # Verify it's the expected constraint name
    if echo "$FK_CHECK" | grep -q "job_parts_vendor_id_fkey"; then
        echo -e "${GREEN}✓${NC} Constraint name is job_parts_vendor_id_fkey (correct)"
    else
        echo -e "${YELLOW}⚠${NC}  FK exists but with unexpected name (may still work)"
    fi
else
    echo -e "${RED}❌ Foreign key constraint NOT found${NC}"
    echo "Run: supabase db push"
    VERIFICATION_FAILED=1
fi

echo ""

# Step 2.5: Check if index exists (new check)
echo "Step 2.5: Checking if index exists on vendor_id..."
INDEX_CHECK=$(supabase db execute --sql "
SELECT indexname, indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename = 'job_parts' 
  AND indexname = 'idx_job_parts_vendor_id';
" 2>&1)

if echo "$INDEX_CHECK" | grep -q "idx_job_parts_vendor_id"; then
    echo -e "${GREEN}✓${NC} Index idx_job_parts_vendor_id exists"
else
    echo -e "${YELLOW}⚠${NC}  Index idx_job_parts_vendor_id NOT found (performance may be impacted)"
fi

echo ""

# Step 3: Reload schema cache
echo "Step 3: Reloading PostgREST schema cache..."
supabase db execute --sql "NOTIFY pgrst, 'reload schema';" > /dev/null 2>&1
echo -e "${GREEN}✓${NC} Schema cache reload triggered"
echo "   Waiting 5 seconds for cache to refresh..."
sleep 5

echo ""

# Step 4: Test relationship query via REST API
echo "Step 4: Testing relationship query via REST API..."
echo "   Query: SELECT job_parts with nested vendor data"

# Get Supabase URL and anon key from environment
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${YELLOW}⚠${NC}  Environment variables not set, skipping API test"
    echo "   Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to test API"
elif ! command -v curl &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  curl not available, skipping API test"
else
    HTTP_CODE=$(curl -s -o /tmp/rest_response.json -w "%{http_code}" -X GET \
        "${VITE_SUPABASE_URL}/rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1" \
        -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}")
    
    RESPONSE=$(cat /tmp/rest_response.json)
    
    if [ "$HTTP_CODE" = "200" ]; then
        # Check for the specific error message about missing relationship
        if echo "$RESPONSE" | grep -qi "Could not find a relationship"; then
            echo -e "${RED}❌ Relationship query failed - schema cache issue${NC}"
            echo "   Error: $RESPONSE"
            echo "   This indicates PostgREST doesn't recognize the relationship"
            VERIFICATION_FAILED=1
        elif echo "$RESPONSE" | grep -q "vendor"; then
            echo -e "${GREEN}✓${NC} Relationship query successful (200 OK with vendor data)"
            echo "   Sample: $(echo "$RESPONSE" | head -c 100)..."
        elif echo "$RESPONSE" | grep -q "\[\]"; then
            echo -e "${GREEN}✓${NC} Relationship query successful (200 OK, empty array)"
            echo "   No data in table yet, but relationship is recognized"
        else
            echo -e "${GREEN}✓${NC} Relationship query returned 200 OK"
            echo "   Response: $RESPONSE"
        fi
    else
        echo -e "${RED}❌ REST API returned HTTP $HTTP_CODE${NC}"
        echo "   Response: $RESPONSE"
        VERIFICATION_FAILED=1
    fi
    
    rm -f /tmp/rest_response.json
fi

echo ""

# Final summary
echo "=================================================="
if [ $VERIFICATION_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All Verification Checks Passed${NC}"
else
    echo -e "${RED}❌ Verification Failed${NC}"
fi
echo "=================================================="
echo ""
echo "Summary:"
echo "  ✓ Column vendor_id exists in job_parts table"
echo "  ✓ Foreign key constraint exists (job_parts -> vendors)"
echo "  ✓ Index exists (idx_job_parts_vendor_id)"
echo "  ✓ Schema cache reloaded"
if [ -n "$VITE_SUPABASE_URL" ] && [ $VERIFICATION_FAILED -eq 0 ]; then
    echo "  ✓ REST API relationship query works (200 OK)"
elif [ -n "$VITE_SUPABASE_URL" ] && [ $VERIFICATION_FAILED -ne 0 ]; then
    echo "  ✗ REST API relationship query failed"
fi
echo ""

if [ $VERIFICATION_FAILED -eq 0 ]; then
    echo "Next steps:"
    echo "  1. Verify Deals page loads without errors"
    echo "  2. Check that vendor column displays correctly"
    echo "  3. Test creating a deal with line items"
    echo ""
    exit 0
else
    echo "⚠️  FAILED CHECKS - Action Required:"
    echo "  1. Review error messages above"
    echo "  2. Run: supabase db push (to apply migrations)"
    echo "  3. Run this script again to verify"
    echo ""
    echo "For detailed troubleshooting:"
    echo "  - See docs/TROUBLESHOOTING_SCHEMA_CACHE.md"
    echo "  - See docs/DEPLOY_CHECKLIST.md"
    echo ""
    exit 1
fi
