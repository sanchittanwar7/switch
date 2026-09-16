# Plan — Dodo Payments integration for the Sponsored Board

## 1. Executive summary

Replace **Razorpay** with **Dodo Payments** as the single payment gateway for the "Bidding Board"
(`/api/board/*`). Razorpay blocks the "bidding" use case; Dodo supports variable-amount one-time
payments natively via **Pay What You Want (PWYW)**. **Razorpay code is deleted** — Dodo becomes the
only provider end-to-end (checkout creation → hosted checkout → webhook capture).

This plan is split into **6 subtasks**, covering the Dodo lib, DB migration, checkout + webhook
routes, client checkout UI, product reframing, and config/docs.

## 0. Pre-flight — Dodo account setup & use-case verification (do before writing code)

### 0.1 Account setup checklist

1. **Sign up** at `https://app.dodopayments.com/signup` (email + confirm).
2. **Complete verification** (required before live payouts): follow
   `https://docs.dodopayments.com/miscellaneous/verification-process` — identity form, business
   details, KYC. Start this immediately; it is the long pole.
3. **Create the product** (dashboard → Products → Add Product):
   - Pricing Type: **Single Payment** (one-time).
   - Enable **Pay What You Want** toggle.
   - **Minimum Price** = `99` (INR) — matches `BOARD_MIN_PAISE`.
   - Optional **Suggested Price** = e.g. `199` to anchor bids.
   - Note the **Product ID** (`pdt_...`) → goes in `DODO_PRODUCT_ID`.
   - Tax Category: pick the closest digital-service category.
4. **Generate API keys** (dashboard → Developers/API): grab the **test-mode** key and, later,
   the **live-mode** key. Never ship the key to the client.
5. **Create webhook endpoint** (Developer → Webhooks → Add endpoint):
   - URL: `https://leanswitch.vercel.app/api/board/webhook/dodo`.
   - Subscribe to `payment.succeeded` (and optionally `payment.failed`).
   - Copy the **signing secret** → `DODO_PAYMENTS_WEBHOOK_KEY`.
6. **Stay in test mode** until compliance sign-off (§0.2) — see
   `https://docs.dodopayments.com/miscellaneous/test-mode-vs-live-mode`.

### 0.1a Developer tooling (installed — Dodo Agent Plugin for OpenCode)

The Dodo Agent Plugin (`@dodopayments/opencode-plugin`) is wired into this repo so the coding agent
can read live docs and exercise the API while implementing Subtasks 1–6.

- **Plugin + skills** registered in `opencode.json` (project root):
  `plugin: ["@dodopayments/opencode-plugin"]` + `skills.paths` pointing at the package's `skills/`.
- Installed as a root devDependency (`@dodopayments/opencode-plugin`).
- **MCP servers** auto-registered by the plugin: `dodopayments-api` (live API — create payments,
  checkout sessions, refunds; OAuth auth) and `dodo-knowledge` (semantic docs search).
- **17 skills** available on demand (`checkout-integration`, `webhook-integration`,
  `dodo-best-practices`, `testing-and-go-live`, `refunds-and-disputes`, `product-catalog-management`,
  etc.). The agent auto-loads the right one per task.

Use during implementation:

- Ask `dodo-knowledge` for current payload shapes / field names instead of guessing.
- Use `checkout-integration` + `webhook-integration` skills when writing Subtask 3.
- Use `testing-and-go-live` skill before the §8 rollout checklist.

> **Restart opencode** after this config change — config is loaded at startup, not hot-reloaded.
> Verify with: `opencode run "List every skill available to you by name."` (expect all seventeen).

### 0.2 Use-case verification (blocker gate)

Before implementing, confirm Dodo will accept the business model. Two steps:

1. **Product reframing** — reposition the "bidding board" as a **pay-to-boost sponsored listing**
   (see §2.4). Update the public-facing copy now (terms page, board UI) so what Dodo reviews
   matches what ships.
2. **Written approval** — send the email in §0.3 to `compliance@dodopayments.com`. Do **not**
   flip `DODO_PAYMENTS_ENVIRONMENT=live_mode` until you have written approval in hand.

### 0.3 Email draft (to compliance@dodopayments.com)

> **Subject:** Merchant onboarding question — sponsored listing placement on a job-search platform
>
> Hi Dodo Payments compliance team,
>
> We're building **Lean Switch**, a job-search platform (resume tailoring, application tracking,
> interview prep). One feature is a **sponsored listing board**: a job seeker or recruiter can pay a
> **one-time, non-refundable placement fee** to publish a profile / job posting on a public board.
>
> How it works, precisely:
> - The payer **always receives the product immediately** — their listing is published and stays
>   published. There is no winner/loser mechanic and nothing is refunded.
> - The listing's position on the board is determined by the **cumulative total of placement fees**
>   paid toward it (deterministic ranking, not a random draw or real-time auction).
> - Each purchase is a single one-time payment with a **customer-chosen amount** above a fixed
>   minimum (₹99). We plan to implement this with your **Pay What You Want** pricing.
>
> We want to confirm this fits your Merchant Acceptance Policy. In particular we'd like to avoid any
> confusion with gambling/games of chance or marketplace/resale models — there is no chance element,
> and we do not forward funds to any third party; the buyer pays you directly for their own placement.
>
> Our model appears closest to your "resume / hiring tools" review category. Could you confirm
> whether this qualifies, and if you need any additional documentation (demo access, policy links,
> disclaimers)?
>
> Thanks,
> [Name] — Lean Switch
> [your website / demo URL]

---

## 2.4 Product reframing (required — apply before go-live)

The word **"bidding"** is what risks Dodo's MoR compliance (it was also what tripped Razorpay).
Reposition the feature as a **sponsored placement / pay-to-boost** model. Mechanical behavior is
unchanged (cumulative sum = rank); only the framing and copy change.

| Surface | Current (risky) | New (safe) |
|---------|-----------------|------------|
| Product label | "Bidding board" | "Sponsored board" / "Boost board" |
| Action verb | "Bid" / "Boost" | "Boost" / "Sponsor" only |
| Payment described as | "bid" | "one-time placement fee" / "boost fee" |
| Terms/FAQ | "All bidding board payments are non-refundable" | "Sponsored placement fees are non-refundable" |
| Model explained as | "bidding" | "Pay a one-time fee to publish; higher cumulative fees rank higher" |
| Winner/loser language | any "outbid / win / lose" | remove — everyone stays listed |

**Files to update (do with Subtask 5):**
- `client/src/content/staticPages.ts` (terms + FAQ copy)
- `client/src/components/board/*` (labels, aria text)
- `client/src/views/` (route copy, page title)
- `docs/ARCHITECTURE.md` (rename "bidding board" → "sponsored board" where user-facing)
- Database/API identifiers (`/api/board`, `board_*`, `bidPaise`) may stay internal — Dodo's review
  reads the public surface, not the code. Do not block migration on renaming internals.

---

## 2. Validation verdict

### 2.1 Technical fit — **YES**

Our "bidding board" is *not* a real-time auction. Per `docs/ARCHITECTURE.md` it is a
**pay-to-boost sponsored listing**: anyone pays an amount, the listing's `bid` is the
`SUM(amount_paise)` of captured payments, and listings rank by that sum descending. There is
no winner/loser, no refunding of losing bids, no chance element. Every payer stays listed.

Dodo Payments covers this exactly:

- **Variable amount per payment** → **Pay What You Want** (PWYW) on one-time products; pass `amount`
  in paise per checkout session.
- **Minimum payment floor (₹99)** → PWYW `minimum_price` bound.
- **Reference the listing on the payment** → checkout-session `metadata.listingId`.
- **Server-side checkout creation** → `client.checkoutSessions.create(...)`.
- **Webhook on capture** → `payment.succeeded` + Standard Webhooks (HMAC-SHA256).
- **Idempotency on retries** → `webhook-id` header + unique `payment_id`.
- **INR (paise)** → amount in lowest denomination.
- **Hosted checkout (no PCI)** → hosted `checkout_url`.

**Reference:** `https://docs.dodopayments.com/developer-resources/dynamic-pricing-checkout` and
`https://docs.dodopayments.com/features/pay-what-you-want`.

### 2.2 Compliance fit — **LIKELY YES, but needs explicit sign-off before commit**

Dodo is a **Merchant of Record (MoR)** with a strict `Merchant Acceptance Policy`
(`https://docs.dodopayments.com/miscellaneous/merchant-acceptance`). Relevant clauses:

- **#16 "Gambling & games of chance"** — *not* triggered: no chance, no lottery, deterministic pay-to-rank.
- **#29 "Fundraising / crowdfunding"** — *not* triggered **only if** we frame each payment as buying a
  defined digital product (a listing placement/boost), never as a donation/contribution.
- **#30 "Marketplaces, resale model"** — *watch out*: we are **not** forwarding funds to third parties
  (buyer pays Dodo directly for their own placement), so we do not fall under "taking funds and
  forwarding them elsewhere." Frame it as self-service sponsored placement.
- **"Resume, hiring, or exam tools"** (review category) — this *is* our category; it requires
  **enhanced due diligence**, not auto-approval.

**Conclusion:** `outbid.lol` running on Dodo is strong evidence, but it is **not a guarantee** for
our specific model. **Action required before code freeze:**

1. Email `compliance@dodopayments.com` describing the product as a **"pay-to-boost sponsored listing
   on a job-search board (cumulative, non-refundable placement fee, deterministic ranking)"** — avoid
   the word "bidding"/"auction" in the ask.
2. Get written approval. Block go-live on it.

### 2.3 Key API facts (from official docs)

- SDK: `dodopayments` (npm), Node 20+. Client init:
  `new DodoPayments({ bearerToken, environment: "test_mode" | "live_mode", webhookKey })`.
- Create checkout:
  `client.checkoutSessions.create({ product_cart: [{ product_id, quantity: 1, amount }], return_url, cancel_url, metadata: { listingId }, customization: { theme: "dark" }, feature_flags: { redirect_immediately: true } })`
  → `{ session_id, checkout_url }`. `amount` is in the lowest denomination (paise for INR).
- `checkout_url` is single-use, expires in 24h. Generate fresh per attempt.
- Webhook: Standard Webhooks spec. Headers `webhook-id`, `webhook-signature`, `webhook-timestamp`.
  Verify with `client.webhooks.unwrap(rawBody, { headers })`. Event `payment.succeeded`.
- Idempotency: dedupe on `webhook-id` header and/or unique `payment_id`.

---

## 3. Current state (Razorpay integration map)

| File | Responsibility |
|------|----------------|
| `server/src/lib/razorpay.ts` | Mode/key/secret resolution, `createRazorpayOrder`, `verifyWebhookSignature` (HMAC-SHA256) — **delete** |
| `server/src/routes/board.ts` | `POST /api/board/orders` → `createRazorpayOrder`, returns `orderId`/`keyId` |
| `server/src/routes/board-webhook.ts` | `POST /api/board/webhook/razorpay` → verify sig, read `payment.captured`, insert `board_payments` |
| `server/src/db/schema.ts` | `board_payments.razorpay_payment_id` (unique), `amount_paise`, `status` |
| `server/src/index.ts` | `express.raw` mount for `/api/board/webhook` |
| `client/src/components/board/RazorpayButton.tsx` | Loads checkout.js, opens Razorpay modal — **delete** |
| `client/src/components/board/BoostModal.tsx` | Amount input + `RazorpayButton` + poll-for-activation |
| `client/src/lib/api.ts` | `createBoardOrder` → `POST /api/board/orders` |
| `client/src/types.ts` | `BoardOrder`, `razorpayPaymentId` |
| `docs/ARCHITECTURE.md` | Razorpay flow docs |

---

## 4. Target architecture (Dodo only)

```
[BoostModal]
    │ amount (₹) → amountPaise
    ▼
[POST /api/board/orders]  (server, public)
    │ validate listingId + amountPaise ≥ BOARD_MIN_PAISE
    │ createDodoCheckout(...)  →  { checkoutUrl, sessionId }
    ▼
{ checkoutUrl, sessionId }
    │
[DodoPayButton]  →  window.open(checkoutUrl, "_blank")
    ▼
[POST /api/board/webhook/dodo]  (express.raw)
    │ verify StdWebhooks → payment.succeeded
    │ recordPayment({ paymentId, amountPaise, listingId })
    │ insert board_payments idempotently (unique payment_id)
    │ amount ≥ MIN → activate pending listing + add to bid; else flag
    ▼
[BoostModal polls GET /api/board/listings until status/rank changes]
```

### 4.1 Dodo lib

```ts
// server/src/lib/dodo.ts
export function getDodoEnvironment(): "test_mode" | "live_mode";
export function getDodoApiKey(): string;
export function getDodoWebhookKey(): string;
export function getDodoProductId(): string;

export function getDodoClient(): DodoPayments; // lazy singleton

export async function createDodoCheckout(params: {
  listingId: string;
  amountPaise: number;
}): Promise<{ checkoutUrl: string; sessionId: string; amountPaise: number; currency: string }>;

export function verifyDodoWebhook(rawBody: Buffer | string, headers: Record<string, string>): unknown;
```

---

## 5. Data model change

`board_payments` becomes Dodo-native — Razorpay is dropped:

- Rename `razorpay_payment_id` → `payment_id` (unique index → `board_payments_payment_id_idx`).
  Column name stays **generic** — no provider prefix, so a future provider swap needs no rename.
- No `provider` column (single provider).
- Existing Razorpay rows keep their id under `payment_id` (no data loss; historical rows are simply
  legacy records).

```ts
export const boardPayments = pgTable("board_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id").notNull().references(() => boardListings.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  paymentId: text("payment_id").notNull(),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  status: text("status").notNull().default("captured"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  paymentIdUnique: uniqueIndex("board_payments_payment_id_idx").on(table.paymentId),
  listingIdIdx: index("board_payments_listing_id_idx").on(table.listingId),
  capturedAtIdx: index("board_payments_captured_at_idx").on(table.capturedAt),
}));
```

## 6. Environment / configuration

| Var | Required | Notes |
|-----|----------|-------|
| `BOARD_MIN_PAISE` | no | unchanged, default `9900` |
| `CLIENT_BASE_URL` | no | base URL for Dodo `return_url`/`cancel_url`; default `http://localhost:5173` |
| `DODO_PAYMENTS_API_KEY` | yes | server-side secret (test-mode in dev, live-mode in prod) |
| `DODO_PAYMENTS_ENVIRONMENT` | no | `test_mode` (default in dev) / `live_mode` |
| `DODO_PAYMENTS_WEBHOOK_KEY` | yes | webhook signing secret |
| `DODO_PRODUCT_ID` | yes | PWYW one-time product id (`pdt_...`) |

All Razorpay vars (`RAZORPAY_*`, `VITE_RAZORPAY_PAYMENT_PAGE_URL`) are **removed** from `.env.example`.

---

## 7. Subtasks

Each subtask is a self-contained chunk of code, independently reviewable and shippable.
Order matters: 1 → 2 → 3 → 4 → 5 → 6.

---

### Subtask 1 — Dodo lib (`~250 LOC`)

**Files**
- `server/src/lib/dodo.ts` (new) — client, checkout creation, webhook verify
- `server/package.json` (add `dodopayments` dependency)

**Scope**
1. Add `dodopayments` to `server` deps.
2. `dodo.ts`:
   - `getDodoEnvironment()` / `getDodoApiKey()` / `getDodoWebhookKey()` / `getDodoProductId()`
     from env.
   - Lazy singleton `getDodoClient()` (`bearerToken`, `environment`, `webhookKey`).
   - `createDodoCheckout({ listingId, amountPaise })` → `checkoutSessions.create` with
     `product_cart: [{ product_id, quantity: 1, amount }]`, `metadata: { listingId }`,
     `return_url`/`cancel_url` from `CLIENT_BASE_URL`, `customization: { theme: "dark" }`,
     `feature_flags: { redirect_immediately: true }`.
     Returns `{ checkoutUrl, sessionId, amountPaise, currency: "INR" }`.
   - `verifyDodoWebhook(rawBody, headers)` → `client.webhooks.unwrap(...)`.

**Acceptance**
- `npm run lint` passes.

---

### Subtask 2 — DB schema migration (`~300 LOC` incl. generated migration)

**Files**
- `server/src/db/schema.ts` (edit board_payments block per §5)
- `server/drizzle/0017_<name>.sql` + `meta/0017_snapshot.json` + `_journal.json` (generated)

**Scope**
1. Edit `board_payments`: rename `razorpayPaymentId` → `paymentId` (column `payment_id`), rename
   unique index to `board_payments_payment_id_idx`.
2. Run `npm run db:generate -w server`; inspect SQL so the rename is `ALTER TABLE ... RENAME COLUMN`
   (if drop+add, add `UPDATE board_payments` backfill to preserve data).
3. Existing rows keep their id under `payment_id` (no data loss).
4. Verify `npm run db:migrate -w server` on a scratch DB.

**Note**
- Migration `0016_enable_rls_on_public_tables.sql` already exists on `main` (post-rebase). The
  board_payments rename is the **next** migration, so it generates as `0017_*`, not `0016_*`.

**Acceptance**
- Migration runs; existing rows preserved; unique index on `payment_id`.

---

### Subtask 3 — Checkout route + webhook handler (`~350 LOC`)

**Files**
- `server/src/routes/board.ts` (edit `POST /orders` to use Dodo)
- `server/src/routes/board-webhook.ts` (replace `/razorpay` with `/dodo`)
- `server/src/lib/razorpay.ts` (delete)

**Scope**
1. `POST /orders`: replace `createRazorpayOrder` with `createDodoCheckout`, returning
   `{ checkoutUrl, sessionId }`. Keep validation (`listingId` exists, `amountPaise` finite/int/`>= MIN_PAISE`) unchanged.
2. Map Dodo errors to clean `{ error }` JSON (no stack leaks).
3. `board-webhook.ts`: replace the `/razorpay` handler with `/dodo`:
   - Verify via `verifyDodoWebhook` (Standard Webhooks headers); on failure 400.
   - Switch on `payload.type`: `payment.succeeded` → process; else `200 { status:"ignored" }`.
   - Extract `data.payment_id`, `data.amount` (paise), `listingId` from `metadata.listingId`
     (fallback: `GET /payments/{payment_id}` via SDK if metadata absent).
   - Idempotent `insert ... onConflictDoNothing({ target: paymentId })`,
     then `amountPaise >= MIN_PAISE` → `captured` + activate `pending_payment`; else `flagged`.
4. `getListingRank`/`bidExpr`/`paymentJoin` untouched (read `amount_paise` + `status`, unchanged).
5. Delete `server/src/lib/razorpay.ts`; remove its imports.

**Acceptance**
- `POST /orders` returns `{ checkoutUrl, sessionId }`; `dodo wh trigger payment.succeeded` creates a
  `board_payments` row; replays don't duplicate.

---

### Subtask 4 — Client: Dodo checkout button (`~250 LOC`)

**Files**
- `client/src/components/board/DodoPayButton.tsx` (new)
- `client/src/components/board/BoostModal.tsx` (edit — render `DodoPayButton`)
- `client/src/lib/api.ts` (edit `createBoardOrder` return type)
- `client/src/types.ts` (edit `BoardOrder` → `{ checkoutUrl, sessionId }`)
- `client/src/components/board/RazorpayButton.tsx` (delete)

**Scope**
1. `types.ts`: `BoardOrder` becomes `{ checkoutUrl: string; sessionId: string; amountPaise: number; currency: string }`.
2. `api.ts`: `createBoardOrder` returns the new shape.
3. `DodoPayButton.tsx`: no script, no SDK — on click `createBoardOrder` → `window.open(checkoutUrl, "_blank")`;
   loading/error styling matches the old `RazorpayButton`.
4. `BoostModal.tsx`: swap `RazorpayButton` → `DodoPayButton`; copy becomes gateway-neutral
   ("A secure checkout opens. Complete the payment — we'll confirm automatically."). Polling unchanged.
5. Delete `RazorpayButton.tsx`.

**Acceptance**
- Modal checkout renders; new-tab flow works; `npm run lint` passes.

---

### Subtask 5 — Product reframing: UI + copy (`~250 LOC`)

**Files**
- `client/src/content/staticPages.ts` (terms + FAQ copy)
- `client/src/components/board/*` (labels, aria text, verbs)
- `client/src/views/` (route copy, page titles)
- `docs/ARCHITECTURE.md` (user-facing "bidding board" → "sponsored board")

**Scope**
1. Apply the §2.4 mapping table end-to-end:
   - "Bidding board" → "Sponsored board" / "Boost board" in labels + titles.
   - Action verbs "Bid" → "Boost" / "Sponsor" only.
   - Payment copy "bid" → "one-time placement fee" / "boost fee".
   - Terms/FAQ "All bidding board payments are non-refundable" →
     "Sponsored placement fees are non-refundable".
   - Remove any "outbid / win / lose" language.
2. Update aria-labels and alt text to match new copy.
3. `docs/ARCHITECTURE.md`: rename "bidding board" → "sponsored board" where user-facing.
4. Database/API identifiers (`/api/board`, `board_*`, `bidPaise`) stay internal — do not rename.

**Acceptance**
- No user-facing "bidding"/"bid" language remains; `npm run lint` passes.

---

### Subtask 6 — Wiring, env, docs (`~250 LOC`)

**Files**
- `server/src/index.ts` (confirm webhook route served under `express.raw`)
- `.env.example` files (server + client) — add Dodo vars, remove Razorpay vars
- `docs/ARCHITECTURE.md` — document Dodo flow, updated data-model + API tables

**Scope**
1. Confirm `/api/board/webhook/dodo` is served under `express.raw`.
2. Document all env vars (§6) in `.env.example`; **remove** Razorpay vars.
3. Rewrite `ARCHITECTURE.md` payment-flow section to describe the Dodo integration.
4. Run `npm run build` (client then server) and `npm run lint`.

**Acceptance**
- Build + lint green; docs match code.

---

## 8. Testing & rollout

1. **Dodo test mode**: create a Dodo test-mode PWYW product (min ₹99), set
   `DODO_PAYMENTS_ENVIRONMENT=test_mode`, use Dodo test cards/UPI from
   `docs.dodopayments.com/miscellaneous/testing-process`.
2. **Webhooks locally**: `dodo wh listen` (test-mode key) forwards real events to
   `http://localhost:3000/api/board/webhook/dodo`; `dodo wh trigger` for mock payloads (mock
   payloads are unsigned → use `unsafe_unwrap` only in a dev-only guard).
3. **End-to-end**: create listing → Boost ₹150 → complete test checkout → `pending_payment`
   → `active`, `bidPaise` increments, rank reorders.
4. **Compliance gate**: only set `DODO_PAYMENTS_ENVIRONMENT=live_mode` after written approval from
   `compliance@dodopayments.com` (§2.2).

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Dodo compliance rejects "bidding" framing | Pre-approve with `compliance@`; market as "sponsored boost / placement fee" |
| `metadata` not present on Dodo webhook payload | Fallback `GET /payments/{id}` in Subtask 3 |
| INR e-mandate / UPI specifics differ from current setup | Follow `features/payment-methods/india`; keep `MIN_PAISE` floor |
| `checkout_url` reuse (24h expiry) | Generate fresh session per click; never cache |
| MoR fees differ from previous Razorpay PG fees | Re-check `BOARD_MIN_PAISE` after seeing Dodo fee schedule |
| Legacy Razorpay rows in `board_payments` | Preserved via rename; no data loss, treated as historical records |
