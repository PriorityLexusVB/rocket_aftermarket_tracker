-- Clean up duplicate job_parts rows before enforcing uniqueness
-- Uses deterministic keeper selection via min(id::text)::uuid to avoid min(uuid) errors
delete from public.job_parts jp
using (
  select
    job_id,
    product_id,
    coalesce(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid) as vendor_id_normalized,
    coalesce(scheduled_start_time, '1970-01-01 00:00:00+00'::timestamptz) as start_norm,
    coalesce(scheduled_end_time, '1970-01-01 00:00:00+00'::timestamptz) as end_norm,
    min(id::text) as keep_id,
    count(*) as dup_count
  from public.job_parts
  group by
    job_id,
    product_id,
    coalesce(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(scheduled_start_time, '1970-01-01 00:00:00+00'::timestamptz),
    coalesce(scheduled_end_time, '1970-01-01 00:00:00+00'::timestamptz)
  having count(*) > 1
) d
where jp.job_id = d.job_id
  and jp.product_id = d.product_id
  and coalesce(jp.vendor_id, '00000000-0000-0000-0000-000000000000'::uuid) = d.vendor_id_normalized
  and coalesce(jp.scheduled_start_time, '1970-01-01 00:00:00+00'::timestamptz) = d.start_norm
  and coalesce(jp.scheduled_end_time, '1970-01-01 00:00:00+00'::timestamptz) = d.end_norm
  and jp.id::text <> d.keep_id;

-- Enforce uniqueness on job_id + product_id + vendor_id + scheduled times (with null sentinels)
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'job_parts_unique_job_product_schedule'
  ) then
    create unique index job_parts_unique_job_product_schedule
      on public.job_parts (
        job_id,
        product_id,
        coalesce(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(scheduled_start_time, '1970-01-01 00:00:00+00'::timestamptz),
        coalesce(scheduled_end_time, '1970-01-01 00:00:00+00'::timestamptz)
      );
  end if;
end
$$;
