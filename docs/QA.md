# Quality Assurance Testing Guide

## Critical Acceptance Tests

### Test 1: CSV Import Validation
**Objective**: Verify CSV import creates vehicles/work_orders/work_items correctly with stock-first deduplication

**Steps**:
1. Navigate to Admin → CSV Import tab
2. Upload the sample CSV file (`data/aftermarket_sample.csv`)
3. Review the preview showing column mapping
4. Click "Process Import"
5. Wait for completion message

**Expected Results**:
- 10 unique vehicles created (by stock number)
- 10 work orders created (one per row)
- Multiple work items created for rows with comma-separated services
- No duplicate vehicles for same stock number
- Success message shows counts: "Successfully imported X vehicles and Y jobs"

**Verification Points**:
- Go to Vehicles page and search for stock "P12345" - should find exactly one result
- Go to Calendar page and verify appointments appear for imported dates
- Check that work orders show correct customer information

---

### Test 2: Stock-First Search Functionality
**Objective**: Verify stock-exact search prioritizes exact matches, partial search shows stock-first results

**Steps**:
1. Go to Vehicles page (auto-focuses search)
2. Type exact stock number "P12345"
3. Verify results show exact match first
4. Clear search and type partial "P123"
5. Verify results show all stocks starting with "P123" ordered by stock number

**Expected Results**:
- Exact search returns single result immediately
- Partial search returns multiple results in stock-number order
- Search works from Calendar page stock search field
- Results include vehicle details and customer information

**Verification Points**:
- Exact match appears instantly without requiring Enter key
- Partial matches display stock numbers prominently
- Search is case-insensitive
- No results message appears for non-existent stock numbers

---

### Test 3: Deal to Schedule Integration
**Objective**: Verify Deals → Schedule creates appointment linked to work_item

**Steps**:
1. Go to Deals page
2. Find a pending work order
3. Click "Schedule" button next to work order
4. Should redirect to Calendar or open scheduling modal
5. Create appointment with date/time and vendor assignment
6. Save appointment

**Expected Results**:
- Appointment created with work order linkage
- Job status updates to "scheduled"
- Appointment appears on Calendar page
- Vehicle information carries forward correctly

**Verification Points**:
- New appointment visible in Calendar view
- Work order status changed from "pending" to "scheduled"
- Appointment shows correct vehicle stock number
- Vendor assignment saved correctly

---

### Test 4: Unassigned Queue Drag & Drop
**Objective**: Verify Unassigned → vendor lane drag saves assignment and recolors event

**Steps**:
1. Go to Calendar page
2. Verify unassigned jobs appear in right sidebar queue
3. Switch to "Resource" view to see vendor lanes
4. Drag unassigned job from queue to specific vendor lane
5. Drop job on available time slot

**Expected Results**:
- Job moves from unassigned queue to vendor schedule
- Job color changes to indicate vendor assignment
- Database updated with vendor_id assignment
- Job no longer appears in unassigned queue

**Verification Points**:
- Visual feedback during drag operation
- Color change after successful drop
- Vendor name appears on job card
- Unassigned count decreases by 1

---

### Test 5: Capacity and Schedule Validation
**Objective**: Verify capacity/hours/vehicle overlap guardrails block conflicts with clear messages

**Steps**:
1. Go to Admin → Vendors to verify vendor hours are set
2. Try to schedule job outside vendor working hours
3. Try to schedule overlapping appointments for same vendor
4. Try to double-book same vehicle at same time
5. Verify manager override toggle works (if admin/manager role)

**Expected Results**:
- Clear error messages for each conflict type
- Specific guidance on what conflicts were found
- Manager override option appears for admin/manager users
- Conflicts prevent scheduling unless overridden

**Verification Points**:
- "Vendor not available during requested time" message
- "Vendor already booked for this time slot" message  
- "Vehicle already has appointment at this time" message
- Override checkbox appears for authorized users

---

### Test 6: SMS Outbox Integration
**Objective**: Verify moving event enqueues "changed" SMS in notification_outbox

**Steps**:
1. Ensure test vehicle has valid phone number
2. Move existing appointment to different time/vendor
3. Check notification_outbox table for new SMS entry
4. Verify SMS message includes stock number and new appointment details

**Expected Results**:
- New row appears in notification_outbox table
- SMS message template includes {STOCK} placeholder
- Variables field contains stock number, date, time
- Status is "pending" awaiting edge function processing

**Verification Points**:
- Database query: `SELECT * FROM notification_outbox ORDER BY created_at DESC LIMIT 5`
- Message template starts with stock number variable
- Phone number matches vehicle owner phone
- Variables JSON contains all required placeholders

---

### Test 7: Completion SMS Workflow
**Objective**: Verify completion enqueues pickup SMS; No-show auto-triggers at T+15min

**Steps**:
1. Mark in-progress job as "completed"
2. Verify pickup SMS queued in notification_outbox
3. Create appointment scheduled 20 minutes ago
4. Wait for auto no-show trigger (or manually test trigger)
5. Verify no-show SMS queued

**Expected Results**:
- Completion triggers "ready for pickup" SMS
- No-show logic auto-updates status after 15 minutes
- Appropriate SMS templates used for each scenario
- Customer notifications include stock number first

**Verification Points**:
- Completion SMS: "Stock {STOCK} service complete! Ready for pickup..."
- No-show SMS: "Stock {STOCK} appointment missed. Please call to reschedule..."
- Status automatically changes to "no_show" after time threshold
- Multiple status changes don't create duplicate SMS

---

### Test 8: Vendor Access Control (RLS)
**Objective**: Verify vendor login sees only their assigned jobs

**Steps**:
1. Create vendor user account linked to specific vendor
2. Login as vendor user
3. Navigate to Calendar page
4. Verify only jobs assigned to that vendor are visible
5. Try to access jobs for other vendors

**Expected Results**:
- Vendor sees only their own assigned jobs
- Unassigned jobs are not visible to vendors
- Calendar shows appropriate vendor-filtered view
- No access to admin functions

**Verification Points**:
- Job count matches vendor assignment filter
- Cannot view other vendor's job details
- Admin tabs not accessible
- Vendor can update status of their own jobs only

---

## Test Environment Setup

### Required Test Data
- At least 3 vendors with different specialties
- 10+ vehicles with valid stock numbers
- Mix of job statuses across the workflow
- Valid phone numbers for SMS testing (use test numbers)

### User Accounts Needed
- Admin user (full access)
- Manager user (override permissions)  
- Staff user (basic operations)
- Vendor user (vendor-specific access)

### External Dependencies
- Twilio test credentials configured
- Edge functions deployed and accessible
- Database migrations applied
- Sample CSV file available

## Performance Benchmarks

### Response Time Targets
- Stock-first search: < 500ms for exact match
- Calendar load: < 2 seconds for week view
- CSV import: < 30 seconds for 100 records
- SMS processing: < 5 seconds per message

### Data Volume Expectations
- Support 10,000+ vehicles
- Handle 1,000+ daily appointments
- Process 500+ SMS messages per day
- Import CSV files up to 10MB

## Browser Compatibility
- Chrome 90+ (primary)
- Firefox 85+ (secondary)
- Safari 14+ (mobile testing)
- Edge 90+ (enterprise)

## Test Reporting Format

### Test Result Template
```
Test ID: QA-001
Test Name: CSV Import Validation
Status: PASS/FAIL
Date: YYYY-MM-DD
Tester: [Name]
Environment: [dev/staging/prod]

Details:
- Expected: [expected behavior]
- Actual: [actual behavior]
- Screenshots: [if applicable]
- Notes: [additional observations]
```

### Issue Severity Levels
- **Critical**: Blocks core functionality, data loss risk
- **High**: Major feature impacted, workaround exists
- **Medium**: Minor feature issue, easy workaround
- **Low**: Cosmetic issue, no functional impact