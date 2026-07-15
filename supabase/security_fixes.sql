-- ============================================================================
-- NgomongAja — security & integrity fixes from the 2026-07-15 audit
-- (docs/DB-AUDIT.md). Canon: LOWERCASE enums, as decided by the owner.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste this whole file -> Run.
-- It is safe to run more than once (drops are IF EXISTS / dynamic).
-- AFTER running: npx supabase db pull   (so this schema lands in git)
-- ============================================================================


-- ============================================================================
-- PART 1 — CHECK constraints (fixes audit A18/A22/A23 + probe findings)
-- Your live constraints were missing values the app needs:
--   orders.status  had no 'accepted' / 'rejected'
--   payments.status had no 'voided'
--   messages.type   had no 'system'  (used for seller cancel/reject reasons)
-- We drop the old CHECKs dynamically (works whatever they were named) and
-- recreate them with the full canonical value sets.
-- ============================================================================

do $$
declare c record;
begin
  for c in
    select conname, conrelid::regclass::text as tbl
    from pg_constraint
    where contype = 'c'
      and (
        (conrelid = 'public.orders'::regclass   and pg_get_constraintdef(oid) ilike '%status%')
        or (conrelid = 'public.payments'::regclass and pg_get_constraintdef(oid) ilike '%status%')
        or (conrelid = 'public.messages'::regclass and pg_get_constraintdef(oid) ilike '%type%')
      )
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.orders add constraint orders_status_check
  check (status in ('pending','accepted','ready','completed','rejected','cancelled'));

alter table public.payments add constraint payments_status_check
  check (status in ('pending','paid','voided'));

alter table public.messages add constraint messages_type_check
  check (type in ('text','payment_request','system'));

-- A delivery order without a destination is undeliverable (PRD §10).
alter table public.orders drop constraint if exists orders_delivery_addr_check;
alter table public.orders add constraint orders_delivery_addr_check
  check (fulfillment <> 'delivery' or delivery_address is not null);


-- ============================================================================
-- PART 2 — Freeze profiles.role (fixes A5: buyer promoted themself to seller)
-- Why a trigger, not RLS: an RLS policy cannot compare the OLD value with the
-- NEW one; a BEFORE UPDATE trigger sees both rows.
-- ============================================================================

create or replace function public.freeze_profile_role() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role is immutable';
  end if;
  return new;
end $$;

drop trigger if exists trg_freeze_profile_role on public.profiles;
create trigger trg_freeze_profile_role
  before update on public.profiles
  for each row execute function public.freeze_profile_role();


-- ============================================================================
-- PART 3 — Enforce the §7.1 order state machine (fixes A13/A14)
-- Only these arrows are legal:
--   pending  -> accepted | rejected | cancelled
--   accepted -> ready | cancelled
--   ready    -> completed | cancelled
-- Anything else (pending -> completed, reversing, editing a terminal order)
-- is rejected BY THE DATABASE, no matter what the app code does.
-- (Stock decrement/restore on transitions comes in a later migration.)
-- ============================================================================

create or replace function public.enforce_order_transitions() returns trigger
language plpgsql as $$
begin
  if old.status = new.status then
    return new;  -- not a status change (e.g. only another column updated)
  end if;
  if not (
       (old.status = 'pending'  and new.status in ('accepted','rejected','cancelled'))
    or (old.status = 'accepted' and new.status in ('ready','cancelled'))
    or (old.status = 'ready'    and new.status in ('completed','cancelled'))
  ) then
    raise exception 'illegal order transition: % -> %', old.status, new.status;
  end if;
  return new;
end $$;

drop trigger if exists trg_order_transitions on public.orders;
create trigger trg_order_transitions
  before update on public.orders
  for each row execute function public.enforce_order_transitions();


-- ============================================================================
-- PART 4 — Rebuild policies on the four problem tables
-- (profiles: A4 · stores: A10 · orders: A13-A15 · reviews: A19)
-- We drop ALL existing policies on these tables (so we don't depend on the
-- names you chose in the dashboard) and recreate the complete correct set.
-- Reminder: with RLS enabled, NO policy for an action = that action is DENIED.
-- That is why orders simply gets no DELETE policy (A15: orders are history).
-- ============================================================================

do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','stores','orders','reviews')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ---- profiles (fixes A4: everyone could read every phone number) ----------

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- You may also read the OTHER party of an order you share:
-- the buyer sees the store owner, the store owner sees the buyer.
create policy profiles_select_order_counterpart on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.stores s on s.id = o.store_id
      where (o.buyer_id = auth.uid() and profiles.id = s.owner_id)
         or (s.owner_id = auth.uid() and profiles.id = o.buyer_id)
    )
  );

-- You may edit your own profile (role changes blocked by the Part 2 trigger).
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT policy: profile rows are created by the signup trigger.
-- No DELETE policy: profiles are permanent.

-- ---- stores (fixes A10: a buyer could open a store) -----------------------

create policy stores_select_public on public.stores
  for select to anon, authenticated
  using (true);  -- public storefront (B-1); hide closed stores in app queries

create policy stores_insert_seller on public.stores
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'seller')
  );

create policy stores_update_owner on public.stores
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy stores_delete_owner on public.stores
  for delete to authenticated
  using (owner_id = auth.uid());

-- ---- orders (fixes A13/A14/A15) --------------------------------------------

create policy orders_select_parties on public.orders
  for select to authenticated
  using (
    buyer_id = auth.uid()
    or exists (select 1 from public.stores s
               where s.id = orders.store_id and s.owner_id = auth.uid())
  );

-- Buyers create their own orders, and only as 'pending' (A13).
create policy orders_insert_buyer on public.orders
  for insert to authenticated
  with check (buyer_id = auth.uid() and status = 'pending');

-- Buyers may only cancel their own still-pending order (A14).
create policy orders_update_buyer_cancel on public.orders
  for update to authenticated
  using (buyer_id = auth.uid() and status = 'pending')
  with check (status in ('pending','cancelled'));

-- Sellers advance orders of their own stores; the Part 3 trigger guarantees
-- only legal §7.1 transitions.
create policy orders_update_seller on public.orders
  for update to authenticated
  using (exists (select 1 from public.stores s
                 where s.id = orders.store_id and s.owner_id = auth.uid()));

-- NO delete policy on purpose: orders are permanent history (A15).

-- ---- reviews (fixes A19: anyone could review anything) ---------------------

create policy reviews_select_public on public.reviews
  for select to anon, authenticated
  using (true);  -- reviews are public storefront content (C-2)

-- Only the buyer of a COMPLETED order may review it.
create policy reviews_insert_buyer on public.reviews
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and o.buyer_id = auth.uid()
        and o.status = 'completed'
    )
  );

-- One review per order (OQ-6): a UNIQUE constraint enforces it and indexes the FK.
alter table public.reviews drop constraint if exists reviews_order_unique;
alter table public.reviews add constraint reviews_order_unique unique (order_id);


-- ============================================================================
-- PART 5 — Indexes (audit B7/B8). Postgres does NOT auto-index foreign keys.
-- Each one matches a real query the app will run constantly.
-- ============================================================================

-- "My orders, newest first" (buyer history B-4) and seller logs (S-2):
-- index (owner, created_at desc) = one range scan, no sort step.
create index if not exists idx_orders_buyer_created  on public.orders (buyer_id, created_at desc);
create index if not exists idx_orders_store_created  on public.orders (store_id, created_at desc);
-- Recaps (S-3): completed revenue per store per period.
create index if not exists idx_orders_store_status_created on public.orders (store_id, status, created_at);

create index if not exists idx_order_items_order   on public.order_items (order_id);
create index if not exists idx_order_items_product on public.order_items (product_id);
create index if not exists idx_messages_chat_sent  on public.messages (chat_id, sent_at);

-- Partial index: only rows buyers can actually see -> smaller and cheaper
-- to maintain on the write-heavy stock updates.
create index if not exists idx_products_store_active on public.products (store_id) where is_active;

create index if not exists idx_stores_owner        on public.stores (owner_id);
create index if not exists idx_store_photos_store  on public.store_photos (store_id);
create index if not exists idx_addresses_profile   on public.addresses (profile_id);
create index if not exists idx_bv_profile          on public.buyer_verifications (profile_id);
create index if not exists idx_voice_buyer         on public.voice_recordings (buyer_id);
create index if not exists idx_voice_order         on public.voice_recordings (order_id);

-- Nearby stores (B-1): bounding-box pre-filter on lat/lng, haversine in query.
create index if not exists idx_stores_lat_lng      on public.stores (lat, lng);

-- Exactly one payment / one chat per order (ERD ||--||): UNIQUE both enforces
-- the rule and doubles as the FK index.
alter table public.payments drop constraint if exists payments_order_unique;
alter table public.payments add constraint payments_order_unique unique (order_id);
alter table public.chats    drop constraint if exists chats_order_unique;
alter table public.chats    add constraint chats_order_unique unique (order_id);

-- ============================================================================
-- Done. Next: run  npx supabase db pull  so this schema is captured in git.
-- Still open for a later migration (see docs/DB-AUDIT.md §D):
--   * stock decrement on 'accepted' / restore on cancel-reject (trigger)
--   * payments policies for the pay/mark-paid flows (retest after this file)
--   * verify the signup trigger copies role/full_name/phone from metadata
-- ============================================================================
