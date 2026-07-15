# NgomongAja — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| Product | NgomongAja (Indonesian: "Just Speak") |
| Version | 1.3 (MVP) |
| Date | 2026-07-14 |
| Status | Approved — all proposed additions (PA-1…PA-12) accepted by the product owner on 2026-07-14 |
| Audience | Beginner software engineer building the app step by step |

### Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-14 | Initial draft. |
| 1.3 | 2026-07-15 | Enum canon decided by product owner: **lowercase, as built in the live DB**. §7 rewritten with canonical strings — order status `pending/accepted/ready/completed/rejected/cancelled`; payment status `pending/paid/voided` (was UNPAID/PAID/VOIDED); payment methods `cash/gopay/transfer` (was cod/gopay/bank_transfer). UPPERCASE elsewhere in prose = readability convention for the same values. |
| 1.2 | 2026-07-14 | Product owner accepted **all** proposed additions PA-1…PA-12. MVP scope now includes PA-1, PA-2, PA-7, PA-12 (Must) and PA-9, PA-11 (Should); PA-10 (phone-OTP auth) accepted with a build-order note in §9; PA-3…PA-6 and PA-8 confirmed as approved post-MVP backlog. OQ-2 resolved: KTP verification (B-6) ships as specced. |
| 1.1 | 2026-07-14 | Revised after simulated end-user review: delivery orders now carry an address + phone (approved ERD v2 change: `orders.address_id`); voice-parsing acceptance criteria hardened (mid-sentence corrections, Javanese mix, ambiguous matches, unit-less quantities, transcript always shown); retry reuses recorded audio; unmatched-item quick re-match picker; order auto-expiry + seller cancel path + stock restore added to the state machine; recap paid/unpaid split; multi-store visibility fixes; new proposed additions PA-9…PA-12; PA-2 and PA-7 proposed for MVP promotion; open questions updated (OQ on hiding KTP verification added, stock-restore question resolved). |

---

## 1. Executive Summary

NgomongAja is a mobile app for Indonesian UMKM (*Usaha Mikro, Kecil, dan Menengah* — micro, small, and medium enterprises), focused on local minimarkets and *warung* (small neighborhood shops). Think of it as **"Gojek, but only the GoMart grocery-ordering feature, built for small local shops."**

Its differentiator is **voice-first ordering**: a buyer picks a nearby store, taps record, and says their shopping list in casual Indonesian — e.g. *"Bang, beli indomie goreng dua, teh botol satu, sama sabun lifebuoy."* The app transcribes the audio, uses an LLM (Large Language Model — an AI that understands text) to turn the transcript into a structured order, matches the items against the store's product catalog, and lets the buyer confirm before checkout.

One Expo/React Native app serves both roles: **Buyers** (order by voice, browse nearby stores, view history, get verified with KTP) and **Sellers** (manage inventory across multiple stores, process orders, chat with buyers about payment, view sales recaps). The backend is **Supabase** (Postgres database + Auth + Storage + Realtime). Payments in the MVP are **dummy** — the app records a payment method (COD, GoPay, bank transfer) and a status, but no real money moves.

This is a **learning project**. The MVP scope is deliberately ruthless: no real payments, no push notifications, no admin app, no delivery-driver logistics.

---

## 2. Vision & Problem Statement

### The problem

**For buyers** (neighborhood customers): ordering from a local warung today means walking there, or texting the owner on WhatsApp with a free-form list that gets misread. Big platforms (GoMart, GrabMart) rarely list the small warung down the street. Typing an itemized order on a phone is slow, especially for older or less tech-literate users — but *everyone* can talk. Voice removes the biggest friction: data entry.

**For sellers** (warung/minimarket owners): they run their shop from memory and a paper notebook. Orders arrive scattered across WhatsApp chats and walk-ins; there is no order log, no payment tracking ("did Bu Siti pay for yesterday's order?"), and no view of what sells best. Joining a big platform means commissions, onboarding requirements, and complexity that a one-person shop cannot absorb.

### The vision

> **Anyone should be able to order from the shop next door just by speaking, and any warung owner should be able to run orders, stock, and sales from one simple phone app.**

Voice-first matters because it matches how UMKM commerce already happens — spoken, casual, in Indonesian slang ("*indomie dua, kecap satu*"), often mixed with regional languages like Javanese — instead of forcing users into forms and carts designed for supermarkets.

---

## 3. Glossary (defined once, used everywhere)

| Term | Meaning |
|---|---|
| UMKM | Indonesian micro/small/medium enterprises; here: minimarkets and warung. |
| Warung | A small family-owned neighborhood shop. |
| KTP | *Kartu Tanda Penduduk* — the Indonesian national identity card. Used for buyer verification. |
| COD | Cash on Delivery — buyer pays cash at handover. |
| STT | Speech-to-Text. We use **Groq Whisper** (an API that turns audio into a text transcript). |
| LLM | Large Language Model. We use **Gemini 2.0 Flash Lite** (primary) and **Nemotron 3 Super via OpenRouter** (fallback) to convert a transcript into structured order JSON. |
| Parsed order JSON | The LLM's output: a machine-readable list like `[{"name": "indomie goreng", "qty": 2}]`. |
| Catalog matching | Comparing each parsed item name against the store's `products` rows to find the real product and price. |
| Supabase | Backend-as-a-service: Postgres database, Auth (login), Storage (files like audio/KTP photos), Realtime (live updates, used for chat). |
| RLS | Row Level Security — Postgres rules in Supabase that control which rows each logged-in user may read/write. |
| Fulfillment | How the buyer gets the goods: **self-pickup** at the store, or **delivery** by the seller for an extra fee. |
| Dummy payment | Payment method + status recorded in the database, but no real payment gateway is called. |

---

## 4. Tech Constraints (fixed decisions — do not re-litigate)

1. **Mobile app:** Expo / React Native. Single codebase; buyer and seller experiences live in one app, separated by the `profiles.role` value.
2. **Backend:** Supabase (Postgres + Auth + Storage + Realtime). Project already exists.
3. **Voice pipeline (already prototyped):**
   `record audio → upload → Groq Whisper (STT) → LLM parses transcript into order JSON (Gemini 2.0 Flash Lite primary; Nemotron 3 Super via OpenRouter fallback) → app matches parsed items against the selected store's product catalog.`
4. **Payments are dummy for MVP:** methods COD / GoPay / bank transfer; only a recorded status, no integration.
5. **Database:** the as-built schema documented in DATABASE.md (ERD v2.1, 13 tables) is the source of truth for data touchpoints. Delivery destination is stored as a text snapshot (`orders.delivery_address`) copied from the buyer's chosen saved address.

---

## 5. Personas

### Persona 1 — Buyer: "Bu Rina", 38, household manager
- Lives in a kampung in Bandung; buys daily groceries from 2–3 warung within 500 m.
- Comfortable with WhatsApp and voice notes; dislikes typing long lists and navigating cart UIs.
- Speaks casually, mixes Indonesian with regional (Javanese) words, corrects herself mid-sentence (*"beli gula dua... eh gajadi, satu aja"*), and her internet connection is spotty.
- **Goal:** restock the kitchen in under a minute without leaving the house.
- **Frustration:** WhatsApp orders get misread; she never remembers what she paid last week.
- **How NgomongAja helps:** taps a store, speaks her list, checks the transcript, confirms, chooses delivery to her saved address, and can look up any past order (shop, items, price) in history.

### Persona 2 — Seller: "Pak Dedi", 45, minimarket owner
- Owns two shops: a minimarket near the main road (hundreds of products, tracked in a paper notebook) and a small warung run by his wife.
- Tracks stock in a notebook; loses track of who has paid.
- **Goal:** see all incoming orders and payment states in one place, and know his daily revenue without manual math.
- **Frustration:** chasing payment over WhatsApp feels awkward and gets lost in chat history; when both shops are busy he misses orders for whichever store he isn't looking at.
- **How NgomongAja helps:** one account manages both stores with a global pending-order badge; order log shows service + payment status and the delivery address; a "request payment" button opens an in-app chat; recaps show revenue split into paid vs unpaid.

---

## 6. User Roles

| Role | Description | Key permissions |
|---|---|---|
| **Buyer (unverified)** | Registered with the common personal-info form; has not passed KTP review. | Browse nearby stores, place voice orders, pay (dummy), chat on own orders, view own history. |
| **Buyer (verified)** | Submitted KTP number + KTP image + personal info, and the submission was **approved**. | Everything an unverified buyer can do, plus a "Verified" badge on their profile. (See Open Questions OQ-1 and OQ-2.) |
| **Seller** | Registered as seller; owns one or more stores. | Manage own stores' profiles, photos, inventory; view/advance orders for own stores; chat on own stores' orders; view recaps. |
| **Reviewer/Admin (out of app)** | For MVP there is **no admin UI**. Buyer verifications are reviewed manually in the Supabase dashboard by the project owner. | Approve/reject `buyer_verifications` rows directly in the database. |

A profile has exactly one role (`profiles.role` ∈ {`buyer`, `seller`}). Switching roles is out of scope for MVP.

---

## 7. Order Lifecycle & Payment Status (canonical definitions)

Both buyer order history and seller order logs depend on these values. **Use these exact lowercase strings** in `orders.status` and `payments.status` — they match the live database's CHECK constraints (canon decision, 2026-07-15). Elsewhere in this document, UPPERCASE status names (e.g. PENDING) are a readability convention and always refer to these lowercase stored values.

### 7.1 Service status — `orders.status`

```
                 ┌──────────► rejected   (terminal, seller declines)
                 │
pending ──► accepted ──► ready ──► completed   (terminal)
   │             │          │
   │             └────┬─────┘
   │                  ▼
   └────────────► cancelled   (terminal)
     (buyer cancel, auto-expiry, or seller cancel with reason)
```

| Status | Meaning | Set by | Allowed next states |
|---|---|---|---|
| `pending` | Buyer confirmed the order at checkout; waiting for the seller. | System (at checkout) | `accepted`, `rejected`, `cancelled` |
| `accepted` | Seller accepted and is preparing the items. | Seller | `ready`, `cancelled` (seller only, reason required) |
| `ready` | Items are prepared. Pickup: ready at the counter. Delivery: out for delivery. | Seller | `completed`, `cancelled` (seller only, reason required) |
| `completed` | Goods handed over / delivered. Terminal. | Seller | — |
| `rejected` | Seller declined while `pending` (e.g. out of stock, shop closed). Terminal. | Seller | — |
| `cancelled` | Order ended without completion. Terminal. Three paths: **(a)** buyer cancels while `pending`; **(b)** auto-expiry — a `pending` order the seller never acts on becomes `cancelled` after a configurable timeout, **default 2 hours**; **(c)** seller cancels from `accepted`/`ready` (e.g. buyer no-show) with a **required reason**. | Buyer / System / Seller | — |

Rules:
- Transitions only along the arrows above; the app must never allow skipping (e.g. `PENDING → COMPLETED`) or reversing.
- A buyer can cancel **only** in `PENDING`.
- A seller cancelling from `ACCEPTED`/`READY` must enter a short reason; the app posts it automatically to the order's chat as a `type = 'system'` message (no new DB column needed — see AS-11).
- Auto-expiry: the 2-hour timeout is a single named constant in code; implementation may be a scheduled Edge Function or check-on-read (see AS-12).
- **Stock:** stock is decremented when an order becomes `ACCEPTED` (see S-4). Any transition to `REJECTED` or `CANCELLED` **restores previously decremented stock** (a no-op if the order never reached `ACCEPTED`, e.g. rejection or expiry from `PENDING`).
- Only the seller who owns the order's store may perform seller-owned transitions.

### 7.2 Payment status — `payments.status` and `payments.method`

Canonical method strings (as built): **`cash`** (COD / bayar di tempat), **`gopay`**, **`transfer`** (bank transfer). Prose references to "COD" and "bank transfer" map to `cash` and `transfer`.

| Status | Meaning | Set by |
|---|---|---|
| `pending` | Payment record created at checkout; not yet paid (shown to users as **"Belum dibayar"**). | System (at checkout) |
| `paid` | Payment recorded. Dummy — no money actually moved. Sets `payments.paid_at`. | Buyer (GoPay / transfer "simulate pay" button) or Seller (marks COD paid at handover) |
| `voided` | Order became `cancelled` (any path, including expiry) or `rejected`; payment no longer applies. Displayed to users as **"Dibatalkan"** (see PA-12). | System (automatic) |

Rules per method (all dummy):
- **COD (`cash`):** stays `pending` until the seller taps "Mark as paid". When the seller taps **Selesai** (complete) on a COD order that is still `pending`, the same confirmation dialog asks **"Sudah dibayar?"** and lets the seller mark it `paid` in one flow (see S-2) — so a completed-but-unpaid COD order is a deliberate choice, never an accident.
- **GoPay / bank transfer (`gopay` / `transfer`):** buyer sees a simulated payment screen with a "Pay now (simulated)" button; tapping it sets `paid` immediately.
- While a payment is `pending` and the order is active (`pending`/`accepted`/`ready`) or `completed`, the seller can tap **"Request payment"**, which opens/creates the in-app chat for that order and sends a payment-request message. **In-app chat only — never WhatsApp or any external channel.**
- `paid` and `voided` are terminal for MVP (no refunds).
- All simulated-payment UI copy must be honest about being a demo — see PA-12.

---

## 8. User Stories & Acceptance Criteria

Story IDs: `A-` auth, `B-` buyer, `S-` seller, `C-` chat. Format is BDD (Given/When/Then). Every criterion is testable.

### 8.1 Authentication & Accounts

#### A-1 · Register as buyer (Must)
*As a new user, I want to register as a buyer with a simple personal-info form so I can start ordering.*

- **Given** I am on the registration screen and choose the "Buyer" role,
  **When** I submit full name, phone number, email, and password (all required — the phone number stays mandatory regardless of any future auth-method decision, see PA-10, because sellers need it for delivery contact),
  **Then** a Supabase Auth user is created, a `profiles` row is created with `role = 'buyer'`, and I land on the buyer home screen logged in.
- **Given** I leave a required field empty or the email is malformed,
  **When** I tap Register,
  **Then** the form shows a field-level error in Indonesian and no account is created.
- **Given** the email is already registered,
  **When** I tap Register,
  **Then** I see the error "Email sudah terdaftar" and no duplicate account is created.
- KTP upload is **not** part of registration; it is optional and done later from the profile (B-6).

#### A-2 · Register as seller (Must)
*As a shop owner, I want to register as a seller with my shop's location and proof photos so buyers can find and trust my store.*

- **Given** I choose the "Seller" role at registration,
  **When** I complete step 1 (personal info: full name, phone, email, password) and step 2 (first store: store name, description, location, and at least 1 proof photo of the shop — max 5),
  **Then** a `profiles` row (`role = 'seller'`), a `stores` row (with `owner_id`, `lat`, `lng`, `gmaps_url`), and `store_photos` rows are created, and I land on the seller dashboard.
- **Given** step 2 asks for location,
  **When** I set it,
  **Then** I can either use device GPS ("Gunakan lokasi saat ini") or paste a Google Maps link; the app stores `lat`, `lng`, and `gmaps_url` on the store row.
- **Given** I try to finish step 2 without a location or without any photo,
  **Then** submission is blocked with a clear error message.
- Photos are uploaded to Supabase Storage; the DB stores only URLs.

#### A-3 · Login / logout (Must)
*As a returning user, I want to log in and be routed to the right experience for my role.*

- **Given** valid credentials, **When** I log in, **Then** buyers see the buyer home and sellers see the seller dashboard (based on `profiles.role`).
- **Given** invalid credentials, **Then** I see "Email atau kata sandi salah" and stay on the login screen.
- **Given** I am logged in and reopen the app, **Then** my session is restored (Supabase session persistence) without re-entering credentials.
- **Given** I tap Logout in my profile, **Then** the session is cleared and I return to the login screen.

### 8.2 Buyer Features

#### B-1 · Nearby stores (Must)
*As a buyer, I want to see shops near my location and browse what they sell.*

- **Given** I grant location permission,
  **When** I open the "Toko Terdekat" (nearby stores) screen,
  **Then** I see a list of stores within **5 km**, sorted nearest-first, each showing name, distance in km (1 decimal), and average review rating (or "Belum ada ulasan" if none).
- **Given** I deny location permission,
  **Then** I see an explanation and a manual fallback: pick one of my saved `addresses` (or enter one) to use as the search center.
- **Given** I tap a store,
  **Then** I see the store page: name, description, photos, Google Maps link, its **reviews** (rating + comment, newest first), and its **active products** (`is_active = true`) with name, price (formatted `Rp12.000`), and stock. Products with `stock = 0` show "Habis" (sold out) and cannot be ordered.
- Distance is computed with the haversine formula from buyer coordinates to `stores.lat/lng`. (Definition: haversine = standard formula for distance between two lat/lng points on Earth.)

#### B-2 · "Ngomong Aja" voice ordering (Must — THE core feature)
*As a buyer, I want to speak my shopping list in casual Indonesian and get a structured order I can confirm.*

Flow: pick store → record → transcribe → parse → match → review/edit → fulfillment (+ address if delivery) → dummy payment → confirm.

**Recording & pipeline**

- **Given** I am on a store page,
  **When** I tap the big "Ngomong Aja" microphone button and speak (e.g. *"indomie goreng dua sama teh botol satu"*), then tap stop,
  **Then** the audio is recorded (max **60 seconds**; auto-stop at limit), uploaded to Supabase Storage, and a `voice_recordings` row stores `audio_url`.
- **Given** the recording is uploaded,
  **When** the pipeline runs (Groq Whisper → LLM),
  **Then** the parsed order JSON is saved to `voice_recordings.parsed_json` and the review screen opens. If Gemini fails or times out (>10 s), the app retries once with Nemotron via OpenRouter before showing an error.
- **Given** any pipeline step fails after fallback (upload, STT, or LLM),
  **Then** I see a plain-language Indonesian error and a **"Coba lagi"** (retry) button. **Retry reuses the audio I already recorded** — it re-uploads and/or re-runs transcription/parsing from wherever it failed. The app never forces me to speak my list again just because the network or an API hiccuped. A separate "Rekam ulang" (re-record) option exists if *I* want to start over. No partial order is ever created on failure.
- **Given** the microphone permission is denied,
  **Then** I see an explanation of why it is needed and a shortcut to system settings.

**Parsing quality (transcript understanding)**

The transcript-to-JSON step (LLM prompt) must satisfy all of the following, verifiable with a fixed set of test recordings (see NFR-10):

- **Mid-sentence corrections — last statement wins.**
  **Given** the transcript contains a self-correction such as *"beli gula dua kilo... eh gajadi, satu aja"* or *"indomie lima — eh, tiga deng"*,
  **Then** the parsed JSON contains only the final corrected quantity/item (gula ×1, indomie ×3) — never both versions and never the retracted one. A fully retracted item (*"sabun... eh gajadi"*) must not appear at all.
- **Javanese/colloquial mix.**
  **Given** the transcript mixes casual Indonesian with common Javanese or slang words for items, numbers, and connectors (e.g. *"tumbas mie loro karo kecap siji"* — "buy two noodles and one kecap"),
  **Then** the parsed JSON normalizes item names and quantities to standard Indonesian and digits (mie ×2, kecap ×1). The LLM prompt must explicitly instruct the model to handle Indonesian regional-language mixing.
- **Unit-less and unit-ful quantities.**
  **Given** quantities are spoken without units (*"indomie dua"*), with counter words (*"dua bungkus"*, *"tiga botol"*), or omitted entirely (*"sama kecap"*),
  **Then**: no quantity spoken → qty defaults to **1**; counter words map to a plain integer qty (the counter itself is not part of the item name); weight/volume phrases the catalog can't express (e.g. *"setengah kilo gula"*) are kept in the item-name string for the buyer to resolve on the review screen (qty = 1, name = "gula setengah kilo").
- **Ambiguous matches — the buyer picks.**
  **Given** one spoken item matches **multiple** products in the store's catalog (e.g. "indomie" matches "Indomie Goreng" and "Indomie Soto"),
  **Then** the review screen marks that line **"Pilih salah satu"** (choose one) and shows a short tappable list (max 5 candidates) — the app must not silently pick one. The order cannot be confirmed while any line is still ambiguous (the buyer must pick or remove it).

**Review & edit screen**

- **Given** the review screen opens,
  **Then** the **full transcript is always shown** at the top (e.g. quoted style), so I can verify what the app heard before trusting the parsed list. This is a Must, not optional polish.
- **Given** parsed items,
  **When** the app matches them against this store's `products`,
  **Then** each line is shown as **matched** (product name, unit price, qty, line subtotal), **ambiguous** (candidate picker, above), or **unmatched** ("Tidak ditemukan: 'sabun lifebuoy'").
- **Given** an **unmatched** line,
  **Then** it is not a dead end: the line offers **"Cari produk"** — a quick inline search picker over this store's catalog (type-ahead on product name, tap to attach the product to the line). I can also remove the line. This is a lightweight picker on the same screen, not a full catalog-browsing cart.
- **Given** the review screen,
  **When** I edit quantities (stepper), remove lines, resolve ambiguous/unmatched lines, or re-record entirely,
  **Then** the total updates instantly. I cannot set a qty above the product's current `stock`.
- **Given** all lines have been removed (by me),
  **Then** I cannot confirm; the app suggests re-recording or using "Cari produk". The order is blocked **only** in this everything-removed state — unmatched items alone never block confirmation, because each can be re-matched or removed individually.

**Fulfillment, address, and payment**

- **Given** at least one matched item and no unresolved ambiguous lines,
  **When** I tap "Lanjut" (continue),
  **Then** I choose fulfillment: **self-pickup** (fee Rp0) or **delivery** (adds the delivery fee to the total; see AS-4).
- **Given** I choose **delivery**,
  **Then** I must select a delivery address from my saved `addresses` — or create one inline (label + full address, GPS optional) — before continuing. The chosen address's text is **copied onto the order** (`orders.delivery_address`, ERD v2.1 snapshot — see §10) so order history stays correct even if I later edit the saved address. My phone number from `profiles.phone` travels with the order automatically (the seller sees it in S-2). Delivery cannot be confirmed without an address.
- **Given** I choose **self-pickup**, **Then** no address is required and `orders.delivery_address` stays `NULL`.
- **Given** the fulfillment step is done,
  **Then** I reach the dummy payment wall: COD / GoPay / bank transfer, clearly labeled as simulated (see PA-12).
- **Given** I confirm at the payment wall,
  **Then** the app creates: one `orders` row (`status = 'PENDING'`, `fulfillment`, `delivery_address` if delivery, `delivery_fee`, `total`), its `order_items` rows (with `unit_price` snapshotted at order time), one `payments` row (`method`, `status = 'UNPAID'`; GoPay/transfer then show the simulated pay screen per §7.2), and links the `voice_recordings` row to the order. I then see the order detail screen showing status `PENDING`.

#### B-3 · Cancel a pending order + auto-expiry (Must)
- **Given** my order is `PENDING`,
  **When** I tap "Batalkan pesanan" and confirm,
  **Then** `orders.status = 'CANCELLED'` and the payment becomes `VOIDED`.
- **Given** the order is `ACCEPTED` or later, **Then** the cancel button is not shown (only the seller can cancel from there, per §7.1).
- **Given** my `PENDING` order is untouched by the seller for the expiry timeout (default 2 h),
  **Then** it becomes `CANCELLED` automatically and my order detail explains "Kedaluwarsa — toko tidak merespons" (expired — the store did not respond).

#### B-4 · Order history (Must)
*As a buyer, I want to see everything I have ordered: price, shop, items.*

- **Given** I open "Riwayat" (history),
  **Then** I see all my orders, newest first, each row showing store name, date, total (`Rp` formatted), service status, and payment status.
- **Given** I tap an order,
  **Then** I see the detail: store, fulfillment type, delivery address (if delivery), delivery fee, every item (name, qty, unit price, subtotal), grand total, payment method + status, and the current service status. Data comes only from `orders`, `order_items`, `payments`, `stores`, `addresses`.
- **Given** I have no orders, **Then** I see an empty state with a shortcut to nearby stores.

#### B-5 · Buyer profile (Must)
- **Given** I open my profile,
  **Then** I see my name, phone, verification tier badge — **"Belum Terverifikasi"** (unverified) or **"Terverifikasi"** (verified) — and my saved addresses.
- **Given** I edit name/phone or add/edit an address (`label`, `full_address`, `lat/lng` optional), **Then** changes persist to `profiles` / `addresses`.

#### B-6 · KTP verification (Must — confirmed by OQ-2 resolution)
*As a buyer, I want to submit my KTP and personal info to become a verified buyer.*

- **Given** I am unverified,
  **When** I open "Verifikasi Akun" and submit KTP number (16 digits, digits only — validated client-side) and a KTP photo (camera or gallery),
  **Then** a `buyer_verifications` row is created with `status = 'pending'`, the image goes to a **private** Supabase Storage bucket, and my profile shows "Menunggu peninjauan" (under review).
- **Given** a reviewer sets the row to `approved` (manually via the Supabase dashboard — no admin app in MVP),
  **Then** my profile badge shows "Terverifikasi" the next time the app fetches my profile.
- **Given** it is set to `rejected`, **Then** I see "Ditolak" with the ability to resubmit (a new `pending` row).
- **Given** I already have a `pending` submission, **Then** I cannot submit another until it is decided.

### 8.3 Seller Features

#### S-1 · Seller dashboard (Must)
*As a seller, I want one overview screen when I open the app.*

- **Given** I log in as a seller,
  **Then** the dashboard shows, for the **currently selected store**: count of `PENDING` orders (needs action), count of active orders (`ACCEPTED` + `READY`), today's revenue shown as **two separate numbers — "Selesai & dibayar" (completed & paid) and "Selesai, belum dibayar" (completed but unpaid)** — never a single merged figure, and count of `UNPAID` payments on active/completed orders.
- **Given** I own multiple stores,
  **Then** the store switcher shows a **global pending-order badge**: the total count of `PENDING` orders across **all** my stores, with a per-store count next to each store inside the switcher — so an order for store B is never invisible while I'm looking at store A.
- **Given** any seller screen (dashboard, orders, recap, products),
  **Then** a persistent indicator clearly shows **which store I am currently viewing/editing** (e.g. store name pinned in the header), so I never edit stock or accept an order for the wrong shop.
- Each dashboard number is tappable and opens the corresponding filtered list.

#### S-2 · Order logs & processing (Must)
*As a seller, I want to see incoming orders with service + payment status, advance them, and request payment via in-app chat.*

- **Given** I open "Pesanan" (orders) for my selected store,
  **Then** I see orders newest first with buyer name, time, total, fulfillment type, **service status**, and **payment status**, filterable by service status.
- **Given** I open any order,
  **Then** I see buyer name, **buyer phone number**, items, totals, fulfillment, payment method/status, and — **for delivery orders — the full delivery address** (the `orders.delivery_address` snapshot).
- **Given** an order is `PENDING`, **Then** I see two actions: **Terima** (accept → `ACCEPTED`) and **Tolak** (reject → `REJECTED`, payment auto-`VOIDED`, stock untouched; see PA-7 for a proposed required reason).
- **Given** an order is `ACCEPTED`, **Then** the primary action is **Siap** (→ `READY`); given `READY`, the primary action is **Selesai** (→ `COMPLETED`).
- **Given** an order is `ACCEPTED` or `READY`,
  **Then** a secondary **"Batalkan"** action exists (e.g. buyer no-show): it requires typing a short reason (min 5 characters), sets `CANCELLED`, voids the payment, **restores stock**, and posts the reason to the order chat as a `system` message.
- **Given** the payment method is COD and status is `UNPAID`, **Then** I see **"Tandai sudah dibayar"** (mark as paid → `PAID`, sets `paid_at`).
- **Given** a COD order is `READY` and still `UNPAID`,
  **When** I tap **Selesai**,
  **Then** the confirmation dialog also asks **"Sudah dibayar?"** with a mark-paid option, so completing the order and recording the cash payment happen in one flow. I may still complete without marking paid — the order then counts as "completed but unpaid" in S-1/S-3.
- **Given** any order is `UNPAID` (and the payment is not `VOIDED`),
  **When** I tap **"Minta pembayaran"** (request payment),
  **Then** the app opens the in-app chat for that order (creating the `chats` row if needed) and sends a prefilled message stating the amount due and method. **The app must not open WhatsApp, SMS, or any external channel for this.**
- **Given** I try to act on an order belonging to a store I don't own, **Then** RLS blocks it (server-side, not just hidden in the UI).

#### S-3 · Recaps (Must)
*As a seller, I want sales history and aggregate recaps so I know how my shop is doing.*

- **Given** I open "Rekap" for my selected store,
  **Then** I can switch between **Harian / Mingguan / Bulanan** (daily / weekly / monthly) views showing: revenue split into **"Selesai & dibayar"** and **"Selesai, belum dibayar"** (sum of `total` for `COMPLETED` orders whose payment is `PAID` vs `UNPAID`), order count, and **top 5 items by quantity sold** for the period. Only `COMPLETED` orders count as sales, and the recap must never present unpaid revenue as money in hand.
- **Given** the daily view, **Then** I can page back to previous days (same for weeks/months).
- **Given** a "Riwayat penjualan" (sales history) list, **Then** I see all `COMPLETED` orders with date, buyer, total, and payment status — the raw data behind the recap numbers.
- Aggregations are computed with SQL over `orders` + `order_items` + `payments` (a Postgres view or RPC is acceptable); no separate analytics table.

#### S-4 · Inventory management (Must)
*As a seller, I want to add and modify products, prices, and stock.*

- **Given** I open "Produk" for my selected store,
  **Then** I see all products (active and inactive) with name, price, stock, and an active toggle, plus a search box (name substring match).
- **Given** I tap "Tambah produk", **When** I submit name (required, ≤ 80 chars), price (integer Rupiah > 0), and stock (integer ≥ 0), **Then** a `products` row is created with `is_active = true` and it appears in the buyer-facing catalog immediately. (For onboarding hundreds of products fast, see PA-11.)
- **Given** an existing product, **When** I edit price or stock or toggle `is_active`, **Then** changes persist and buyer-facing store pages reflect them on next load.
- **Given** I set `is_active = false`, **Then** buyers no longer see the product, but historical `order_items` referencing it still display correctly (they use the snapshotted `unit_price` and the product name).
- **Stock rules (matches §7.1 exactly):** stock decrements when the seller sets an order to `ACCEPTED` (each item's `stock` reduced by its qty, floored at 0), and is **restored** if that order later becomes `CANCELLED` via seller cancel. Orders that end in `REJECTED` or expire from `PENDING` never decremented stock, so restoring is a no-op for them.

#### S-5 · Seller profile & multi-store (Must)
*As a seller, I want one account to own multiple stores and edit their descriptions and locations.*

- **Given** my profile screen, **Then** I see my personal info and a list of all my stores.
- **Given** I tap "Tambah toko", **When** I complete the same store form as registration step 2 (name, description, location, ≥1 photo), **Then** a new `stores` row is created under my `owner_id`.
- **Given** an existing store, **When** I edit its name, description, location (GPS or Google Maps link), or photos (add/remove), **Then** `stores` / `store_photos` update and the buyer-facing page reflects it.
- **Given** multiple stores, **Then** every seller screen (dashboard, orders, recap, products) operates on the currently selected store from the switcher; the selection persists across app restarts; the header always names the selected store (see S-1); and the switcher shows per-store + global pending-order counts so no store's orders go unnoticed.

### 8.4 Chat (both roles)

#### C-1 · In-app order chat (Must)
*As a buyer or seller, I want to chat about a specific order inside the app.*

- **Given** an order exists, **Then** both the buyer and the seller can open its chat from the order detail screen; one `chats` row per order (`chats.order_id`), messages in `messages` (`sender_id`, `body`, `type`).
- **Given** either party sends a text message, **Then** the other party sees it **without manually refreshing** (Supabase Realtime subscription) when the chat screen is open.
- Message types: `text` (normal), `payment_request` (from S-2, rendered distinctly with amount + method), `system` (app-generated, e.g. seller-cancel reason from §7.1, rendered as a centered gray note).
- **Given** a user who is neither the order's buyer nor the store's owner, **Then** they cannot read or write the chat (enforced by RLS).
- MVP chat is text-only: no images, no typing indicators, no read receipts.

### 8.5 Reviews (display is mandatory; submission flow is a proposed addition — see §12, PA-1)

#### C-2 · Store reviews displayed (Must)
- **Given** a store page, **Then** buyers see the store's reviews (rating 1–5 stars + comment + reviewer first name + date, newest first) and the average rating in the header. Reviews come from `reviews` joined through `orders` to the store.

---

## 9. MVP Scope — MoSCoW

### Must have (MVP)
- A-1, A-2, A-3 — registration (buyer + seller) and login/logout.
- B-1 — nearby stores + store page with catalog and reviews display.
- B-2 — voice ordering end-to-end incl. transcript display, correction/Javanese/ambiguity/unit handling, retry-with-same-audio, unmatched-item re-match picker, delivery-address selection, dummy payment wall.
- B-3 — cancel while `PENDING` + auto-expiry.
- B-4 — buyer order history.
- B-5, B-6 — buyer profile + KTP verification (review done manually in Supabase dashboard; OQ-2 resolved — B-6 ships).
- S-1…S-5 — seller dashboard (paid/unpaid revenue split, global pending badge, current-store indicator), order logs + full state machine incl. seller cancel + COD complete-and-mark-paid flow + payment request via chat, recaps (paid/unpaid split), inventory (with stock restore), multi-store profile.
- C-1 — in-app order chat with realtime delivery and `system` messages.
- C-2 — reviews shown on store page.
- §7 state machines implemented exactly as specified (auto-expiry, seller cancel, stock restore included).
- PA-1, PA-2, PA-7, PA-12 from §12 — **accepted** by the product owner (2026-07-14), now mandatory.
- PA-10 (phone-OTP-first auth) — **accepted**. Build-order note: OTP login requires an SMS provider (Twilio-class) configured in Supabase, which costs money per message. To keep learning unblocked, A-1/A-3 are built with email+password first, and the switch to phone-OTP happens as its own step once a provider is configured; the mandatory phone field at registration stays either way.

### Should have (MVP if time allows)
- Pull-to-refresh + loading/empty/error states on every list screen.
- Basic Supabase RLS policies on all tables (at minimum: users only read/write their own rows; sellers only their stores' data).
- PA-9 (in-app realtime/local notifications) and PA-11 (rapid inventory entry) — **accepted** by the product owner (2026-07-14).

### Could have (nice, cheap, not required)
- Store open/closed manual toggle.
- Buyer search box on the nearby-stores list (filter by store name).

### Won't have (explicitly out of scope for MVP)
- Real payment gateway integration (GoPay/bank APIs) — dummy only.
- Delivery-driver logistics, courier tracking, maps routing — "delivery" is just a flag + fee + address; the seller delivers however they like.
- Admin application (verification review happens in the Supabase dashboard).
- Push notifications while the app is closed (see PA-3; in-app realtime is PA-9).
- WhatsApp or any external messaging integration.
- Product images, promo codes, discounts, loyalty points.
- Bulk product import (CSV/spreadsheet) — see PA-11 note.
- Multi-language UI (Indonesian only), iOS/Android platform-specific features, offline mode.
- Role switching (one account = one role), email verification flows, password reset beyond Supabase's default.

---

## 10. Data Touchpoints (ERD alignment)

### Approved ERD v2 change

| Change | Reason |
|---|---|
| `orders.delivery_address` — nullable text **snapshot** copied from the buyer's chosen saved address; **required (non-null) when `fulfillment = 'delivery'`**, `NULL` for self-pickup. Enforce with a CHECK constraint or RPC validation. | A delivery order without a destination address is undeliverable (gap surfaced by end-user review of v1.0); as built 2026-07-15, the snapshot keeps history correct even if the saved address is later edited or deleted. |

Otherwise the 14 ERD v1 tables stand. Do not invent further tables/columns for MVP; if a feature seems to need one, raise it as an open question first.

| Table | Written by | Read by |
|---|---|---|
| `profiles` (id, role, full_name, phone) | A-1, A-2, B-5 | A-3 routing, S-2 (buyer name **and phone**), C-1 |
| `buyer_verifications` (ktp_number, ktp_image_url, status) | B-6 | B-5 badge; reviewed manually in Supabase |
| `stores` (owner_id, name, description, lat, lng, gmaps_url) | A-2, S-5 | B-1, S-1…S-4 store switcher |
| `store_photos` | A-2, S-5 | B-1 store page |
| `products` (store_id, name, price, stock, is_active) | S-4; stock decrement on `ACCEPTED`, restore on seller cancel (§7.1) | B-1 catalog, B-2 matching + "Cari produk" picker, S-3 top items |
| `addresses` (profile_id, label, full_address, lat, lng) | B-5, B-2 (inline create at delivery checkout) | B-1 location fallback, B-2 delivery address picker, B-4 detail, S-2 delivery detail |
| `orders` (buyer_id, store_id, status, fulfillment, **delivery_address (ERD v2.1)**, delivery_fee, total) | B-2 create, B-3 cancel + auto-expiry, S-2 transitions | B-4, S-1, S-2, S-3 |
| `order_items` (order_id, product_id, qty, unit_price) | B-2 (unit_price snapshotted) | B-4 detail, S-2 detail, S-3 top items, stock restore |
| `voice_recordings` (order_id, audio_url, parsed_json) | B-2 | B-2 retry-with-same-audio; debugging |
| `payments` (order_id, method, status, paid_at) | B-2 create, §7.2 transitions (incl. auto-`VOIDED` on cancel/expiry/reject) | B-4, S-1, S-2, S-3 paid/unpaid split |
| `chats` (order_id) | C-1 / S-2 (create on first message) | C-1 |
| `messages` (chat_id, sender_id, body, type) | C-1, S-2 payment request, §7.1 seller-cancel `system` message | C-1 (Realtime) |
| `reviews` (order_id, rating, comment) | PA-1 (proposed) | C-2 store page |

---

## 11. Non-Functional Requirements (lightweight — learning project)

Each is measurable; none require production-grade infrastructure.

| # | Requirement | Target |
|---|---|---|
| NFR-1 | Voice pipeline latency: stop-recording → review screen visible | ≤ 15 s on a normal 4G connection for a ≤ 30 s recording; a progress indicator is always visible while waiting |
| NFR-2 | LLM fallback | If the primary LLM call errors or exceeds 10 s, exactly one fallback attempt (Nemotron/OpenRouter) before surfacing an error with retry (which reuses the recorded audio, per B-2) |
| NFR-3 | Security: secrets | Groq/Gemini/OpenRouter API keys never ship in the app bundle; calls go through a Supabase Edge Function (or equivalent server-side proxy) |
| NFR-4 | Security: data access | RLS enabled on all tables; KTP images and voice audio in private Storage buckets accessed via signed URLs |
| NFR-5 | Language | All user-facing text in Indonesian; currency formatted as `Rp12.000` (dot thousands separator, no decimals) |
| NFR-6 | List performance | History, order log, and product lists paginate or lazy-load at > 50 rows (a two-store owner can have ~700 products) |
| NFR-7 | Error handling | Every network call has a user-visible failure state with a retry action; the app never crashes on airplane mode; recorded audio survives a network drop (retry without re-speaking) |
| NFR-8 | Devices | Works on one real Android device and the Expo iOS simulator; no OS-specific code required for MVP |
| NFR-9 | State-machine integrity | Illegal order/payment transitions are rejected server-side (DB constraint, trigger, or RPC check), not only hidden in the UI |
| NFR-10 | Parsing test set | A fixed set of ≥ 10 test recordings/transcripts (covering corrections, Javanese mix, unit-less quantities, ambiguity) is kept in the repo and re-run whenever the LLM prompt changes; ≥ 8/10 must parse to the expected JSON |

Explicitly **not** required for MVP: load testing, CI/CD, crash reporting, analytics, accessibility audits, app-store release.

---

## 12. Proposed additions (ALL ACCEPTED by product owner, 2026-07-14)

Everything below was proposed beyond the original mandatory feature list and has been **accepted by the product owner**. Items with MVP scope are now mandatory; post-MVP items are approved backlog. PA-10's build-order note lives in §9.

| ID | Proposal | Justification | Suggested scope |
|---|---|---|---|
| **PA-1** | **Buyer review-submission flow**: after an order is `COMPLETED`, the buyer can leave one review (1–5 stars + optional comment) from the order detail screen. | The mandatory list requires reviews to *appear* on store pages and the ERD has a `reviews` table, but no creation flow was specified — without this, no reviews can ever exist. | **MVP** |
| **PA-2** | **Buyer live order-status screen** *(promoted to MVP in v1.1)*: the buyer's order detail (B-4) shows the live service status, updating via Supabase Realtime or refresh. | End-user review confirmed the "silent waiting" problem: after checkout the buyer stares at a static screen with no idea whether the warung even saw the order, which makes the whole flow feel broken — especially on spotty connections. Cheap: reuses the history detail screen. | **MVP** |
| **PA-3** | **Push notifications** (Expo Notifications) while the app is closed: new order → seller; status change / payment request → buyer. | The core loop is unreliable if users must keep the app open, but device-token plumbing is heavy for a beginner. PA-9 covers the in-app portion first. | **Post-MVP** |
| **PA-4** | **Favorite stores**: buyer can star stores for a "Favorit" tab. | Repeat purchasing from the same 2–3 warung is the dominant behavior (Persona 1), but it is pure convenience, not core-loop. | **Post-MVP** |
| **PA-5** | **"Pesan lagi" (re-order)**: one tap on a past order pre-fills a new cart with the same items. | High retention value for weekly staples and no voice pipeline cost, but the voice flow must be proven first. | **Post-MVP** |
| **PA-6** | **Manual (non-voice) cart ordering**: browse catalog, tap to add items, checkout through the same fulfillment/payment flow. | An accessibility/reliability fallback when voice fails or the buyer can't speak aloud; deferred so the team stays focused on the differentiator. (B-2's inline "Cari produk" picker already covers order *repair* without this.) | **Post-MVP** |
| **PA-7** | **Rejection reason** *(promoted to MVP in v1.1)*: when rejecting a `PENDING` order, the seller picks a short reason (out of stock / closed / other + free text); shown to the buyer and posted to chat as a `system` message. | v1.1 already requires a typed reason for seller cancels from `ACCEPTED`/`READY`; giving `REJECTED` the same treatment reuses the exact same chat mechanism, and end-user review showed an unexplained rejection reads as "the app is broken". | **MVP** |
| **PA-8** | **Per-store delivery fee setting**: seller sets their own delivery fee instead of the app-wide constant (see AS-4). Requires adding one column to `stores` — an ERD change. | Real warung charge different fees by distance/area; the app-wide constant is only acceptable as a learning shortcut. | **Post-MVP** |
| **PA-9** | **In-app realtime + local notifications for order events**: while the app is open, a Supabase Realtime subscription on `orders`/`payments` fires local notifications and updates badges — new order for sellers, status change / payment request for buyers. Full closed-app push remains PA-3. | Bridges the gap between "silent waiting" (PA-2) and full push (PA-3) using technology already in the stack (Realtime is used for chat anyway); no push tokens, no external service, beginner-feasible. | **MVP (Should-have)** |
| **PA-10** | **Phone-OTP-first authentication** instead of email+password (Supabase supports phone auth). **Owner decision required**: SMS OTP costs real money per message (needs a Twilio/Vonage-class provider configured in Supabase). If declined, email+password stays the default — and the required phone-number field at registration remains mandatory regardless (already in A-1/A-2) for delivery contact and recovery. | Warung buyers and older sellers commonly have a phone number but no active email; email+password is a known drop-off point for this demographic. Flagged rather than assumed because of the provider cost. | **Owner decision (MVP if accepted)** |
| **PA-11** | **Rapid inventory entry mode**: after saving a product, the form immediately reopens blank with focus on the name field ("Simpan & tambah lagi"), keyboard kept open, with a running "added this session" counter. Full bulk import (CSV/spreadsheet) stays **post-MVP**. | Persona 2 has ~700 products in a paper notebook; a one-at-a-time form makes cold-start onboarding take days and is the most likely reason a real seller quits. This is a form-flow tweak, not a new subsystem. | **MVP (Should-have)** |
| **PA-12** | **Honest dummy-payment copy**: every simulated payment surface (payment wall, GoPay/transfer "pay" screen, payment status rows) carries the label **"DEMO — tidak ada uang berpindah"** ("demo — no money moves"); `VOIDED` is always displayed as **"Dibatalkan"** with a one-line explanation. | Costs a few strings; prevents a trust disaster where a test user believes real money moved (or was lost) through a fake GoPay screen. | **MVP** |

---

## 13. Assumptions

Stated explicitly so gaps are visible, not silent.

- **AS-1** — Verification review is manual: the project owner approves/rejects `buyer_verifications` in the Supabase dashboard. No admin UI, no automated KTP OCR/validation beyond the 16-digit client check.
- **AS-2** — One chat per order, created lazily on the first message (buyer, seller, payment request, or system message).
- **AS-3** — Prices are integer Rupiah (no decimals). `order_items.unit_price` is snapshotted at order time so later price edits never change past orders.
- **AS-4** — Delivery fee is a single app-wide constant for MVP: **Rp5.000** flat (configurable in code, not per store — see PA-8 and OQ-4).
- **AS-5** — "Nearby" = 5 km radius, haversine distance, no map view (list only) for MVP.
- **AS-6** — The voice pipeline prototype's API contracts (Groq, Gemini, OpenRouter) are reused as-is, except the LLM prompt must be extended to satisfy B-2's parsing-quality criteria (corrections, Javanese mix, unit handling) and validated against NFR-10's test set.
- **AS-7** — Verified tier is a trust badge only in MVP; it does not gate any feature (pending OQ-1/OQ-2).
- **AS-8** — A seller's own stores never appear in their buyer flows because sellers have no buyer flows (one role per account).
- **AS-9** — Store "proof photos" from registration double as the store-page gallery photos (one `store_photos` set, no separate approval step).
- **AS-10** — The rebuilt Expo app lives in a fresh `app/` folder (see SETUP.md §1); the old `mobile/` prototype is read-only reference, and `web/` is out of scope for this PRD.
- **AS-11** — Seller cancel/reject reasons are stored as chat `messages` with `type = 'system'` (no new column on `orders`), keeping `orders` changes limited to `delivery_address` (ERD v2.1).
- **AS-12** — The `PENDING` auto-expiry timeout (default 2 hours) is one named constant. MVP may implement expiry as check-on-read (evaluate whenever the order is fetched) if a scheduled Edge Function is too much for a beginner — as long as buyer history and seller logs never *display* a stale `PENDING` past the timeout.

## 14. Open Questions

- **OQ-1** — Should the verified tier gate anything (e.g. delivery orders or COD require verification), or is it badge-only (AS-7)? Badge-only is assumed.
- **OQ-2** — *Resolved 2026-07-14:* KTP verification ships as specced (option a — B-6 stays in MVP, badge-only per AS-7). The end-user finding still informs the UI: the KTP screen must carry clear privacy copy, and rejection shows a reason (PA-7 mechanism).
- **OQ-3** — GoPay/bank transfer are dummy: is a single "Pay now (simulated)" button acceptable, or should the UI mimic real flows (fake VA number / fake QRIS screen) for demo purposes? (Either way, PA-12's "DEMO" labeling applies.)
- **OQ-4** — Delivery fee: is the flat Rp5.000 constant (AS-4) acceptable for MVP, or is per-store fee (PA-8) required from day one?
- **OQ-5** — Seller registration "proof photos": are they trust-review material (implying a seller approval step, which MVP does not have) or just display photos (AS-9)? Assumed display-only; sellers are live immediately upon registration.
- **OQ-6** — Can a buyer review a store only once per completed order (PA-1 assumption), or once per store overall?
- **OQ-7** — Should voice recordings be playable later by the seller (dispute resolution: "that's what the buyer actually said"), or stored for debugging only?
- **OQ-8** — Minimum order value or per-store order cutoff hours: none assumed for MVP — confirm.

*(Resolved since v1.0: the former stock-restore question — now specified in §7.1/S-4: decrement on `ACCEPTED`, restore on any later `CANCELLED`.)*

---

*End of PRD v1.1 — awaiting product-owner acknowledgment of §12 (proposed additions) and answers to §14.*
