-- Prevent exact duplicate job_parts rows for the same job + product + vendor + schedule
-- Null vendors/times are coalesced to stable sentinels so uniqueness still applies
create unique index if not exists job_parts_unique_job_product_schedule
on public.job_parts (
  job_id,
  product_id,
  coalesce(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(scheduled_start_time, '1970-01-01 00:00:00+00'::timestamptz),
  coalesce(scheduled_end_time, '1970-01-01 00:00:00+00'::timestamptz)
);
