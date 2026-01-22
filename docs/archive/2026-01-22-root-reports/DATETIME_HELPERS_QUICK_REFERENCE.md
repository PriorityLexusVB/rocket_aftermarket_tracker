# Date/Time Input Helpers - Quick Reference

## When to Use These Helpers

### Problem: HTML date/time inputs showing blank values

If you see this warning in console:

```
The specified value '2025-12-12T18:35:00+00:00' does not conform to the required format
```

**Solution**: Use our helper functions!

---

## Helper Functions

### `toDateInputValue(isoOrDate)`

**Purpose**: Convert ISO datetime → YYYY-MM-DD format for `<input type="date">`

**Import**:

```javascript
import { toDateInputValue } from '../utils/dateTimeUtils'
```

**Usage**:

```jsx
// ❌ WRONG - Passing ISO string directly
<input
  type="date"
  value={job?.eta_return_date}  // "2025-12-12T18:35:00+00:00"
/>

// ✅ CORRECT - Convert to proper format
<input
  type="date"
  value={toDateInputValue(job?.eta_return_date)}  // "2025-12-12"
/>
```

**Returns**:

- `"YYYY-MM-DD"` format string
- Empty string `""` if input is null/undefined/invalid

---

### `toTimeInputValue(isoOrDate)`

**Purpose**: Convert ISO datetime → HH:mm format for `<input type="time">`

**Import**:

```javascript
import { toTimeInputValue } from '../utils/dateTimeUtils'
```

**Usage**:

```jsx
// ❌ WRONG - Passing ISO string directly
<input
  type="time"
  value={item?.scheduled_start_time}  // "2025-12-12T18:35:00Z"
/>

// ✅ CORRECT - Convert to proper format
<input
  type="time"
  value={toTimeInputValue(item?.scheduled_start_time)}  // "13:35" (in ET)
/>
```

**Returns**:

- `"HH:mm"` format string in America/New_York timezone
- Empty string `""` if input is null/undefined/invalid

---

## Reverse Conversion (Form → Database)

### `combineDateAndTime(dateStr, timeStr)`

**Purpose**: Merge separate date and time inputs back into ISO datetime for database

**Import**:

```javascript
import { combineDateAndTime } from '../utils/dateTimeUtils'
```

**Usage**:

```javascript
// Form state
const dateScheduled = '2025-12-12' // From <input type="date">
const scheduledStartTime = '13:35' // From <input type="time">

// Convert for database save
const scheduledStartIso = combineDateAndTime(dateScheduled, scheduledStartTime)
// Returns: "2025-12-12T18:35:00.000Z" (UTC)

// Save to database
await supabase.from('job_parts').update({ scheduled_start_time: scheduledStartIso })
```

**Returns**:

- ISO datetime string in UTC
- `null` if either input is missing/invalid

---

## Common Use Cases

### 1. Editing a Deal with Loaner

```javascript
// Load from database
const [loanerReturnDate, setLoanerReturnDate] = useState(
  toDateInputValue(job?.eta_return_date) || ''
)

// Render
<input
  type="date"
  value={loanerReturnDate}
  onChange={(e) => setLoanerReturnDate(e.target.value)}
/>

// Save to database
await saveDeal({
  eta_return_date: loanerReturnDate  // "2025-12-15" is valid for DATE column
})
```

### 2. Editing Line Item Schedule

```javascript
// Load from database
const [dateScheduled, setDateScheduled] = useState(
  toDateInputValue(item?.promised_date) || ''
)
const [startTime, setStartTime] = useState(
  toTimeInputValue(item?.scheduled_start_time) || ''
)
const [endTime, setEndTime] = useState(
  toTimeInputValue(item?.scheduled_end_time) || ''
)

// Render
<input type="date" value={dateScheduled} onChange={...} />
<input type="time" value={startTime} onChange={...} />
<input type="time" value={endTime} onChange={...} />

// Save to database
const scheduledStartIso = combineDateAndTime(dateScheduled, startTime)
const scheduledEndIso = combineDateAndTime(dateScheduled, endTime)

await supabase
  .from('job_parts')
  .update({
    scheduled_start_time: scheduledStartIso,
    scheduled_end_time: scheduledEndIso
  })
```

### 3. Appointment Window

```javascript
// Load appointment data
const apptDate = toDateInputValue(appointment?.scheduled_start_time)
const apptStartTime = toTimeInputValue(appointment?.scheduled_start_time)
const apptEndTime = toTimeInputValue(appointment?.scheduled_end_time)

// Display in form
<input type="date" value={apptDate} />
<input type="time" value={apptStartTime} />
<input type="time" value={apptEndTime} />
```

---

## Timezone Handling

**Storage**: All datetimes stored in **UTC** in database  
**Display**: Times shown in **America/New_York** (Eastern Time)

**Conversion happens automatically**:

- `toTimeInputValue()` converts UTC → ET
- `combineDateAndTime()` converts ET → UTC

**Example**:

```javascript
// Database: "2025-12-12T18:35:00Z" (UTC)
toTimeInputValue('2025-12-12T18:35:00Z')
// → "13:35" (ET, which is UTC-5 in winter)

// User enters: date="2025-12-12", time="13:35" (ET)
combineDateAndTime('2025-12-12', '13:35')
// → "2025-12-12T18:35:00.000Z" (UTC)
```

---

## Error Handling

All helpers return safe defaults:

```javascript
toDateInputValue(null) // ""
toDateInputValue(undefined) // ""
toDateInputValue('invalid') // ""

toTimeInputValue(null) // ""
toTimeInputValue(undefined) // ""
toTimeInputValue('invalid') // ""

combineDateAndTime('', '13:35') // null
combineDateAndTime('2025-12-12', '') // null
```

**Safe to use with controlled inputs**:

```jsx
<input
  type="date"
  value={toDateInputValue(someValue) || ''} // Always string, never undefined
/>
```

---

## Testing

Test file: `src/tests/dateTimeUtils.inputHelpers.test.js`

Run tests:

```bash
pnpm test src/tests/dateTimeUtils.inputHelpers.test.js
```

Example tests:

```javascript
test('converts ISO datetime to YYYY-MM-DD format', () => {
  const result = toDateInputValue('2025-12-12T18:35:00+00:00')
  expect(result).toBe('2025-12-12')
})

test('converts ISO datetime to HH:mm format in ET', () => {
  const result = toTimeInputValue('2025-12-12T18:35:00Z')
  expect(result).toBe('13:35') // ET is UTC-5
})
```

---

## Checklist for New Date/Time Inputs

When adding a new date or time input field:

- [ ] Import helper function(s) at top of file
- [ ] Use `toDateInputValue()` for date columns
- [ ] Use `toTimeInputValue()` for time/timestamp columns
- [ ] Use `combineDateAndTime()` when saving separate date+time
- [ ] Test with actual data from database
- [ ] Check browser console for format warnings
- [ ] Verify timezone display is correct (should be ET)

---

## Common Mistakes to Avoid

### ❌ Don't pass ISO strings directly

```jsx
<input type="date" value={job?.eta_return_date} />
// Will show blank if value is "2025-12-12T18:35:00Z"
```

### ❌ Don't forget timezone conversion

```javascript
// Wrong: Treating UTC time as local time
const time = isoString.split('T')[1].slice(0, 5)
// This ignores timezone offset!
```

### ❌ Don't use deprecated helpers

```javascript
// Old way (don't use):
const date = new Date(iso).toISOString().split('T')[0]
// Doesn't handle timezones correctly

// New way (use this):
const date = toDateInputValue(iso)
```

### ✅ Do handle null/undefined gracefully

```jsx
<input
  type="date"
  value={toDateInputValue(job?.eta_return_date) || ''}
  // Fallback to empty string for controlled input
/>
```

---

## Browser Support

| Feature               | Chrome | Firefox | Safari   | Edge   |
| --------------------- | ------ | ------- | -------- | ------ |
| `<input type="date">` | ✅ 20+ | ✅ 57+  | ✅ 14.1+ | ✅ 12+ |
| `<input type="time">` | ✅ 20+ | ✅ 57+  | ✅ 14.1+ | ✅ 12+ |
| Format YYYY-MM-DD     | ✅     | ✅      | ✅       | ✅     |
| Format HH:mm          | ✅     | ✅      | ✅       | ✅     |

**All modern browsers fully supported** ✅

---

## Related Documentation

- [Date/Time Utils Source](../src/utils/dateTimeUtils.js)
- [Implementation Summary](./EDIT_DEAL_FIX_SUMMARY.md)
- [Visual Guide](./EDIT_DEAL_FIX_VISUAL_GUIDE.md)

---

## Quick Copy-Paste Templates

### Template: Date Input

```jsx
import { toDateInputValue } from '../utils/dateTimeUtils'

const [date, setDate] = useState(toDateInputValue(initialValue) || '')

<input
  type="date"
  value={date}
  onChange={(e) => setDate(e.target.value)}
/>
```

### Template: Time Input

```jsx
import { toTimeInputValue } from '../utils/dateTimeUtils'

const [time, setTime] = useState(toTimeInputValue(initialValue) || '')

<input
  type="time"
  value={time}
  onChange={(e) => setTime(e.target.value)}
/>
```

### Template: Date + Time to ISO

```jsx
import { combineDateAndTime } from '../utils/dateTimeUtils'

const iso = combineDateAndTime(dateValue, timeValue)
// Use iso in database save
```

---

**Need help?** Check the implementation in:

- `src/components/deals/DealFormV2.jsx` (lines 13, 66, 80-82, 157, 171-173)
- `src/pages/deals/components/LoanerDrawer.jsx` (lines 4, 22)

**Last Updated**: 2025-12-06
