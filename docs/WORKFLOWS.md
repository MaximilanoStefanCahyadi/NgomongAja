# NgomongAja — Key Workflows

> Audience: a beginner software engineer. Each section shows one core flow
> from [PRD.md](./PRD.md) v1.1 as a diagram plus short prose. Read the PRD
> story first, then the diagram here — the PRD defines *what must happen*,
> this document shows *in what order the pieces talk to each other*.
>
> Tables and enums referenced here are defined in [DATABASE.md](./DATABASE.md).

---

## 1. Buyer registration & KTP verification (A-1, B-6)

Registration is deliberately light: no KTP at sign-up. KTP verification is a
separate, optional step from the profile — and review happens manually in the
Supabase dashboard, because there is no admin app in MVP (AS-1).

```mermaid
sequenceDiagram
    actor B as Buyer
    participant App as Expo app
    participant Auth as Supabase Auth
    participant DB as Postgres
    participant ST as Storage (ktp-images, private)

    B->>App: Register as "Buyer" (name, phone, email, password)
    App->>Auth: sign up (email + password)
    Auth-->>App: new user id + session
    App->>DB: insert profiles (id = user id, role = 'buyer')
    App-->>B: Buyer home, logged in

    Note over B,DB: Later, optional — from Profil > "Verifikasi Akun" (B-6)
    B->>App: KTP number (16 digits) + KTP photo
    App->>App: validate number client-side
    App->>ST: upload photo to buyer's own folder
    App->>DB: insert buyer_verifications (status = 'pending')
    App-->>B: badge "Menunggu peninjauan"

    Note over DB: Project owner reviews the row in the Supabase dashboard<br/>and sets status = 'approved' or 'rejected'
    App->>DB: fetch profile + latest verification (next app load)
    App-->>B: "Terverifikasi" — or "Ditolak" with a resubmit option
```

Rules to remember: only one `pending` submission at a time; a rejection is
resolved by inserting a **new** `pending` row, not editing the old one; the
badge gates nothing for MVP (AS-7, OQ-1/OQ-2).

---

## 2. Seller registration & store setup (A-2)

Seller registration is two steps: the same personal-info form, then the first
store. A seller account **cannot exist without at least one store** — every
seller screen operates on a selected store.

```mermaid
sequenceDiagram
    actor S as Seller
    participant App as Expo app
    participant Auth as Supabase Auth
    participant DB as Postgres
    participant ST as Storage (store-photos, public)

    S->>App: Register as "Seller" — step 1: name, phone, email, password
    App->>Auth: sign up
    Auth-->>App: user id + session
    App->>DB: insert profiles (role = 'seller')

    S->>App: Step 2: store name, description, location, 1-5 photos
    alt Location via GPS
        App->>App: "Gunakan lokasi saat ini" -> device lat/lng
    else Location via link
        App->>App: paste Google Maps link -> lat/lng + gmaps_url
    end
    App->>App: block submit if no location or no photo
    App->>ST: upload proof photos
    App->>DB: insert stores (owner_id) + store_photos rows
    App-->>S: Seller dashboard (this store selected)
```

The store is live for buyers immediately — proof photos are display photos,
not a review gate (AS-9, OQ-5). Adding a second store later (S-5) reuses
exactly the step-2 form.

---

## 3. The voice order flow (B-2) — the centerpiece

This is the feature the whole app exists for. It has two halves: the
**pipeline** (audio → structured lines) and the **review & checkout** (human
confirms → order rows). Nothing is written to `orders` until the very last
step — a failed or abandoned attempt leaves no partial order (B-2).

### 3.1 Pipeline: record → transcribe → parse → match

```mermaid
sequenceDiagram
    actor B as Buyer
    participant App as Expo app
    participant ST as Storage (voice-recordings)
    participant DB as Postgres
    participant W as Groq Whisper (STT)
    participant G as Gemini 2.0 Flash Lite
    participant N as OpenRouter (Nemotron 3 Super)

    B->>App: On store page, tap "Ngomong Aja", speak, tap stop
    Note over App: Max 60 s, auto-stop at limit.<br/>Audio file kept on device for retries.
    App->>ST: upload audio
    App->>DB: insert voice_recordings (audio_url)
    App->>W: transcribe audio (with request timeout)
    W-->>App: transcript ("indomie goreng dua sama teh botol satu")

    App->>G: prompt: transcript -> order JSON (10 s timeout)
    alt Gemini responds in time
        G-->>App: raw LLM text
    else Gemini errors or exceeds 10 s
        App->>N: same prompt, exactly one fallback attempt (NFR-2)
        N-->>App: raw LLM text
    end
    App->>App: JSON-extraction step: pull valid JSON out of the raw text
    App->>DB: save parsed_json on the voice_recordings row
    App->>DB: fetch this store's active products
    App->>App: match each parsed item -> matched / ambiguous / unmatched
    App-->>B: Review screen (full transcript always shown at top)
```

**Failure & retry — never make the user speak twice.** If any step fails
*after* the fallback (upload, STT, or LLM), the app shows a plain Indonesian
error with two buttons:

- **"Coba lagi"** (retry) — reuses the already-recorded audio and resumes
  **from the failed step**: if upload succeeded but STT failed, retry calls
  Whisper again without re-uploading. This is why each pipeline step in the
  service layer reports its own failure (ARCHITECTURE.md §2.2).
- **"Rekam ulang"** (re-record) — only if the *user* wants to start over.

The parsing prompt must handle mid-sentence corrections (last statement wins),
Javanese/slang mixing, and unit-less quantities (default qty 1) — the full
criteria and the ≥ 10-recording test set live in PRD B-2 and NFR-10.

### 3.2 Review, fulfillment, address, dummy payment

```mermaid
sequenceDiagram
    actor B as Buyer
    participant App as Expo app
    participant DB as Postgres

    Note over B,App: Review screen — every line is matched, ambiguous, or unmatched
    loop Until no ambiguous lines remain
        B->>App: Ambiguous line ("indomie" x2 candidates)?<br/>tap "Pilih salah satu" and pick (max 5 shown)
    end
    opt Unmatched line ("Tidak ditemukan: 'sabun lifebuoy'")
        B->>App: "Cari produk" inline type-ahead over this store's catalog
        App->>DB: search products by name substring
        B->>App: tap a product to attach it — or remove the line
    end
    B->>App: adjust qty (stepper, capped at stock), remove lines
    App-->>B: total updates instantly
    Note over App: Confirm blocked only if ALL lines removed<br/>or any line still ambiguous

    B->>App: "Lanjut" -> choose fulfillment
    alt Self-pickup
        %% Note: status names in these diagrams appear in UPPERCASE for readability;
        %% the stored values are lowercase (PRD v1.3 §7): pending/accepted/ready/
        %% completed/rejected/cancelled; payments pending/paid/voided; methods cash/gopay/transfer.
        App->>App: delivery_fee = Rp0, delivery_address = NULL
    else Delivery
        B->>App: pick a saved address, or create one inline
        opt New address created inline
            App->>DB: insert addresses (label, full_address)
        end
        App->>App: delivery_fee = Rp5.000 (AS-4), delivery_address snapshot set (ERD v2.1)
        Note over App: Delivery cannot continue without an address.<br/>Buyer's phone travels with the order via profiles.phone.
    end

    B->>App: Payment wall — cod / gopay / bank_transfer<br/>labeled "DEMO — tidak ada uang berpindah" (PA-12)
    B->>App: Confirm order
    App->>DB: create in one unit (RPC): orders (status 'PENDING'),<br/>order_items (unit_price snapshotted), payments ('UNPAID'),<br/>link voice_recordings.order_id
    opt Method is gopay or bank_transfer
        B->>App: "Pay now (simulated)" screen
        App->>DB: payments.status = 'PAID', paid_at = now
    end
    App-->>B: Order detail — status PENDING, live updates (PA-2)
```

**Why review before checkout?** STT and LLMs make mistakes. Showing the full
transcript plus an editable line list makes the human the final authority —
the app must never silently guess (the ambiguous-picker rule) and never
dead-end (the unmatched re-match picker).

---

## 4. Order lifecycle state machine (PRD §7.1)

This must be implemented **exactly** — no skipped or reversed transitions,
enforced server-side (NFR-9), not just hidden in the UI.

```mermaid
stateDiagram-v2
    [*] --> PENDING : buyer confirms at checkout

    PENDING --> ACCEPTED : seller "Terima"
    PENDING --> REJECTED : seller "Tolak" (+ reason, PA-7)
    PENDING --> CANCELLED : buyer "Batalkan pesanan"
    PENDING --> CANCELLED : auto-expiry (no seller action for 2 h)

    ACCEPTED --> READY : seller "Siap"
    ACCEPTED --> CANCELLED : seller cancel (reason required)
    READY --> COMPLETED : seller "Selesai"
    READY --> CANCELLED : seller cancel (reason required)

    COMPLETED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]

    note right of ACCEPTED
        Entering ACCEPTED decrements
        product stock by each item's qty
        (floored at 0). (S-4)
    end note

    note right of CANCELLED
        Stock is RESTORED only if the order
        had reached ACCEPTED. Cancel/expiry
        from PENDING never touched stock,
        so restore is a no-op there.
        Payment auto-becomes VOIDED.
        Seller reasons are posted to chat
        as a 'system' message (AS-11).
    end note

    note right of REJECTED
        Stock untouched (was never
        decremented). Payment VOIDED.
    end note
```

Key rules in prose:

- The buyer can cancel **only** in `PENDING`; from `ACCEPTED` onward only the
  seller can cancel, and must type a reason (min 5 chars) which the app posts
  to the order chat as a `type = 'system'` message.
- Auto-expiry: the 2-hour timeout is one named constant; MVP may implement it
  as **check-on-read** — whenever an order is fetched, a `PENDING` order older
  than the timeout is treated (and persisted) as `CANCELLED` (AS-12). The
  buyer sees "Kedaluwarsa — toko tidak merespons".
- Only the seller who owns the order's store may perform seller transitions
  (RLS + transition function, DATABASE.md §5).

---

## 5. Payment status flow (PRD §7.2)

Payments are dummy: a method and a status in the database, no gateway.

```mermaid
stateDiagram-v2
    [*] --> UNPAID : payments row created at checkout

    UNPAID --> PAID : buyer taps "Pay now (simulated)" (gopay / bank_transfer)
    UNPAID --> PAID : seller "Tandai sudah dibayar" (cod)
    UNPAID --> VOIDED : order becomes CANCELLED or REJECTED (system)

    PAID --> [*]
    VOIDED --> [*]

    note right of PAID
        Sets paid_at. Terminal —
        no refunds in MVP.
    end note
    note right of VOIDED
        Always displayed as "Dibatalkan"
        with a one-line explanation (PA-12).
    end note
```

Two flows deserve a closer look:

**COD mark-paid at "Selesai" (S-2).** COD is paid in cash at handover, so the
natural moment to record it is when the seller completes the order:

```mermaid
sequenceDiagram
    actor S as Seller
    participant App as Expo app
    participant DB as Postgres

    S->>App: Order is READY (cod, UNPAID) — tap "Selesai"
    App-->>S: One dialog: confirm completion + "Sudah dibayar?"
    alt Seller confirms payment received
        App->>DB: orders.status = 'COMPLETED' and payments 'PAID' (paid_at)
    else Seller completes without marking paid
        App->>DB: orders.status = 'COMPLETED', payment stays 'UNPAID'
        Note over DB: Counts as "Selesai, belum dibayar" in S-1/S-3 —<br/>a deliberate choice, never an accident
    end
```

**Payment request via chat (S-2 + C-1).** While a payment is `UNPAID` (and
not `VOIDED`), the seller taps **"Minta pembayaran"**: the app opens the
order's in-app chat (creating the `chats` row if it does not exist yet) and
sends a prefilled `type = 'payment_request'` message stating the amount due
and method, rendered distinctly in the chat. **Never WhatsApp, SMS, or any
external channel** — this is an explicit PRD prohibition.

---

## 6. In-app chat with Supabase Realtime (C-1)

Supabase Realtime pushes database changes to subscribed clients over a
websocket, so neither side ever has to refresh manually.

```mermaid
sequenceDiagram
    actor B as Buyer
    participant BA as Buyer's app
    participant DB as Postgres
    participant RT as Supabase Realtime
    participant SA as Seller's app
    actor S as Seller

    B->>BA: open chat from order detail
    BA->>DB: get or create chats row for this order (AS-2)
    BA->>RT: subscribe to new messages for this chat_id
    S->>SA: open the same chat
    SA->>RT: subscribe (same chat_id)

    B->>BA: send "Barangnya masih ada?"
    BA->>DB: insert messages (type 'text', sender_id = buyer)
    DB-->>RT: row-inserted event
    RT-->>SA: push new message
    SA-->>S: message appears without refresh
```

Notes:

- One chat per order; created lazily on the first message from either side,
  a payment request, or a system message (AS-2).
- Three message types render differently: `text` (bubble),
  `payment_request` (distinct card with amount + method), `system`
  (centered gray note — e.g. the seller's cancel reason from §4).
- RLS restricts each chat to exactly two people: the order's buyer and the
  store's owner (DATABASE.md §5). Realtime respects the same policies.
- MVP is text-only: no images, typing indicators, or read receipts.

---

*End of WORKFLOWS.md — with PRD.md, SETUP.md, ARCHITECTURE.md, and
DATABASE.md, the planning set is complete; next phase is migrations + auth
(SETUP.md §8, phases 1-2).*
