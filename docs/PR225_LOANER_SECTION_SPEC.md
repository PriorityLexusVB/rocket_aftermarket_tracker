# PR #225 — LoanerSection Shared Component Specification

## Goal
Stop CI/test breakage from loaner UI drift by standardizing all loaner UI (testids + behavior) across DealForm variants.

## Scope (must-do in PR #225)
- Create shared component: `src/components/deals/LoanerSection.jsx`
- Refactor BOTH:
  - `src/pages/deals/DealForm.jsx` (legacy)
  - `src/components/deals/DealFormV2.jsx`
- Also update any other deal/job UI that renders loaner checkbox/fields (search "loaner", "customer_needs_loaner", "loaner-checkbox").

No DB migrations. No RLS/Auth/Supabase policy changes.

---

## Required DOM Contract (MUST ALWAYS EXIST IN DOM)
LoanerSection MUST always render these elements (even when disabled):

### 1) Wrapper
```jsx
<div data-testid="loaner-section">...</div>
```
- Always rendered (unconditional)

### 2) Checkbox
```jsx
<input data-testid="loaner-checkbox" type="checkbox" />
```
- Always rendered + visible

### 3) Manage Button
```jsx
<button data-testid="manage-loaners-btn" type="button">Manage</button>
```
- Must exist unconditionally
- Behavior:
  - Disabled when loaner not enabled/checked
  - Enabled when loaner enabled/checked
  - On click: attempt `window.open('/loaner-management-drawer','_blank')`
    - If `window.open` returns null (popup blocked), fallback to `navigate('/loaner-management-drawer')`
    - If navigate function is not provided, fallback to `window.location.assign('/loaner-management-drawer')`

### 4) Loaner Number Input
```jsx
<input data-testid="loaner-number-input" />
```
- Must exist unconditionally
- Requirements:
  - placeholder EXACT: `"e.g. L-1024"`
  - Disabled when loaner not enabled/checked
  - Enabled when loaner enabled/checked
  - Controlled input (value + onChange)
  - Accept numeric-ish text (don't enforce strict numeric; tests type "62")

---

## Required Behaviors

### Manage Button Navigation
- Default `manageUrl = "/loaner-management-drawer"`
- On click:
  ```javascript
  const w = window.open(manageUrl, "_blank")
  if (w === null) {
    // Fallback 1: If navigate prop provided
    if (navigate) {
      navigate(manageUrl)
    } else {
      // Fallback 2: Direct navigation
      window.location.assign(manageUrl)
    }
  }
  ```

### Enable/Disable Rules
- If `props.disabled === true` → ALL controls disabled (checkbox, manage button, inputs)
- Else:
  - checkbox enabled
  - manage button + all loaner inputs disabled unless `props.enabled === true`

### Loaner Number Input Requirements
- placeholder EXACT: `"e.g. L-1024"`
- controlled `value` + `onChange`
- accept text (tests type `"62"`; do not enforce numeric-only)

---

## Optional Fields (include NOW for UX + future tests)

These optional fields should be included in LoanerSection to satisfy app UX. If included, they MUST:
- ALWAYS exist in DOM (like the required fields)
- Be disabled unless `enabled === true` (and `disabled === false`)

### 1) Expected Return Date Input
```jsx
<input data-testid="loaner-eta-input" type="date" />
```
- Controlled via props
- Always in DOM
- Disabled when loaner not enabled

### 2) Loaner Notes Input
```jsx
<input data-testid="loaner-notes-input" type="text" />
<!-- OR -->
<textarea data-testid="loaner-notes-input" />
```
- Controlled via props
- Always in DOM
- Disabled when loaner not enabled

---

## Props Interface

```typescript
interface LoanerSectionProps {
  // Required props
  enabled: boolean;                          // Is loaner checkbox checked?
  onEnabledChange: (next: boolean) => void;  // Checkbox onChange handler
  loanerNumber: string;                      // Loaner number value
  onLoanerNumberChange: (value: string) => void;  // Loaner number onChange

  // Optional fields
  expectedReturnDate?: string;               // Date value (YYYY-MM-DD format)
  onExpectedReturnDateChange?: (value: string) => void;
  notes?: string;                            // Notes value
  onNotesChange?: (value: string) => void;   // Notes onChange

  // Behavior customization
  manageUrl?: string;                        // Default: "/loaner-management-drawer"
  navigate?: (url: string) => void;          // React Router navigate function (optional)
  disabled?: boolean;                        // Disable all controls (default: false)

  // Styling (optional)
  className?: string;                        // Additional classes for wrapper
}
```

---

## Styling Requirements

### Disabled State
When inputs/buttons are disabled:
- Background: `bg-gray-100`
- Cursor: `cursor-not-allowed`
- Text opacity: maintain readability

### Layout
- Keep existing Tailwind classes from current implementations
- Grid/flex layouts should match current form structure
- Spacing between fields: maintain `mt-4` or similar from existing code

---

## Implementation Notes

### Component File
- Location: `src/components/deals/LoanerSection.jsx`
- Keep as `.jsx` (not `.tsx`) for minimal churn
- Export as default: `export default LoanerSection`

### Refactoring Strategy
1. Create `LoanerSection.jsx` with full contract
2. Update `DealForm.jsx` to use `<LoanerSection ... />`
3. Update `DealFormV2.jsx` to use `<LoanerSection ... />`
4. Map existing state/props to LoanerSection props interface
5. Remove duplicate loaner UI code from both forms

### Testing
- All existing loaner tests must pass without modification
- Tests expect elements to always exist in DOM
- Tests verify `disabled` property for enable/disable state

---

## Success Criteria

- ✅ `LoanerSection.jsx` created with exact DOM contract
- ✅ Both DealForm.jsx and DealFormV2.jsx refactored to use it
- ✅ All loaner-related tests pass (loanerManagement, loanerToggle, etc.)
- ✅ All 921+ tests pass
- ✅ Build succeeds with no errors
- ✅ No duplicate loaner UI code in forms
- ✅ Manage button behavior works (window.open + fallbacks)
- ✅ All test IDs present and correct in both forms
