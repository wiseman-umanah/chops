# convex/

This directory is the entire Chop backend. It runs on [Convex](https://convex.dev) — a serverless TypeScript platform that provides the database, functions, file storage, and HTTP endpoints in one place.

---

## Running locally

```bash
# From the workspace root
pnpm dev:backend
```

This starts the Convex dev server and hot-reloads any file changed under `convex/`. Generated types are written to `convex/_generated/` automatically.

## Deploying to production

```bash
npx convex deploy --prod
```

---

## File map

| File | Purpose |
|---|---|
| `schema.ts` | Full database schema — all tables and indexes |
| `auth.ts` | Auth providers: Google OAuth + Password with Resend OTP reset |
| `auth.config.ts` | Convex Auth domain config (reads `CONVEX_SITE_URL`) |
| `http.ts` | HTTP router — mounts auth routes + the Bachs webhook |
| `http_actions.ts` | `bachsWebhook` — HMAC-verified handler for Bachs events |
| `sessions.ts` | Session CRUD, fee computation, slug generation |
| `participants.ts` | Participant queries, `updateParticipantStatus` (webhook path), `demoMarkPaid` |
| `payments.ts` | `initiateCheckout` action — calls Bachs to create a checkout session |
| `payouts.ts` | `listBanks`, `resolveAccount`, `requestPayout` actions; internal payout helpers |
| `notifications.ts` | Notification queries and mutations |
| `users.ts` | Profile read, avatar upload URL generation, profile update |

---

## Data model

### `sessions`
A "chop" session created by an organizer.

- `mode` — `"food"` | `"bill"` | `"chop-in"`
- `status` — `"active"` → `"closed"` → `"inactive"`
- `slug` — public URL identifier, format `CH-XXXXXXXX`
- All money fields in **kobo** (integer, never float)
- `feePerParticipant` — flat fee added to each participant's owed amount (food/bill)
- `feePercent` — percentage fee deducted at payout time (chop-in, currently 10%)

### `participants`
One row per person in a session.

- `status` — `"pending"` (not yet paid) | `"sent"` (payment confirmed)
- `amountOwed` — computed at session creation and stored; not re-derived on read
- `paymentRef` — set by the Bachs webhook after a successful collection
- `items` — food mode only: line items assigned to this participant

### `payouts`
One row per payout request made by an organizer.

- `status` — `"pending"` | `"processing"` | `"completed"` | `"failed"` | `"processed"` (legacy)
- `bachsPayoutId` — the `pay_...` ID from Bachs; used to match incoming payout webhooks
- `destinationId` — the `pd_...` Bachs destination ID for the recipient bank account

### `notifications`
In-app notifications for session organizers. Types: `"payment"` and `"session_closed"`.

### `users`
Extended from Convex Auth's built-in user table. Extra fields: `firstName`, `lastName`. `image` stores either a Google profile URL or a Convex Storage ID (resolved to a URL in `getMyProfile`).

---

## Payment flow

```
Browser → initiateCheckout action
        → POST /v1/checkout-sessions (Bachs)
        → redirect user to checkout_url

Bachs → POST /bachs-webhook
      → HMAC-SHA256 signature verified
      → collection.succeeded  → updateParticipantStatus → (auto-close session if all paid)
      → payout.paid           → updatePayoutStatus("completed") + setSessionStatus("inactive")
      → payout.failed         → updatePayoutStatus("failed") + notify organizer
```

### Chop In pre-insertion pattern
For chop-in sessions, a `"pending"` participant row is inserted **before** the Bachs redirect (`reserveChopInParticipant`) so the webhook has a stable ID to act on. If the user abandons payment the row stays pending harmlessly.

---

## Fee structure

**Food / Bill** — tiered flat fee split equally across participants, baked into `amountOwed` at creation:

| Session total | Total fee |
|---|---|
| < ₦5,000 | ₦100 |
| < ₦10,000 | ₦150 |
| < ₦20,000 | ₦200 |
| < ₦50,000 | 0.75% |
| ₦50,000+ | 0.5% |

**Chop In** — 10% deducted from collected total at the point of payout withdrawal.

---

## Bachs API notes

- Base URL switches on `BACHS_ENV === "production"`: sandbox vs `https://api.bachs.io/v1`
- All responses are **flat** — no `data` wrapper
- Money amounts are **decimal naira strings** e.g. `"750.00"` — convert: `(kobo / 100).toFixed(2)`
- Payout webhook ID is in `data.withdrawal_id`, not `data.id`
- Sandbox never credits collected balance → `INSUFFICIENT_BALANCE` is bypassed with a simulated success when not in production mode

---

## Required environment variables

Set these in the [Convex dashboard](https://dashboard.convex.dev) under your deployment's Settings → Environment Variables.

| Variable | Purpose |
|---|---|
| `CONVEX_SITE_URL` | Full URL of the frontend, used as the auth domain |
| `SITE_URL` | Same as above (used by `@convex-dev/auth` internally) |
| `JWT_PRIVATE_KEY` | RSA private key for signing JWTs |
| `JWKS` | Matching public key set (JSON) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_RESEND_KEY` | Resend API key (`re_...`) for OTP emails |
| `AUTH_EMAIL_FROM` | Verified sender address e.g. `Chops <noreply@yourdomain.com>` |
| `BACHS_SECRET_KEY` | Bachs API key (`sk_live_...` in production) |
| `BACHS_WEBHOOK_SECRET` | Bachs webhook signing secret (`whsec_...`) |
| `BACHS_ENV` | Set to `"production"` on the prod deployment; omit for sandbox |
