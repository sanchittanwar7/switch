# Plan — Config-driven multi-gateway payments (Razorpay + Dodo)

## 1. Executive summary

Add **Dodo Payments** as a second payment gateway for the "Bidding Board" (`/api/board/*`) and
make the active gateway **config-driven via an env variable** (`PAYMENT_GATEWAY=razorpay|dodo`).
Razorpay blocks the "bidding" use case; Dodo supports variable-amount one-time payments natively
via **Pay What You Want (PWYW)**. **No Razorpay code is deleted** — both gateways coexist behind a
common interface, and flipping the env var swaps the entire flow (order creation → client checkout →
webhook capture).

This plan is split into **6 subtasks**, each sized to produce **300–500 lines of code**, covering
the gateway abstraction, DB migration, checkout dispatch, webhook handling, dual client UI, and
config/docs.

**Rollback = one env var.** If Dodo misbehaves in production, set `PAYMENT_GATEWAY=razorpay` and
you are back on the old path instantly.

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
   - URL: `https://<your-host>/api/board/webhook/dodo`.
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
- Use `checkout-integration` + `webhook-integration` skills when writing Subtasks 3–4.
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

The word **"bidding"** is what trips Razorpay and risks Dodo's MoR compliance. Reposition the
feature as a **sponsored placement / pay-to-boost** model. Mechanical behavior is unchanged
(cumulative sum = rank); only the framing and copy change.

| Surface | Current (risky) | New (safe) |
|---------|-----------------|------------|
| Product label | "Bidding board" | "Sponsored board" / "Boost board" |
| Action verb | "Bid" / "Boost" | "Boost" / "Sponsor" only |
| Payment described as | "bid" | "one-time placement fee" / "boost fee" |
| Terms/FAQ | "All bidding board payments are non-refundable" | "Sponsored placement fees are non-refundable" |
| Model explained as | "bidding" | "Pay a one-time fee to publish; higher cumulative fees rank higher" |
| Winner/loser language | any "outbid / win / lose" | remove — everyone stays listed |

**Files to update (do with Subtask 6):**
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

| Requirement | Razorpay | Dodo Payments |
|-------------|----------|---------------|
| Variable amount per payment (user types ₹ amount) | Blocked as "bidding" | ✅ **Pay What You Want** (PWYW) on one-time products; pass `amount` in paise per checkout session |
| Minimum payment floor (₹99) | ✅ `BOARD_MIN_PAISE` | ✅ PWYW `minimum_price` bound |
| Reference the listing on the payment | `notes.listingId` | ✅ checkout-session `metadata.listingId` |
| Server-side order/checkout creation | `POST /v1/orders` | ✅ `client.checkoutSessions.create(...)` |
| Webhook on capture | `payment.captured` + HMAC | ✅ `payment.succeeded` + Standard Webhooks (HMAC-SHA256) |
| Idempotency on retries | unique `razorpay_payment_id` | ✅ `webhook-id` header + unique `payment_id` |
| INR (paise) | ✅ | ✅ amount in lowest denomination (paise for INR) |
| Hosted checkout (no PCI) | ✅ hosted page | ✅ hosted `checkout_url` |

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
| `server/src/lib/razorpay.ts` | Mode/key/secret resolution, `createRazorpayOrder`, `verifyWebhookSignature` (HMAC-SHA256) |
| `server/src/routes/board.ts` | `POST /api/board/orders` → `createRazorpayOrder`, returns `orderId`/`keyId` |
| `server/src/routes/board-webhook.ts` | `POST /api/board/webhook/razorpay` → verify sig, read `payment.captured`, insert `board_payments` |
| `server/src/db/schema.ts` | `board_payments.razorpay_payment_id` (unique), `amount_paise`, `status` |
| `server/src/index.ts` | `express.raw` mount for `/api/board/webhook` |
| `client/src/components/board/RazorpayButton.tsx` | Loads checkout.js, opens Razorpay modal |
| `client/src/components/board/BoostModal.tsx` | Amount input + `RazorpayButton` + poll-for-activation |
| `client/src/lib/api.ts` | `createBoardOrder` → `POST /api/board/orders` |
| `client/src/types.ts` | `BoardOrder`, `razorpayPaymentId` |
| `docs/ARCHITECTURE.md` | Razorpay flow docs |

---

## 4. Target architecture (dual gateway, config-driven)

```
[BoostModal]
    │ amount (₹) → amountPaise
    ▼
[GET /api/board/gateway]  → { provider: "razorpay" | "dodo" }   (capability discovery)
    │
[PaymentButton]  (client — renders RazorpayButton OR DodoPayButton based on provider)
    ▼
[POST /api/board/orders]  (server, public)
    │ validate listingId + amountPaise ≥ BOARD_MIN_PAISE
    │ getPaymentGateway()  →  razorpay | dodo   (from PAYMENT_GATEWAY env)
    ├─ razorpay → createRazorpayOrder(...)         → { provider:"razorpay", orderId, keyId }
    └─ dodo     → createBoardCheckout(...)          → { provider:"dodo", checkoutUrl, sessionId }
    ▼
{ provider, ...provider-specific fields }
    │
    ├─ razorpay → in-page checkout modal (existing RazorpayButton)
    └─ dodo     → open checkoutUrl in new tab (new DodoPayButton)
    ▼
[webhook]  (both mounted, express.raw)
    ├─ POST /api/board/webhook/razorpay  → verify HMAC → payment.captured   (existing)
    └─ POST /api/board/webhook/dodo      → verify StdWebhooks → payment.succeeded (new)
    │ both call a shared `recordPayment({ provider, providerPaymentId, amountPaise, listingId })`
    │ insert board_payments idempotently (unique provider_payment_id)
    │ amount ≥ MIN → activate pending listing + add to bid; else flag
    ▼
[BoostModal polls GET /api/board/listings until status/rank changes]
```

### 4.1 Gateway abstraction

```ts
// server/src/lib/payments.ts
export type Provider = "razorpay" | "dodo";

export type CreateOrderResult =
  | { provider: "razorpay"; orderId: string; keyId: string; amountPaise: number; currency: string }
  | { provider: "dodo"; checkoutUrl: string; sessionId: string; amountPaise: number; currency: string };

export interface PaymentGateway {
  provider: Provider;
  createOrder(params: { listingId: string; amountPaise: number }): Promise<CreateOrderResult>;
}

export function getPaymentGateway(): PaymentGateway {
  const p = process.env.PAYMENT_GATEWAY;
  if (p === "dodo") return dodoGateway;
  return razorpayGateway; // default — preserves current behavior
}
```

Existing `lib/razorpay.ts` becomes the `razorpayGateway` implementation (wrapped, **not deleted**);
new `lib/dodo.ts` is the `dodoGateway`. The route and webhook handlers depend only on the
`PaymentGateway` interface + a shared `recordPayment` helper, never on a specific provider.

---

## 5. Data model change

`board_payments` becomes gateway-agnostic so **both** providers write into the same table:

- Rename `razorpay_payment_id` → `provider_payment_id` (unique index → `board_payments_provider_payment_id_idx`).
- Add `provider` `text` (default `"razorpay"`) to tag each row's source.
- Existing Razorpay rows are backfilled `provider='razorpay'` and keep their payment id (no data loss).

The existing Razorpay webhook insert changes **one field name** (`razorpayPaymentId` →
`providerPaymentId` + `provider: "razorpay"`); the Razorpay lib, button, and route are otherwise
untouched.

```ts
export const boardPayments = pgTable("board_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id").notNull().references(() => boardListings.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  provider: text("provider").notNull().default("razorpay"),
  providerPaymentId: text("provider_payment_id").notNull(),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  status: text("status").notNull().default("captured"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  providerPaymentIdUnique: uniqueIndex("board_payments_provider_payment_id_idx").on(table.providerPaymentId),
  listingIdIdx: index("board_payments_listing_id_idx").on(table.listingId),
  capturedAtIdx: index("board_payments_captured_at_idx").on(table.capturedAt),
}));
```

## 6. Environment / configuration

| Var | Required | Notes |
|-----|----------|-------|
| `PAYMENT_GATEWAY` | no | `razorpay` (default — current behavior) or `dodo`. Single switch for the whole flow. |
| `BOARD_MIN_PAISE` | no | unchanged, default `9900` |
| `CLIENT_BASE_URL` | no | base URL for Dodo `return_url`/`cancel_url`; default `http://localhost:5173` |
| **Razorpay (kept)** | | |
| `RAZORPAY_MODE` / `RAZORPAY_KEY_ID[_TEST|_LIVE]` / `RAZORPAY_KEY_SECRET[_TEST|_LIVE]` / `RAZORPAY_WEBHOOK_SECRET[_TEST|_LIVE]` | conditional | unchanged; required only when `PAYMENT_GATEWAY=razorpay` |
| `VITE_RAZORPAY_PAYMENT_PAGE_URL` | conditional | unchanged |
| **Dodo (new)** | | |
| `DODO_PAYMENTS_API_KEY` | conditional | server-side secret; required only when `PAYMENT_GATEWAY=dodo` |
| `DODO_PAYMENTS_ENVIRONMENT` | no | `test_mode` (default in dev) / `live_mode` |
| `DODO_PAYMENTS_WEBHOOK_KEY` | conditional | webhook signing secret |
| `DODO_PRODUCT_ID` | conditional | PWYW one-time product id (`pdt_...`) |

Razorpay vars are **not removed** — they stay in `.env.example`, documented as "used when
`PAYMENT_GATEWAY=razorpay`".

---

## 7. Subtasks

Each subtask is a self-contained chunk of **300–500 lines of code**, independently
reviewable and shippable. Order matters: 1 → 2 → 3 → 4 → 5 → 6.

---

### Subtask 1 — Gateway abstraction + Dodo lib (`~400 LOC`)

**Files**
- `server/src/lib/payments.ts` (new, ~120 LOC) — `Provider`, `CreateOrderResult`, `PaymentGateway`, `getPaymentGateway()`
- `server/src/lib/dodo.ts` (new, ~220 LOC) — client, checkout creation, webhook verify
- `server/src/lib/razorpay.ts` (edit, ~30 LOC) — keep everything, add a `razorpayGateway: PaymentGateway` adapter wrapper at the bottom (no existing function removed)
- `server/package.json` (add `dodopayments` dependency)

**Scope**
1. Add `dodopayments` to `server` deps.
2. `payments.ts`: define the shared `PaymentGateway` interface + `CreateOrderResult` union (§4.1).
   `getPaymentGateway()` reads `PAYMENT_GATEWAY` and returns the matching implementation;
   defaults to `razorpay` so nothing changes for existing deployments.
3. `dodo.ts`:
   - `getDodoEnvironment()` / `getDodoApiKey()` / `getDodoWebhookKey()` / `getDodoProductId()`
     with per-mode override (`_TEST`/`_LIVE`) mirroring the Razorpay pattern.
   - Lazy singleton `getDodoClient()` (`bearerToken`, `environment`, `webhookKey`).
   - `dodoGateway.createOrder({ listingId, amountPaise })` → `checkoutSessions.create` with
     `product_cart: [{ product_id, quantity: 1, amount }]`, `metadata: { listingId }`,
     `return_url`/`cancel_url` from `CLIENT_BASE_URL`, `customization: { theme: "dark" }`,
     `feature_flags: { redirect_immediately: true }`. Returns `{ provider: "dodo", checkoutUrl, sessionId, amountPaise, currency: "INR" }`.
   - `verifyDodoWebhook(rawBody, headers)` → `client.webhooks.unwrap(...)`.
4. `razorpay.ts`: wrap the **existing** `createRazorpayOrder` + `getKeyId` into
   `razorpayGateway.createOrder` returning `{ provider: "razorpay", orderId, keyId, ... }`.
   Do not remove `createRazorpayOrder`/`verifyWebhookSignature` (still used by the Razorpay webhook).

**Acceptance**
- `npm run lint` passes; `getPaymentGateway()` returns the correct impl for each `PAYMENT_GATEWAY`.

---

### Subtask 2 — DB schema migration (`~300 LOC` incl. generated migration)

**Files**
- `server/src/db/schema.ts` (edit board_payments block per §5)
- `server/src/routes/board-webhook.ts` (edit Razorpay insert — field rename only)
- `server/drizzle/0016_<name>.sql` + `meta/0016_snapshot.json` + `_journal.json` (generated)

**Scope**
1. Edit `board_payments`: rename `razorpayPaymentId` → `providerPaymentId`, add `provider`
   (default `"razorpay"`), rename unique index.
2. Update the Razorpay webhook `insert` to write `providerPaymentId` + `provider: "razorpay"`
   instead of `razorpayPaymentId`. No other Razorpay logic changes.
3. Run `npm run db:generate -w server`; inspect SQL so the rename is `ALTER TABLE ... RENAME COLUMN`
   (if drop+add, add `UPDATE board_payments SET provider='razorpay'` backfill and preserve data).
4. Backfill note: existing rows keep their id under `provider_payment_id`, `provider='razorpay'`.
5. Verify `npm run db:migrate -w server` on a scratch DB.

**Acceptance**
- Migration runs; existing Razorpay rows preserved; unique index on `provider_payment_id`.

---

### Subtask 3 — Checkout creation endpoint (provider dispatch) (`~350 LOC`)

**Files**
- `server/src/routes/board.ts` (edit `POST /orders`, add `GET /gateway`, imports)

**Scope**
1. Replace the direct `createRazorpayOrder` call in `POST /orders` with `getPaymentGateway().createOrder(...)`,
   returning the provider-tagged result (§4.1) to the client.
2. Keep existing validation (`listingId` exists, `amountPaise` finite/int/`>= MIN_PAISE`) unchanged.
3. Add `GET /api/board/gateway` → `{ provider }` so the client can pick a checkout button without
   creating an order first.
4. Map gateway errors to clean `{ error }` JSON (no stack leaks) — both providers.
5. `getListingRank`/`bidExpr`/`paymentJoin` untouched (read `amount_paise` + `status`, unchanged).

**Acceptance**
- `PAYMENT_GATEWAY=razorpay`: `POST /orders` returns `{ provider:"razorpay", orderId, keyId }`.
- `PAYMENT_GATEWAY=dodo`: returns `{ provider:"dodo", checkoutUrl, sessionId }`.
- `GET /gateway` reports the active provider.

---

### Subtask 4 — Webhook handlers (both providers) (`~400 LOC`)

**Files**
- `server/src/routes/board-webhook.ts` (add `/dodo`, refactor shared capture logic)
- `server/src/lib/payments.ts` (optional: `recordPayment` helper)

**Scope**
1. Keep the existing `/razorpay` handler as-is (signature verify → `payment.captured` → capture).
2. Add `POST /dodo`: verify via `verifyDodoWebhook` (Standard Webhooks headers); on failure 400.
3. Switch on `payload.type`: `payment.succeeded` → process; else `200 { status:"ignored" }`.
4. Extract `data.payment_id`, `data.amount` (paise), `listingId` from `metadata.listingId`
   (fallback: `GET /payments/{payment_id}` via SDK if metadata absent).
5. Extract a shared `recordPayment({ provider, providerPaymentId, listingId, amountPaise })` helper
   used by **both** handlers: idempotent `insert ... onConflictDoNothing({ target: providerPaymentId })`,
   then `amountPaise >= MIN_PAISE` → `captured` + activate `pending_payment`; else `flagged`.
6. Preserve existing `[board-webhook] ...` logging; tag with provider.

**Acceptance**
- Razorpay webhook still works end-to-end; `dodo wh trigger payment.succeeded` creates a
  `board_payments` row with `provider='dodo'`; replays don't duplicate.

---

### Subtask 5 — Client: dual checkout buttons + dispatch (`~450 LOC`)

**Files**
- `client/src/components/board/DodoPayButton.tsx` (new, ~150 LOC)
- `client/src/components/board/PaymentButton.tsx` (new dispatcher, ~120 LOC)
- `client/src/components/board/BoostModal.tsx` (edit — render `PaymentButton`)
- `client/src/lib/api.ts` (edit `createBoardOrder` + add `getBoardGateway`)
- `client/src/types.ts` (edit `BoardOrder` → provider-tagged union + `GatewayInfo`)
- `client/src/components/board/RazorpayButton.tsx` (kept, **no deletion**)

**Scope**
1. `types.ts`: `BoardOrder` becomes the provider-tagged union matching server `CreateOrderResult`;
   add `GatewayInfo = { provider: "razorpay" | "dodo" }`.
2. `api.ts`: `createBoardOrder` returns the union; add `getBoardGateway()` → `GET /api/board/gateway`.
3. `RazorpayButton.tsx`: keep exactly as-is (still loads checkout.js + opens modal).
4. `DodoPayButton.tsx`: no script, no SDK — on click `createBoardOrder` → `window.open(checkoutUrl, "_blank")`;
   same props/loading/error/styling as `RazorpayButton`.
5. `PaymentButton.tsx`: on mount, `getBoardGateway()`; render `RazorpayButton` or `DodoPayButton`
   accordingly. Handle unknown/loading/error provider states.
6. `BoostModal.tsx`: swap `RazorpayButton` → `PaymentButton`; copy becomes gateway-neutral
   ("A secure checkout opens. Complete the payment — we'll confirm automatically."). Polling unchanged.

**Acceptance**
- With `PAYMENT_GATEWAY=razorpay` the modal checkout renders; with `dodo` the new-tab flow renders.
  `npm run lint` passes.

---

### Subtask 6 — Wiring, env, docs, reframing (`~350 LOC`)

**Files**
- `server/src/index.ts` (mount — confirm both webhook routes served; no raw-body change needed)
- `.env.example` files (server + client) — add `PAYMENT_GATEWAY` + Dodo vars, keep Razorpay vars
- `docs/ARCHITECTURE.md` — document dual-gateway flow, env switch, updated data-model + API tables
- `client/src/content/staticPages.ts` — apply product reframing copy (§2.4)

**Scope**
1. Confirm `/api/board/webhook` serves both `/razorpay` and `/dodo` (both under `express.raw`).
2. Document all env vars (§6) in `.env.example`; **keep** Razorpay vars, mark them
   "used when `PAYMENT_GATEWAY=razorpay`".
3. Rewrite `ARCHITECTURE.md` payment-flow section to describe the gateway abstraction + switch.
4. Apply §2.4 reframing to `staticPages.ts` (terms/FAQ: "bidding" → "sponsored placement").
5. Run `npm run build` (client then server) and `npm run lint`.

**Acceptance**
- Build + lint green; both gateways selectable purely via `PAYMENT_GATEWAY`; docs match code.

---

## 8. Testing & rollout

1. **Razorpay regression**: `PAYMENT_GATEWAY=razorpay` → full flow must behave exactly as today
   (modal checkout, `/razorpay` webhook). This is the fallback path — test it first.
2. **Dodo test mode**: create a Dodo test-mode PWYW product (min ₹99), set
   `PAYMENT_GATEWAY=dodo` + `DODO_PAYMENTS_ENVIRONMENT=test_mode`, use Dodo test cards/UPI from
   `docs.dodopayments.com/miscellaneous/testing-process`.
3. **Webhooks locally**: `dodo wh listen` (test-mode key) forwards real events to
   `http://localhost:3000/api/board/webhook/dodo`; `dodo wh trigger` for mock payloads (mock
   payloads are unsigned → use `unsafe_unwrap` only in a dev-only guard).
4. **Switch test**: with the same listing, capture a payment on each gateway and confirm both rows
   land in `board_payments` with the correct `provider`, and the listing activates/boosts identically.
5. **End-to-end (dodo)**: create listing → Boost ₹150 → complete test checkout → `pending_payment`
   → `active`, `bidPaise` increments, rank reorders.
6. **Compliance gate**: only set `DODO_PAYMENTS_ENVIRONMENT=live_mode` (and `PAYMENT_GATEWAY=dodo`
   in prod) after written approval from `compliance@dodopayments.com` (§2.2).
7. **Rollback drill**: flip `PAYMENT_GATEWAY` back to `razorpay` and confirm instant reversion
   with zero code changes.

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Dodo compliance rejects "bidding" framing | Pre-approve with `compliance@`; market as "sponsored boost / placement fee" |
| Dodo misbehaves in production | `PAYMENT_GATEWAY=razorpay` — one-env-var rollback, no deploy |
| `metadata` not present on Dodo webhook payload | Fallback `GET /payments/{id}` in Subtask 4 |
| INR e-mandate / UPI specifics differ from Razorpay | Follow `features/payment-methods/india`; keep `MIN_PAISE` floor |
| `checkout_url` reuse (24h expiry) | Generate fresh session per click; never cache |
| Shared `provider_payment_id` collision across gateways | Ids are namespaced (`pay_...` vs `razorpay order id`); if ever ambiguous, switch unique index to `(provider, provider_payment_id)` |
| MoR fees differ from Razorpay PG fees | Re-check `BOARD_MIN_PAISE` after seeing Dodo fee schedule |
| Client/backend `PAYMENT_GATEWAY` drift | `GET /api/board/gateway` is the single source of truth for the UI |
