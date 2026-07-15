-- Checkout infrastructure (voice ordering part 2).

-- 1. Fractional quantities: the voice parser correctly produces 0.5 for
--    "setengah kilo", but quantity was an integer column. Warung sell
--    half-kilos all day; money columns stay integer Rupiah.
alter table public.order_items
  alter column quantity type numeric(10,3) using quantity::numeric;

-- 2. Private bucket for order voice recordings.
insert into storage.buckets (id, name, public)
values ('voice-recordings', 'voice-recordings', false)
on conflict (id) do nothing;

-- Buyers may upload/read only inside their own folder: the object path is
-- "<buyer uid>/<timestamp>.m4a", so the first folder must equal auth.uid().
create policy voice_recordings_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voice-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy voice_recordings_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'voice-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. PRD §7.2: the BUYER taps "pay (simulated)" for gopay/transfer, but the
--    baseline only lets sellers update payments. Buyers may move their own
--    order's payment to paid/voided only.
create policy payments_update_buyer on public.payments
  for update to authenticated
  using (
    order_id in (select id from public.orders where buyer_id = auth.uid())
  )
  with check (status in ('paid', 'voided'));

-- 4. Atomic checkout. One call inserts the order, its items, and the payment
--    row — all or nothing (a plpgsql function runs in a single transaction).
--    SECURITY INVOKER: runs as the calling user, so every RLS policy still
--    applies (buyer_id = auth.uid(), status must be 'pending', etc.).
--    Prices are read from the live catalog here, server-side — the client
--    sends product ids and quantities, never prices or totals.
create or replace function public.place_order(
  p_store_id uuid,
  p_fulfillment text,
  p_delivery_address text,
  p_payment_method text,
  p_items jsonb  -- [{"product_id": uuid, "quantity": number}, ...]
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_order_id uuid;
  v_fee int := 0;
  v_total int := 0;
  v_line record;
  v_price int;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order has no items';
  end if;
  if p_fulfillment = 'delivery' then
    v_fee := 5000;  -- flat MVP fee (PRD AS-4); per-store fee is PA-8
  end if;

  for v_line in
    select (e->>'product_id')::uuid as product_id,
           (e->>'quantity')::numeric as quantity
    from jsonb_array_elements(p_items) e
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'invalid quantity';
    end if;
    select price into v_price
    from public.products
    where id = v_line.product_id and store_id = p_store_id and is_active;
    if v_price is null then
      raise exception 'product % is not available in this store', v_line.product_id;
    end if;
    v_total := v_total + round(v_price * v_line.quantity)::int;
  end loop;
  v_total := v_total + v_fee;

  insert into public.orders
    (buyer_id, store_id, status, fulfillment, delivery_address, delivery_fee, total)
  values
    (auth.uid(), p_store_id, 'pending', p_fulfillment, p_delivery_address, v_fee, v_total)
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  select v_order_id,
         (e->>'product_id')::uuid,
         (e->>'quantity')::numeric,
         p.price  -- snapshot: price at order time (AS-3)
  from jsonb_array_elements(p_items) e
  join public.products p on p.id = (e->>'product_id')::uuid;

  insert into public.payments (order_id, method, status)
  values (v_order_id, p_payment_method, 'pending');

  return v_order_id;
end $$;
