-- Add indexes to speed loaner-based views and searches
-- Safe-guard with IF NOT EXISTS

-- Index for active loaners by due date (for Due Today / Overdue views)
CREATE INDEX IF NOT EXISTS loaner_assignments_active_due_date_idx
ON public.loaner_assignments (eta_return_date)
WHERE returned_at IS NULL;

-- Index to speed lookups by loaner number
CREATE INDEX IF NOT EXISTS loaner_assignments_loaner_number_idx
ON public.loaner_assignments (loaner_number);
