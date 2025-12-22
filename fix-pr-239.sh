#!/bin/bash
# Fix PR #239 E2E test failures by rebasing on latest main
# This script creates a new branch with PR #239 changes on top of main

set -e  # Exit on error

echo "============================================"
echo "Fix PR #239: Rebase on Latest Main"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check we're in the repo root
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from repository root${NC}"
    exit 1
fi

echo "Step 1: Fetch latest changes..."
git fetch origin main
git fetch origin copilot/fix-action-failure-issue

echo ""
echo "Step 2: Create new branch from latest main..."
git checkout main
git pull origin main
git checkout -b fix/pr-239-rebased-$(date +%Y%m%d-%H%M%S)

BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
echo -e "${GREEN}Created branch: ${BRANCH_NAME}${NC}"

echo ""
echo "Step 3: Apply PR #239 changes..."
# Apply the diff from PR #239
git diff origin/main origin/copilot/fix-action-failure-issue | git apply

if [ $? -ne 0 ]; then
    echo -e "${RED}Error applying changes${NC}"
    echo "You may need to resolve conflicts manually"
    exit 1
fi

echo ""
echo "Step 4: Stage changes..."
git add -A

echo ""
echo "Step 5: Commit changes..."
git commit -m "Fix CI workflow: Correct secret names and add schema cache reload (rebased on main)

This commit applies all changes from PR #239 on top of the latest main branch,
which includes recent E2E authentication fixes that were missing in the original
PR branch due to 'unrelated histories' (grafted branch).

Changes:
- Fix .github/workflows/rls-drift-nightly.yml secret names
- Add migration to reload PostgREST schema cache  
- Add comprehensive documentation for the CI fix

This should resolve the E2E test failures seen in the original PR #239.

Original PR: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/pull/239
"

echo ""
echo "============================================"
echo -e "${GREEN}Success!${NC}"
echo "============================================"
echo ""
echo "New branch created: ${BRANCH_NAME}"
echo ""
echo "Next steps:"
echo "  1. Push the branch: git push origin ${BRANCH_NAME}"
echo "  2. Create a new PR from ${BRANCH_NAME}"
echo "  3. Wait for E2E tests to pass"
echo "  4. Close PR #239 (mention new PR number)"
echo "  5. Merge the new PR"
echo ""
echo -e "${YELLOW}Note: You'll need to push using report_progress or have direct push access${NC}"
echo ""
