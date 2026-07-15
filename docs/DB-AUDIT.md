# NgomongAja — Live RLS + Schema Audit (2026-07-15)

> How this audit was done: two throwaway test users (one buyer, one seller) were
> created on the live project, and every access rule from DATABASE.md's policy
> matrix was tested **behaviorally** — real REST requests with real user tokens,
> attempting both legal and illegal actions. Everything created was deleted
> afterward; all 13 tables were verified back to 0 rows and both test users
> removed. Where a fix says `DROP POLICY "<current ... policy>"`, look up your
> policy's real name under **Authentication → Policies** in the dashboard.

## A. Findings

Severity: 🔴 high · 🟠 medium · ✅ pass

| # | Table · Operation | Actor | Expected | Actual | Verdict |
|---|---|---|---|---|---|
| A1 | Anonymous INSERT (all 13 tables) | anon | Denied | `401/42501` everywhere | ✅ PASS |
| A2 | Anonymous SELECT on private tables (profiles, orders, payments, addresses, buyer_verifications, voice_recordings, chats, messages, order_items) | anon | Denied | 0 rows even when rows exist | ✅ PASS |
| A3 | Anonymous SELECT: stores, products, reviews | anon | Public storefront | Rows returned | ✅ PASS |
| A4 | **profiles SELECT** | any logged-in user | Own row + order counterpart only | **Everyone can read ALL profiles (name + phone)** | 🟠 FAIL — PII leak |
| A5 | **profiles UPDATE `role`** (own row) | buyer | Role never changes | Buyer changed own role buyer→seller | 🔴 FAIL — privilege escalation |
| A6 | profiles UPDATE (someone else's row) | buyer | Denied | `affected=0` | ✅ PASS |
| A7 | profiles INSERT | client | Created by signup trigger | Client insert denied; trigger auto-creates rows | ⚠️ verify trigger copies role/name/phone from signup metadata |
| A8 | addresses (own insert / others read/update) | buyer, seller | Own only | Spoofed ids `403`; cross-user read 0, update 0 | ✅ PASS |
| A9 | stores INSERT with `owner_id` = someone else | seller | Denied | `403` | ✅ PASS |
| A10 | **stores INSERT by a buyer** | buyer | Sellers only | **Buyer created a store** — role not checked | 🟠 FAIL |
| A11 | products public read / non-owner update | buyer | Read yes, write no | Read `200`, update `affected=0` | ✅ PASS |
| A12 | orders INSERT with spoofed `buyer_id` | buyer | Denied | `403/42501` | ✅ PASS |
| A13 | **orders INSERT with status `completed`** | buyer | PENDING only | Accepted (`201`) | 🟠 FAIL |
| A14 | **orders UPDATE own status → completed** | buyer | Only pending→cancelled | Accepted (`200`) | 🔴 FAIL — state machine unenforced |
| A15 | **orders DELETE own order** | buyer | Never (permanent history) | Deleted (`200`) | 🔴 FAIL |
| A16 | orders SELECT by seller of the store / by anon | seller, anon | Yes / no | rows=1 / rows=0 | ✅ PASS |
| A17 | order_items insert with order / update later | buyer | Insert yes, immutable after | `201` / `affected=0` | ✅ PASS |
| A18 | **payments INSERT (`cod`, `UNPAID`)** | buyer | Created at checkout | **Rejected by CHECK constraint** — see A22/A23 | 🔴 FAIL — blocks checkout |
| A19 | **reviews INSERT** | any user, non-completed order | Buyer of COMPLETED order, once | Accepted (`201`) | 🟠 FAIL |
| A20 | buyer_verifications / voice_recordings cross-user read | seller, anon | Owner only | 0 rows | ✅ PASS — KTP + audio isolated |
| A21 | chats / messages anon read | anon | Parties only | 0 rows | ✅ PASS |
| A22 | **orders_status_check values** | — | PRD §7.1: `PENDING`…`CANCELLED` (uppercase) | Accepts lowercase `pending/completed/cancelled`; **rejects `PENDING`, `ACCEPTED`** | 🔴 FAIL — DB ≠ docs |
| A23 | **payments method/status CHECKs** | — | `cod/gopay/bank_transfer`; `UNPAID/PAID/VOIDED` | Accepts `cash/gopay/transfer` + lowercase statuses; **rejects `cod`, `bank_transfer`, `UNPAID`, `VOIDED`** | 🔴 FAIL — DB ≠ docs |
| A24 | orders_fulfillment_check | — | `pickup` / `delivery` | Matches | ✅ PASS |

**Headline risks:**
- A5 + A10 chain into a full **buyer→seller takeover**: change your own role, then open a store.
- A14 + A15 let a buyer mark their own order completed (or delete it) — the PRD §7 state machine only exists in the app's good intentions, and NFR-9 requires the server to enforce it.
- A22 + A23: the database rejects the exact status/method strings the docs (and therefore the app code) will use. **Checkout would fail on day one.** Root cause: docs say `PENDING`/`cod`/`UNPAID`; the DB was built with `pending`/`cash`/`paid`. Either side is fine — but pick ONE canon.

## B. Ready-to-paste fixes (Supabase SQL editor)

### B1 — Freeze `role` (fixes A5) 🔴
```sql
CREATE OR REPLACE FUNCTION public.freeze_profile_role() RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role is immutable';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_freeze_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.freeze_profile_role();
```
*Why a trigger and not RLS? RLS policies can't easily compare the old value with
the new one; a `BEFORE UPDATE` trigger sees both.*

### B2 — Stop the profiles PII leak (fixes A4) 🟠
```sql
DROP POLICY IF EXISTS "<current profiles select policy>" ON public.profiles;

CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

-- Read the other party ONLY on an order you share (buyer <-> store owner)
CREATE POLICY profiles_select_order_counterpart ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE (o.buyer_id = auth.uid() AND profiles.id = s.owner_id)
         OR (s.owner_id = auth.uid() AND profiles.id = o.buyer_id)
    )
  );
```
*Reviewer names shown on store pages (C-2) should come from a dedicated VIEW
exposing only `full_name` — not from opening up the whole profiles table.*

### B3 — Only sellers create stores (fixes A10) 🟠
```sql
DROP POLICY IF EXISTS "<current stores insert policy>" ON public.stores;
CREATE POLICY stores_insert_seller ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.role = 'seller')
  );
```

### B4 — Orders: PENDING-only insert, cancel-only buyer update, no delete (fixes A13–A15) 🔴
```sql
DROP POLICY IF EXISTS "<current orders insert policy>" ON public.orders;
CREATE POLICY orders_insert_buyer ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid() AND status = 'pending');  -- use your canonical case (see B6)

DROP POLICY IF EXISTS "<current orders update policy>" ON public.orders;
CREATE POLICY orders_cancel_buyer ON public.orders
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() AND status = 'pending')
  WITH CHECK (status IN ('pending','cancelled'));

CREATE POLICY orders_update_seller ON public.orders
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s
                 WHERE s.id = orders.store_id AND s.owner_id = auth.uid()));

-- Deleting a DELETE policy = deletes denied by default. Orders are history.
DROP POLICY IF EXISTS "<current orders delete policy>" ON public.orders;
```
*The fully robust fix for A14 is a `BEFORE UPDATE` trigger implementing the §7.1
state machine (legal transitions + stock restore). These policies are the
minimum stop-gap; the trigger comes in the migration phase.*

### B5 — Reviews: only the buyer of a COMPLETED order (fixes A19) 🟠
```sql
DROP POLICY IF EXISTS "<current reviews insert policy>" ON public.reviews;
CREATE POLICY reviews_insert_buyer ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = reviews.order_id
      AND o.buyer_id = auth.uid()
      AND o.status = 'completed'));
```

### B6 — Reconcile the CHECK constraints (fixes A18/A22/A23) 🔴
**Decision required first: pick ONE canonical set of strings** (see Open Decision
below). If you choose the docs' canon (uppercase statuses, `cod`/`bank_transfer`):
```sql
ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('PENDING','ACCEPTED','READY','COMPLETED','REJECTED','CANCELLED'));

ALTER TABLE public.payments DROP CONSTRAINT payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('cod','gopay','bank_transfer'));

ALTER TABLE public.payments DROP CONSTRAINT payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('UNPAID','PAID','VOIDED'));

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('buyer','seller'));
ALTER TABLE public.buyer_verifications ADD CONSTRAINT bv_status_check
  CHECK (status IN ('pending','approved','rejected'));
ALTER TABLE public.messages ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text','payment_request','system'));

-- Delivery orders must carry a destination (PRD §10):
ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_addr_check
  CHECK (fulfillment <> 'delivery' OR delivery_address IS NOT NULL);
```
If you prefer the lowercase strings already in the DB, keep the constraints and
update DATABASE.md + PRD §7 + app code instead — deliberately, once.

### B7 — Indexes (Postgres does NOT auto-index foreign keys)
Check existing first: `select indexname, indexdef from pg_indexes where schemaname='public' order by tablename;`
```sql
-- Buyer history & seller logs: filter by owner, newest first
CREATE INDEX idx_orders_buyer_created ON public.orders (buyer_id, created_at DESC);
CREATE INDEX idx_orders_store_created ON public.orders (store_id, created_at DESC);
-- Recaps: completed revenue per store per period
CREATE INDEX idx_orders_store_status_created ON public.orders (store_id, status, created_at);

CREATE INDEX idx_order_items_order   ON public.order_items (order_id);
CREATE INDEX idx_order_items_product ON public.order_items (product_id);
CREATE INDEX idx_messages_chat_sent  ON public.messages (chat_id, sent_at);

-- Partial index: only active products (smaller, cheaper on stock updates)
CREATE INDEX idx_products_store_active ON public.products (store_id) WHERE is_active;

CREATE INDEX idx_stores_owner        ON public.stores (owner_id);
CREATE INDEX idx_store_photos_store  ON public.store_photos (store_id);
CREATE INDEX idx_addresses_profile   ON public.addresses (profile_id);
CREATE INDEX idx_bv_profile          ON public.buyer_verifications (profile_id);
CREATE INDEX idx_voice_buyer         ON public.voice_recordings (buyer_id);
CREATE INDEX idx_voice_order         ON public.voice_recordings (order_id);
CREATE INDEX idx_reviews_order       ON public.reviews (order_id);

-- One-per-order rules double as indexes:
ALTER TABLE public.payments ADD CONSTRAINT payments_order_unique UNIQUE (order_id);
ALTER TABLE public.chats    ADD CONSTRAINT chats_order_unique    UNIQUE (order_id);
```
*Why `(buyer_id, created_at DESC)`: the query "my orders, newest first" becomes a
single index range-scan with no sort step. Without it, every history load is a
full table scan + sort.*

### B8 — Nearby stores (B-1): bounding box, not PostGIS
```sql
CREATE INDEX idx_stores_lat_lng ON public.stores (lat, lng);
```
Pre-filter a lat/lng bounding box (~±0.045° ≈ 5 km), then compute haversine on
the small candidate set in the query. PostGIS + GiST is the "real" answer at
scale but is overkill for an MVP with tens of stores.

**Recaps (S-3):** with `idx_orders_store_status_created`, daily/weekly revenue is
a single indexed aggregate; a plain VIEW over orders + order_items + payments is
enough. No materialized view needed at MVP volume.

**Already good:** money as integer Rupiah (no float rounding), FKs enforced,
fulfillment CHECK matches docs, KTP/voice/chat isolation all passed.

## C. Cleanup confirmation

All audit rows deleted in FK-safe order with the secret key; both throwaway auth
users deleted; final `count=exact` on all 13 tables → 0. Project restored to its
empty starting state.

## D. Not tested yet / verify later

- **Signup trigger (A7):** verify it copies `role`, `full_name`, `phone` from
  signup metadata — register a real buyer through the app and check
  `profiles.role`. If the trigger defaults everyone to one role, A-1/A-2 break.
- **Payment transitions** (pay simulated, COD mark-paid, VOID) — retest after B6.
- **State-machine transition legality** (e.g. PENDING→READY skipping ACCEPTED)
  — needs the §7.1 trigger/RPC; currently only ownership is enforced, not order.
- **"Only one pending verification at a time"** (B-6 rule) — untested.
- **Storage bucket policies** (`ktp-images`/`voice-recordings` private,
  `store-photos` public) — REST-table audit can't see these; test by trying to
  download another user's file.

## Open decision (owner)

**RESOLVED 2026-07-15: lowercase canon, keeping the live DB's strings.** PRD §7
(v1.3) and DATABASE.md §4 now define: order status `pending/accepted/ready/
completed/rejected/cancelled` · payment status `pending/paid/voided` · methods
`cash/gopay/transfer`.

A follow-up constraint probe (insert/patch every candidate value with the secret
key, then full cleanup — verified all tables back to 0) found the live CHECKs
were also **incomplete**, not just differently-cased:

| Column | Live DB allowed | Missing (needed by PRD §7) |
|---|---|---|
| `orders.status` | pending, ready, completed, cancelled | **accepted, rejected** |
| `payments.status` | pending, paid | **voided** |
| `messages.type` | text, payment_request | **system** (cancel/reject reasons) |
| `profiles.role`, `buyer_verifications.status`, `orders.fulfillment`, `payments.method` | complete & correct | — |

Also observed: the signup trigger creates `profiles` with `role='buyer'`,
`full_name=''` when no metadata is supplied — confirm it reads role/name/phone
from `raw_user_meta_data` before building registration (audit item D1).

## Resolution

All fixes below (B1–B8, adapted to the lowercase canon and the incomplete
CHECKs) are consolidated in **`supabase/security_fixes.sql`** — paste it into
the Supabase SQL editor and run once, then run `npx supabase db pull`. It also
adds the §7.1 **state-machine trigger** (illegal transitions rejected by the DB)
and a one-review-per-order UNIQUE constraint. Still open after running it: stock
decrement/restore trigger, payments-flow policies retest, signup-trigger
metadata verification (§D).

## Fix priority (superseded — see Resolution)

1. 🔴 B1 + B4 (privilege escalation, order integrity) and B6 (checkout-blocking constraints)
2. 🟠 B2, B3, B5
3. B7 + B8 indexes — before any real data goes in
