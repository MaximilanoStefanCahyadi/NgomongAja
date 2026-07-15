-- Completes the order lifecycle server-side: stock movements, payment voiding,
-- auto-expiry, public reviews, KTP + store-photo buckets, and realtime.

-- ============================================================
-- 1. Stock + payment side effects on order status transitions
--    (PRD §7.1: decrement at accepted, restore on cancel from
--    accepted/ready, void pending payment on any dead end).
--    SECURITY DEFINER: the trigger adjusts stock/payments as the
--    system, regardless of who caused the transition.
--    Fractional quantities (0.5 kg) round UP for stock purposes.
-- ============================================================
create or replace function public.handle_order_side_effects() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    update public.products p
    set stock = greatest(0, p.stock - ceil(oi.quantity))::int
    from public.order_items oi
    where oi.order_id = new.id and oi.product_id = p.id;
  end if;

  if old.status in ('accepted', 'ready') and new.status = 'cancelled' then
    update public.products p
    set stock = (p.stock + ceil(oi.quantity))::int
    from public.order_items oi
    where oi.order_id = new.id and oi.product_id = p.id;
  end if;

  if new.status in ('cancelled', 'rejected') then
    update public.payments
    set status = 'voided'
    where order_id = new.id and status = 'pending';
  end if;

  return new;
end $$;

drop trigger if exists trg_order_side_effects on public.orders;
create trigger trg_order_side_effects
  after update of status on public.orders
  for each row execute function public.handle_order_side_effects();

-- ============================================================
-- 2. Auto-expiry (PRD AS-12, check-on-read): pending orders older
--    than 2 hours become cancelled. Clients call this before
--    loading order lists. The UPDATE flows through the transition
--    trigger (pending→cancelled is legal) and the side-effects
--    trigger (payment voided; no stock restore needed — pending
--    never decremented).
-- ============================================================
create or replace function public.expire_stale_orders() returns void
language sql security definer set search_path = public as $$
  update public.orders
  set status = 'cancelled'
  where status = 'pending' and created_at < now() - interval '2 hours';
$$;
grant execute on function public.expire_stale_orders() to authenticated;

-- ============================================================
-- 3. Public store reviews (C-2). Directly joining reviews→orders
--    is blocked by RLS for other buyers' orders, so this view
--    (owned by postgres, which bypasses RLS) exposes exactly the
--    four public columns and nothing else.
-- ============================================================
create or replace view public.store_reviews as
  select o.store_id, r.rating, r.comment, r.created_at
  from public.reviews r
  join public.orders o on o.id = r.order_id;
grant select on public.store_reviews to anon, authenticated;

-- ============================================================
-- 4. Buckets: ktp-images (private, own folder), store-photos
--    (public read; sellers write into their own folder).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('ktp-images', 'ktp-images', false)
on conflict (id) do nothing;

create policy ktp_images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ktp-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy ktp_images_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ktp-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

insert into storage.buckets (id, name, public)
values ('store-photos', 'store-photos', true)
on conflict (id) do nothing;

create policy store_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy store_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 5. Realtime: let clients subscribe to order status changes and
--    chat messages (RLS still filters what each user receives).
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.payments;
exception when duplicate_object then null;
end $$;
