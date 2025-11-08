# Known Issues & Status

## Current Issues

### Issue #1: Authentication Spinner Persists

**Status**: Active
**Severity**: Medium
**Affected Component**: LoginForm component

**Description**:
Loading spinner sometimes continues after successful authentication, requiring page refresh.

**Reproduction Steps**:

1. Navigate to login page
2. Enter valid credentials
3. Click "Sign In"
4. Observe spinner continues even after successful login
5. Manual page refresh required to see authenticated state

**Workaround**:
Refresh page manually after login if spinner persists > 3 seconds

**Root Cause**:
Likely race condition between auth state update and loading state management

**Planned Fix**:
Review auth state management in LoginForm.jsx, ensure proper cleanup of loading states

---

### Issue #2: Calendar Date Range Loading

**Status**: Investigating  
**Severity**: High
**Affected Component**: Calendar page date range queries

**Description**:
Calendar occasionally shows empty results when switching between date ranges, especially month boundaries.

**Reproduction Steps**:

1. Open Calendar page in week view
2. Navigate to last week of month
3. Click next week to cross month boundary
4. Observe appointments may not load for new month
5. Refresh page shows correct appointments

**Workaround**:
Refresh page when appointments don't appear after date navigation

**Root Cause**:
Possible timezone conversion issue in date range calculations or UTC/EST boundary handling

**Planned Fix**:

- Review date range calculation logic
- Ensure consistent timezone handling
- Add proper loading states for date transitions

---

### Issue #3: Kanban Drag Performance

**Status**: Planning
**Severity**: Low
**Affected Component**: Deals page Kanban view

**Description**:
Dragging items between Kanban columns occasionally shows lag on larger datasets (>100 work orders).

**Reproduction Steps**:

1. Go to Deals page with 100+ work orders
2. Switch to Kanban view
3. Try dragging work order between status columns
4. Notice delayed visual feedback
5. Performance degrades with more items

**Workaround**:
Use table view for large datasets, or filter by date range to reduce item count

**Root Cause**:
Inefficient re-rendering of all Kanban items during drag operations

**Planned Fix**:

- Implement virtualization for large lists
- Optimize drag operation to only re-render affected columns
- Add pagination or lazy loading for Kanban view

---

### Issue #4: Stock Search Case Sensitivity

**Status**: Fixed in v1.1
**Severity**: Medium
**Affected Component**: Stock-first search across application

**Description**:
Stock number searches were case-sensitive, causing missed results for lowercase entries.

**Reproduction Steps**:

1. Search for stock "p12345" (lowercase)
2. No results found
3. Search for "P12345" (uppercase)
4. Results appear correctly

**Resolution Applied**:

- Added `lower()` index on vehicles.stock_number
- Updated search queries to use case-insensitive comparison
- Applied fix to all stock search components

---

### Issue #5: SMS Character Limit Overflow

**Status**: Fixed in v1.0
**Severity**: High
**Affected Component**: SMS template processing

**Description**:
Long customer names or service descriptions caused SMS messages to exceed 160 character limit.

**Resolution Applied**:

- Added automatic truncation with "..." for messages >157 characters
- Implemented character count validation in edge functions
- Updated SMS templates to prioritize critical information (stock number first)

---

## Performance Monitoring

### Current Metrics

- **Average Page Load**: 2.1 seconds
- **Stock Search Response**: 340ms average
- **Calendar Rendering**: 1.8 seconds (week view)
- **CSV Import Processing**: 15 seconds/100 records

### Target Improvements

- Reduce calendar rendering to <1 second
- Optimize stock search to <200ms
- Implement progressive loading for large datasets

## Testing Status

### Browser Compatibility

- ✅ Chrome 90+ (fully tested)
- ✅ Firefox 85+ (core features tested)
- ⚠️ Safari 14+ (known calendar styling issues)
- ✅ Edge 90+ (tested on Windows)

### Mobile Responsiveness

- ✅ Calendar page responsive design
- ⚠️ Admin page tables need horizontal scroll optimization
- ✅ Vehicle search mobile-friendly
- ⚠️ Kanban view needs mobile layout improvements

## Issue Reporting Template

When reporting new issues, please include:

1. **Environment**: dev/staging/production
2. **Browser**: Chrome/Firefox/Safari + version
3. **User Role**: admin/manager/staff/vendor
4. **Steps to Reproduce**: Detailed steps
5. **Expected vs Actual**: What should happen vs what does happen
6. **Screenshots**: If visual issue
7. **Console Errors**: Any JavaScript errors in browser console

## Escalation Process

### Severity Definitions

- **Critical**: Data loss, security breach, system down
- **High**: Core feature broken, major workflow impacted
- **Medium**: Feature partially working, workaround available
- **Low**: Minor issue, cosmetic problem

### Response Times

- **Critical**: Immediate response, fix within 4 hours
- **High**: Response within 2 hours, fix within 24 hours
- **Medium**: Response within 8 hours, fix within 1 week
- **Low**: Response within 2 days, fix in next release

## Release Notes

### Version 1.1 (Current)

- Fixed case-sensitive stock search
- Improved calendar date range handling
- Added better error messages for SMS failures
- Enhanced CSV import validation

### Version 1.0 (Previous)

- Initial 4-page consolidation
- Stock-first search implementation
- SMS notification system
- CSV import functionality
- Vendor capacity management
