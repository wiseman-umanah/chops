# Chop — Payments & Fee Overhaul Plan

## Overview

Replace the current ad-hoc, mode-specific fee system with a single, clean fee model across all three modes (Food, Bill, Chop-in):

- **Platform fee:** 2% of `amount_due`, hard-capped at ₦2,000 (200,000 kobo)
- **Bachs processing:** passed to payer via `customer_bears_fee: true` — we never absorb it
- **Withdrawal fee:** ₦50 flat (unchanged), deducted from pot
- **Summary card:** shown to payer before payment (share / service fee / processing est. / total)

All monetary values remain integer kobo internally. API boundary converts to/from NGN decimal strings.

---

## Architecture decisions locked in

| Decision | Choice |
|---|---|
| `customer_bears_fee` | `true` on all Bachs checkout sessions |
| Platform fee formula | `min(amountDueKobo * 0.02, 200_000)` kobo |
| Fee computed when | At checkout time (not session creation) |
| `feePerParticipant` on session | **Removed** — no longer stored |
| `feePercent` on session | **Removed** — no longer stored |
| `platformFeeKobo` on participant | **Added** — stored at checkout initiation; for chop-in = `min(contributionAmount * 0.02, 200_000)` |
| `bachsFeeKobo` on participant | **Added** — populated from webhook `data.fees.amount` |
| Pot credit on webhook | `amountOwed` only (platform fee ledgered separately) |
| Chop-in withdrawal fee | ₦50 flat only — no percentage taken |
| Summary card "Total to pay" | `checkoutAmountKobo + estimatedBachsFeeKobo` — includes estimated processing |
| Legacy unpaid sessions | Migrate `amountOwed` to pure share by stripping stored `feePerParticipant`; guard in `initiateCheckout` detects old rows and skips re-adding fee |

---

## Sub-Tasks

---

### Task 1 — Shared fee helper + schema changes

**Intent:** Single source of truth for fee math. Schema changes are prerequisite for everything else.

**Expected Outcomes:**
- `convex/fees.ts` exports `computeFees(amountDueKobo)` returning `{ amountDue, platformFeeKobo, checkoutAmountKobo, estimatedBachsFeeKobo }`
- `participants` table has new optional fields `platformFeeKobo` and `bachsFeeKobo`
- `sessions` table no longer uses `feePerParticipant` or `feePercent` (fields made optional/removed from schema — keep as optional for backward compat with existing rows, just stop writing them)
- All fee constants live in `convex/fees.ts` and nowhere else

**Todo List:**
- [ ] Create `convex/fees.ts` with constants and `computeFees` function:
  ```
  PLATFORM_FEE_RATE = 0.02
  PLATFORM_FEE_CAP_KOBO = 200_000        // ₦2,000
  BACHS_BANK_TRANSFER_RATE = 0.015
  BACHS_BANK_TRANSFER_CAP_KOBO = 200_000  // ₦2,000
  BACHS_WITHDRAWAL_FEE_KOBO = 5_000       // ₦50

  computeFees(amountDueKobo: number) -> {
    amountDueKobo,
    platformFeeKobo,          // min(amountDueKobo * 0.02, 200_000)
    checkoutAmountKobo,       // amountDueKobo + platformFeeKobo
    estimatedBachsFeeKobo,    // min(checkoutAmountKobo * 0.015, 200_000)
  }
  ```
- [ ] Add `platformFeeKobo: v.optional(v.number())` and `bachsFeeKobo: v.optional(v.number())` to `participants` table in `convex/schema.ts`
- [ ] Keep `feePerParticipant` and `feePercent` on `sessions` table as `v.optional` (backward compat — existing rows keep their values, new sessions won't set them)

**Relevant Context:**
- `convex/schema.ts` — participants and sessions table definitions
- No existing fee helper file — this is new

**Status:** [x] done

---

### Task 1b — Legacy session migration

**Intent:** Existing unpaid participants have `amountOwed` that already includes the old flat fee baked in. If `initiateCheckout` runs the new 2% formula on top of that, those payers get double-charged. This task strips the stored `feePerParticipant` from any unpaid participant rows whose session has a `feePerParticipant` set, making them clean before the new checkout logic goes live.

**Expected Outcomes:**
- A Convex internal mutation `migrateUnpaidParticipants` in `convex/migrations.ts` that:
  - Finds all sessions with `feePerParticipant` set (old food/bill sessions)
  - For each, finds all `"pending"` participants
  - Patches their `amountOwed` to `amountOwed - session.feePerParticipant` (strips the old fee)
  - Is idempotent — safe to run twice (skips participants whose `amountOwed` already equals pure share)
- A `migrateChopInFeePercent` mutation that finds all sessions with `feePercent` set and marks them for awareness (chop-in `amountOwed` is 0 at creation, so no participant patching needed — just note that their withdrawal will now use ₦50 flat instead of 1.5%)
- Guard in `initiateCheckout` (Task 2): if participant row already has `platformFeeKobo` set, skip re-computing (idempotency guard for retries)
- Script documented to run once via `npx convex run convex/migrations:migrateUnpaidParticipants`

**Todo List:**
- [ ] Create `convex/migrations.ts` with `migrateUnpaidParticipants` internal mutation
- [ ] For each session with `feePerParticipant != null`: query pending participants, patch `amountOwed = amountOwed - feePerParticipant`, skip if already clean
- [ ] Add note in code that this is a one-time migration — safe to re-run
- [ ] Document run command in the file header

**Relevant Context:**
- `convex/schema.ts` — `sessions.feePerParticipant` (optional number), `participants.amountOwed`
- `convex/sessions.ts` — `computeFlatFeePerParticipant` to understand what was baked in
- Must run **before** deploying Task 2 (`initiateCheckout` changes) to production

**Status:** [ ] pending

---

### Task 2 — Update `initiateCheckout` (payments.ts)

**Intent:** Switch from "fee baked into amountOwed" to "pure amountOwed + platformFee computed at checkout, sent with customer_bears_fee: true".

**Expected Outcomes:**
- `initiateCheckout` uses `computeFees(participant.amountOwed)` to get `platformFeeKobo` and `checkoutAmountKobo`
- Bachs checkout body includes `customer_bears_fee: true` and `pricing.amount` = `checkoutAmountKobo / 100` as decimal string
- `platformFeeKobo` is stored on the participant row at checkout initiation (via `internalPatchPlatformFee` or inline patch)
- Chop-in path: `computeFees(args.amountKobo)` where `amountKobo` is the contribution (not including any fee)
- Food/Bill path: `computeFees(participant.amountOwed)` where `amountOwed` is the pure share (no fee)
- Guard: if participant already has `platformFeeKobo` set, use stored value (idempotency — retry-safe)

**Todo List:**
- [ ] Import `computeFees` and `BACHS_WITHDRAWAL_FEE_KOBO` from `convex/fees.ts`
- [ ] In Food/Bill path: after resolving participant, call `computeFees(participant.amountOwed)` to get checkout figures; skip if `platformFeeKobo` already set on participant
- [ ] In Chop-in path: after reserving participant, call `computeFees(args.amountKobo)` to get checkout figures
- [ ] Add `customer_bears_fee: true` to the Bachs checkout request body
- [ ] Update `pricing.amount` to use `checkoutAmountKobo / 100`
- [ ] After creating checkout session (or after reserving chop-in participant), patch the participant row with `platformFeeKobo`
- [ ] Add `internalPatchPlatformFee` internal mutation to `payments.ts` or `participants.ts` if needed

**Relevant Context:**
- `convex/payments.ts` — `initiateCheckout` action (lines ~100–200)
- `convex/fees.ts` — new file from Task 1
- `convex/participants.ts` — `getParticipantById` and existing patch internals

**Status:** [ ] pending

---

### Task 3 — Update `createSession` (sessions.ts)

**Intent:** Stop computing and storing `feePerParticipant`/`feePercent` at session creation. Participant `amountOwed` should be the pure share with no fee baked in.

**Expected Outcomes:**
- `createSession` no longer calls `computeFlatFeePerParticipant`
- For Food: `amountOwed` = items subtotal + proportional tax/tip (no fee added)
- For Bill equal: `amountOwed` = `Math.round(totalAmount / N)`
- For Bill custom: `amountOwed` = specified amount
- For Bill percentage: `amountOwed` = `Math.round(totalAmount * pct / 100)`
- For Chop-in: `amountOwed` remains 0 at creation (contribution set at checkout time)
- `feePerParticipant` is not set on new sessions; `feePercent` is not set on new sessions
- `computeFlatFeePerParticipant` function can be removed from `sessions.ts`

**Todo List:**
- [ ] Remove `feePerParticipant` calculation from `createSession` for food/bill modes
- [ ] Remove `feePercent = 1.5` from `createSession` for chop-in mode
- [ ] Update each participant `amountOwed` assignment to exclude fee:
  - Food: `amountOwed = share` (no `+ feePerParticipant`)
  - Bill: `amountOwed = base/custom/percentage_share` (no `+ feePerParticipant`)
- [ ] Remove or mark `computeFlatFeePerParticipant` as unused and delete it
- [ ] Do not set `feePerParticipant` or `feePercent` on the inserted session row

**Relevant Context:**
- `convex/sessions.ts` — `createSession` mutation (the large function ~line 80–270)
- `computeFlatFeePerParticipant` is defined and used only in `sessions.ts`

**Status:** [ ] pending

---

### Task 4 — Update webhook handler (http_actions.ts)

**Intent:** Store `bachsFeeKobo` from Bachs webhook; keep pot credit as `amountOwed` only.

**Expected Outcomes:**
- `collection.succeeded` handler extracts `data.fees.amount` (if present) and passes it to `updateParticipantStatus`
- `updateParticipantStatus` internal mutation accepts optional `bachsFeeKobo` arg and patches it onto the participant row
- Pot/collection total (used in `listCompletedChopIn` and `getSessionStats`) still sums `amountOwed` — no change needed there since `amountOwed` is already the pure share

**Todo List:**
- [ ] In `http_actions.ts` `collection.succeeded` block: extract `data.fees?.amount` → convert from NGN decimal string to kobo (`Math.round(parseFloat(fees.amount) * 100)`)
- [ ] Pass `bachsFeeKobo` to `internal.participants.updateParticipantStatus`
- [ ] In `convex/participants.ts` `updateParticipantStatus`: add optional `bachsFeeKobo: v.optional(v.number())` arg; patch it onto participant row if present
- [ ] Verify the webhook payload shape from Bachs docs — `data.fees.amount` may be `data.fees` object with `amount` field or top-level

**Relevant Context:**
- `convex/http_actions.ts` — `collection.succeeded` handler (lines ~112–163)
- `convex/participants.ts` — `updateParticipantStatus` internal mutation (lines ~85–139)
- Bachs webhook docs: `data.fees.amount` — verify field name in sandbox

**Status:** [ ] pending

---

### Task 5 — Update payout logic (payouts.ts)

**Intent:** Simplify chop-in withdrawal — remove 1.5% platform cut, keep only ₦50 Bachs withdrawal fee. Import constant from `fees.ts`.

**Expected Outcomes:**
- `listCompletedChopIn` query: `payoutKobo = collectedKobo - BACHS_WITHDRAWAL_FEE_KOBO` (no platform percentage)
- `requestPayout` action: same formula — only ₦50 deducted
- Both use `BACHS_WITHDRAWAL_FEE_KOBO` from `convex/fees.ts` instead of hardcoded `5000`
- `chopFeeKobo` field removed from the return shape of `listCompletedChopIn` (no longer meaningful); `bachsTransferFeeKobo` renamed to use the constant

**Todo List:**
- [ ] Import `BACHS_WITHDRAWAL_FEE_KOBO` from `convex/fees.ts`
- [ ] In `listCompletedChopIn`: remove `chopFeeKobo` calculation; set `payoutKobo = collectedKobo - BACHS_WITHDRAWAL_FEE_KOBO`; update returned fields
- [ ] In `requestPayout`: remove `chopFeeKobo` calculation; set `payoutKobo = collectedKobo - BACHS_WITHDRAWAL_FEE_KOBO`
- [ ] Update `amountStr` accordingly

**Relevant Context:**
- `convex/payouts.ts` — `listCompletedChopIn` (lines ~33–75) and `requestPayout` (lines ~211–380)
- `convex/fees.ts` — new file from Task 1

**Status:** [ ] pending

---

### Task 6 — Update SessionPayPage (summary card)

**Intent:** Show the full fee breakdown to payers before they click pay, matching the spec's summary card.

**Expected Outcomes:**
- For Food/Bill: summary card shows:
  - "Your share" = `amountOwed` (pure share, no fee)
  - "Service fee (2%, max ₦2,000)" = `platformFeeKobo`
  - "Processing (est.)" = `estimatedBachsFeeKobo`
  - "Total to pay" = `checkoutAmountKobo + estimatedBachsFeeKobo`
- For Chop-in: same lines but "Your contribution" instead of "Your share"
- Copy: "Your share goes to the group. Service fee supports the app. Processing is charged by the payment provider."
- The pay button amount reflects `checkoutAmountKobo` (what we send to Bachs; Bachs adds processing on top)
- `computeFees` is imported from a shared frontend helper that mirrors `convex/fees.ts`

**Todo List:**
- [ ] Create `frontend/src/lib/fees.ts` mirroring `convex/fees.ts` constants and `computeFees` function (same formula, TypeScript, no Convex imports)
- [ ] In `SessionPayPage`: compute `fees = computeFees(amountDueKobo)` where `amountDueKobo` is `currentParticipant.amountOwed` (food/bill) or `contributionKobo` (chop-in)
- [ ] Render summary card with 4 rows as specified above
- [ ] Update the pay button to show `formatNaira(fees.checkoutAmountKobo)` (what's actually charged by Bachs before processing)
- [ ] Add subtitle copy below the card

**Relevant Context:**
- `frontend/src/pages/session/SessionPayPage.tsx` — current pay section
- `frontend/src/lib/` — may not exist yet; create it

**Status:** [ ] pending

---

### Task 7 — Update creation page previews (Food, Bill, Chop-in)

**Intent:** Preview shown to organiser at session creation should use new 2% fee formula instead of old tiered flat fee.

**Expected Outcomes:**
- `ChopFoodPage` split preview: per-person fee line shows `computeFees(personShare).platformFeeKobo`
- `ChopBillPage` split preview: same
- `ChopInPage` preview: shows only ₦50 withdrawal fee (no percentage taken at withdrawal anymore)
- All three import from `frontend/src/lib/fees.ts`
- Old `computeFeePerParticipant` function removed from `ChopFoodPage` and `ChopBillPage`

**Todo List:**
- [ ] In `ChopFoodPage.tsx`: replace `computeFeePerParticipant` calls with `computeFees(personShareKobo).platformFeeKobo`; import from `@/lib/fees`
- [ ] In `ChopBillPage.tsx`: same replacement
- [ ] In `ChopInPage.tsx`: update fee preview — remove 1.5% line; keep only "Transfer fee (Bachs) −₦50" and "You receive ₦(Goal − 50)"
- [ ] Remove old `computeFeePerParticipant` function from both pages

**Relevant Context:**
- `frontend/src/pages/dashboard/ChopFoodPage.tsx` — `computeFeePerParticipant` defined inline (~line 25–38)
- `frontend/src/pages/dashboard/ChopBillPage.tsx` — same inline function
- `frontend/src/pages/dashboard/ChopInPage.tsx` — preview section with fee breakdown

**Status:** [ ] pending

---

### Task 8 — Update WalletPage withdrawal preview

**Intent:** Reflect new payout formula (₦50 only, no platform %) in the WithdrawModal breakdown.

**Expected Outcomes:**
- `WithdrawModal` shows: "Collected ₦X / Transfer fee (Bachs) −₦50 / You receive ₦(X−50)"
- "Platform fee (1.5%)" line is removed (platform revenue is now collected at contribution time, not withdrawal)
- Uses `BACHS_WITHDRAWAL_FEE_KOBO` from `frontend/src/lib/fees.ts`
- `WithdrawModalProps` interface updated: remove `chopFeeKobo`, keep `bachsTransferFeeKobo`

**Todo List:**
- [ ] In `WalletPage.tsx` `WithdrawModal`: remove `chopFeeKobo` prop and its display line
- [ ] Update "You receive" calculation to `collectedKobo - BACHS_WITHDRAWAL_FEE_KOBO`
- [ ] Import `BACHS_WITHDRAWAL_FEE_KOBO` from `@/lib/fees`
- [ ] Update `WithdrawModalProps` interface
- [ ] Update `listCompletedChopIn` return shape usage (after Task 5 removes `chopFeeKobo`)

**Relevant Context:**
- `frontend/src/pages/dashboard/WalletPage.tsx` — `WithdrawModal` component (lines ~25–290)
- `convex/payouts.ts` — `listCompletedChopIn` return shape (updated in Task 5)

**Status:** [ ] pending

---

### Task 9 — Typecheck + consistency audit

**Intent:** Verify no TypeScript errors, no orphaned references to old fee fields, and no frontend math inconsistency.

**Expected Outcomes:**
- `cd frontend && pnpm exec tsc --noEmit` passes with zero errors
- No remaining references to `feePerParticipant` being written (reads on old rows still OK)
- No remaining references to `feePercent` being written
- No remaining references to `computeFlatFeePerParticipant`
- `chopFeeKobo` removed from all frontend types and usage

**Todo List:**
- [ ] Run `pnpm exec tsc --noEmit` and fix all errors
- [ ] Grep for `feePerParticipant`, `feePercent`, `computeFlatFeePerParticipant`, `chopFeeKobo` — remove any write-side usages
- [ ] Confirm `convex/fees.ts` and `frontend/src/lib/fees.ts` are in sync (same constants, same formula)

**Status:** [ ] pending

---

## Notes for implementer

- **Backward compat:** existing sessions in the DB have `feePerParticipant` / `feePercent` set. Those sessions are already paid or in-flight — do not migrate them. The schema keeps those fields as `v.optional` so old rows are valid.
- **Bachs `fees.amount` field:** verify the exact JSON path in sandbox before Task 4. It may be `data.fees.amount` (object) or a top-level field. If absent, `bachsFeeKobo` stays `undefined`.
- **`customer_bears_fee` gross-up:** in sandbox, initiate one ₦1,000 checkout with `customer_bears_fee: true` and verify Bachs adds `min(1000 * 0.015, 2000) = ₦15` processing on top. This confirms our estimate formula.
- **Chop-in `amountOwed`:** for a reserved chop-in participant, `amountOwed` is set to the contribution amount at reservation time. `computeFees` in `initiateCheckout` will be called on that value. The participant row's `amountOwed` stays as the pure contribution — only `platformFeeKobo` is added as a separate field.
