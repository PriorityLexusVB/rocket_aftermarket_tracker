-- Create deal_opportunities (tenant-scoped via dealer_id) + basic RLS
-- v1: Delivery Coordinators only; all authenticated users in-tenant can CRUD (no role gating)

begin;

create table if not exists public.deal_opportunities (
  id uuid primary key default gen_random_uuid(),

  -- Tenant scoping
  dealer_id uuid not null references public.organizations(id) on delete cascade,

  -- Parent deal/job
  job_id uuid not null references public.jobs(id) on delete cascade,

  -- Optional linkage to product catalog
  product_id uuid null references public.products(id),

  -- Display/fallback name (required even if product_id is set)
  name text not null,

  quantity integer not null default 1,
  unit_price numeric(10,2) null,

  status text not null default 'open',
  decline_reason text null,

  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz null,

  constraint deal_opportunities_status_check
    check (status in ('open', 'accepted', 'declined'))
);

comment on table public.deal_opportunities is 'Upsell/opportunity tracking for deals (jobs). Tenant-scoped via dealer_id. v1 has no role gating.';

create index if not exists idx_deal_opportunities_job_id
  on public.deal_opportunities(job_id);

create index if not exists idx_deal_opportunities_dealer_status
  on public.deal_opportunities(dealer_id, status);

create index if not exists idx_deal_opportunities_dealer_created_at
  on public.deal_opportunities(dealer_id, created_at);

-- Timestamp maintenance
create or replace function public.set_deal_opportunities_timestamps()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());

    if new.decided_at is null and new.status in ('accepted', 'declined') then
      new.decided_at := now();
    end if;
  else
    new.updated_at := now();

    if (new.status is distinct from old.status)
       and new.decided_at is null
       and new.status in ('accepted', 'declined') then
      new.decided_at := now();
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_deal_opportunities_timestamps'
  ) then
    create trigger trg_deal_opportunities_timestamps
    before insert or update on public.deal_opportunities
    for each row
    execute function public.set_deal_opportunities_timestamps();
  end if;
end $$;

-- RLS: tenant-scoped via dealer_id
alter table public.deal_opportunities enable row level security;

grant select, insert, update, delete on public.deal_opportunities to authenticated;

-- Drop/recreate policies to keep migration idempotent

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'deal_opportunities'
      and policyname = 'dealer read deal_opportunities'
  ) then
    execute 'drop policy "dealer read deal_opportunities" on public.deal_opportunities';
  end if;

  execute $policy$
    create policy "dealer read deal_opportunities"
    on public.deal_opportunities
    for select
    to authenticated
    using (dealer_id = public.auth_dealer_id())
  $policy$;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'deal_opportunities'
      and policyname = 'dealer insert deal_opportunities'
  ) then
    execute 'drop policy "dealer insert deal_opportunities" on public.deal_opportunities';
  end if;

  execute $policy$
    create policy "dealer insert deal_opportunities"
    on public.deal_opportunities
    for insert
    to authenticated
    with check (
      dealer_id = public.auth_dealer_id()
      and exists (
        select 1
        from public.jobs j
        where j.id = deal_opportunities.job_id
          and j.dealer_id = public.auth_dealer_id()
      )
    )
  $policy$;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'deal_opportunities'
      and policyname = 'dealer update deal_opportunities'
  ) then
    execute 'drop policy "dealer update deal_opportunities" on public.deal_opportunities';
  end if;

  execute $policy$
    create policy "dealer update deal_opportunities"
    on public.deal_opportunities
    for update
    to authenticated
    using (
      dealer_id = public.auth_dealer_id()
      and exists (
        select 1
        from public.jobs j
        where j.id = deal_opportunities.job_id
          and j.dealer_id = public.auth_dealer_id()
      )
    )
    with check (
      dealer_id = public.auth_dealer_id()
      and exists (
        select 1
        from public.jobs j
        where j.id = deal_opportunities.job_id
          and j.dealer_id = public.auth_dealer_id()
      )
    )
  $policy$;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'deal_opportunities'
      and policyname = 'dealer delete deal_opportunities'
  ) then
    execute 'drop policy "dealer delete deal_opportunities" on public.deal_opportunities';
  end if;

  execute $policy$
    create policy "dealer delete deal_opportunities"
    on public.deal_opportunities
    for delete
    to authenticated
    using (
      dealer_id = public.auth_dealer_id()
      and exists (
        select 1
        from public.jobs j
        where j.id = deal_opportunities.job_id
          and j.dealer_id = public.auth_dealer_id()
      )
    )
  $policy$;
end $$;

commit;
