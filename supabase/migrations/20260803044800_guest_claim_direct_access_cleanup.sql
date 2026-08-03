begin;

-- Apply only after the RPC-based guest-claim client is live. This second phase
-- closes the temporary compatibility bridge left by the additive remediation.
do $$
begin
  if pg_catalog.to_regprocedure('public.get_public_claim_products()') is null
     or pg_catalog.to_regprocedure(
       'public.submit_guest_claim(text,text,text,uuid,text,text,text)'
     ) is null then
    raise exception 'Guest claim RPCs must exist before direct access is removed';
  end if;
end
$$;

drop policy if exists claims_guest_insert on public.claims;
drop policy if exists public_can_create_claims on public.claims;
drop policy if exists public_can_view_claims on public.claims;
revoke all privileges on table public.claims from public, anon;

drop policy if exists claim_attachments_guest_insert on public.claim_attachments;
drop policy if exists public_can_create_claim_attachments on public.claim_attachments;
drop policy if exists public_can_view_claim_attachments on public.claim_attachments;
revoke all privileges on table public.claim_attachments from public, anon;

drop policy if exists products_anon_select_active on public.products;
revoke all privileges on table public.products from public, anon;
revoke select (id, name, description, category, brand, unit_price)
  on table public.products from public, anon;

-- The legacy browser flow generated a number before inserting directly. The
-- SECURITY DEFINER submission RPC still calls this function internally, so
-- anonymous callers no longer need direct EXECUTE after promotion.
revoke execute on function public.generate_claim_number() from public, anon;

commit;
