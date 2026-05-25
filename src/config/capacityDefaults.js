// Wave XXX-U: shared capacity defaults so vendor-load math can be tuned
// from one place. Previously hard-coded as a const inside VendorLaneView.jsx
// (calendar-flow-specialist NEW found it during the post-Wave-XXX audit).

/**
 * Default booked-deals-per-day capacity for an off-site vendor bay.
 * Used by VendorLaneView capacity bars and RoundUp utilization math.
 * Tune per-vendor when `vendors.daily_capacity` surfaces as a column.
 */
export const DEFAULT_VENDOR_CAPACITY_PER_DAY = 7
