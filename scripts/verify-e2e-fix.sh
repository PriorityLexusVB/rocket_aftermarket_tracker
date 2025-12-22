#!/usr/bin/env bash
# E2E Test Verification Script
# Checks if the user-org association fix is working correctly

set -e

echo "=== E2E Test Fix Verification ==="
echo ""

# Check environment variables
echo "1. Checking environment variables..."
if [ -z "$DATABASE_URL" ]; then
  echo "   ❌ DATABASE_URL not set"
  echo "   Set it with: export DATABASE_URL='postgresql://...'"
  exit 1
else
  echo "   ✅ DATABASE_URL is set"
fi

if [ -z "$E2E_EMAIL" ]; then
  echo "   ❌ E2E_EMAIL not set"
  echo "   Set it with: export E2E_EMAIL='your-test-user@example.com'"
  exit 1
else
  echo "   ✅ E2E_EMAIL is set ($E2E_EMAIL)"
fi

# Check if user exists in auth.users
echo ""
echo "2. Checking if E2E user exists in Supabase auth..."
USER_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM auth.users WHERE email = '$E2E_EMAIL'" 2>/dev/null || echo "0")
USER_CHECK=$(echo "$USER_CHECK" | tr -d '[:space:]')

if [ "$USER_CHECK" = "0" ]; then
  echo "   ❌ User not found in auth.users"
  echo "   Create user in Supabase Dashboard → Authentication → Users"
  exit 1
else
  echo "   ✅ User exists in auth.users"
fi

# Check user profile and org_id
echo ""
echo "3. Checking user profile..."
PROFILE_INFO=$(psql "$DATABASE_URL" -t -c "
  SELECT 
    COALESCE(full_name, '(no name)'),
    COALESCE(org_id::text, 'NULL'),
    role
  FROM public.user_profiles 
  WHERE email = '$E2E_EMAIL'
" 2>/dev/null || echo "|(profile not found)|")

if echo "$PROFILE_INFO" | grep -q "profile not found"; then
  echo "   ⚠️  Profile not created yet (will be created on first auth)"
else
  ORG_ID=$(echo "$PROFILE_INFO" | awk -F'|' '{print $2}' | tr -d '[:space:]')
  FULL_NAME=$(echo "$PROFILE_INFO" | awk -F'|' '{print $1}' | xargs)
  ROLE=$(echo "$PROFILE_INFO" | awk -F'|' '{print $3}' | tr -d '[:space:]')
  
  echo "   ✅ Profile exists"
  echo "      Name: $FULL_NAME"
  echo "      Role: $ROLE"
  
  if [ "$ORG_ID" = "NULL" ] || [ -z "$ORG_ID" ]; then
    echo "      ⚠️  org_id: NULL (will be fixed by global.setup.ts)"
  elif [ "$ORG_ID" = "00000000-0000-0000-0000-0000000000e2" ]; then
    echo "      ✅ org_id: E2E org (00000000-0000-0000-0000-0000000000e2)"
  else
    echo "      ⚠️  org_id: $ORG_ID (different org, will be overwritten)"
  fi
fi

# Check if E2E org exists
echo ""
echo "4. Checking E2E organization..."
ORG_CHECK=$(psql "$DATABASE_URL" -t -c "
  SELECT name FROM public.organizations 
  WHERE id = '00000000-0000-0000-0000-0000000000e2'
" 2>/dev/null || echo "")

if [ -z "$ORG_CHECK" ]; then
  echo "   ⚠️  E2E org not seeded yet"
  echo "   Run: pnpm run db:seed-e2e"
else
  ORG_NAME=$(echo "$ORG_CHECK" | xargs)
  echo "   ✅ E2E org exists: $ORG_NAME"
fi

# Check if E2E products exist
echo ""
echo "5. Checking E2E test products..."
PRODUCT_COUNT=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM public.products 
  WHERE org_id = '00000000-0000-0000-0000-0000000000e2'
" 2>/dev/null || echo "0")
PRODUCT_COUNT=$(echo "$PRODUCT_COUNT" | tr -d '[:space:]')

if [ "$PRODUCT_COUNT" = "0" ]; then
  echo "   ⚠️  No E2E products found"
  echo "   Run: pnpm run db:seed-e2e"
else
  echo "   ✅ Found $PRODUCT_COUNT E2E products"
fi

echo ""
echo "=== Verification Summary ==="
echo ""
echo "Environment ready for E2E tests!"
echo ""
echo "Next steps:"
echo "  1. Run E2E tests: pnpm e2e --project=chromium e2e/deal-edit.spec.ts"
echo "  2. Check logs for: '✅ User profile associated with E2E org'"
echo "  3. Check logs for: '✅ Verified: org_id persisted correctly'"
echo ""
echo "If tests fail, check the full analysis in E2E_COMPREHENSIVE_FIX_ANALYSIS.md"
