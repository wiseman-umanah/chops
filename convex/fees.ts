/**
 * Shared fee constants and computation helper.
 *
 * Single source of truth for ALL fee math in the Chop backend.
 * The frontend mirrors these constants in frontend/src/lib/fees.ts.
 *
 * Fee model:
 *   Platform fee  = min(amountDue * 2%, ₦2,000)   — our revenue
 *   Bachs est.    = min(checkoutAmount * 1.5%, ₦2,000)  — Bachs' processing (customer bears)
 *   Withdrawal    = ₦50 flat (Bachs bank transfer fee)   — deducted from pot
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Our platform service fee rate (2%) */
export const PLATFORM_FEE_RATE = 0.02;

/** Hard cap on platform fee per contribution — ₦2,000 in kobo */
export const PLATFORM_FEE_CAP_KOBO = 200_000;

/** Bachs bank transfer checkout rate (1.5%) — used for estimation only */
export const BACHS_BANK_TRANSFER_RATE = 0.015;

/** Hard cap on Bachs bank transfer processing — ₦2,000 in kobo */
export const BACHS_BANK_TRANSFER_CAP_KOBO = 200_000;

/** Flat fee Bachs charges per NGN bank payout — ₦50 in kobo */
export const BACHS_WITHDRAWAL_FEE_KOBO = 5_000;

// ── Computation ───────────────────────────────────────────────────────────────

export interface FeeBreakdown {
  /** The payer's pure share / contribution — no fees */
  amountDueKobo: number;
  /** Our 2% platform fee, capped at ₦2,000 */
  platformFeeKobo: number;
  /** amountDueKobo + platformFeeKobo — what we send to Bachs as pricing.amount */
  checkoutAmountKobo: number;
  /** Estimated Bachs processing (1.5% capped ₦2,000) — Bachs adds this on top when customer_bears_fee: true */
  estimatedBachsFeeKobo: number;
  /** checkoutAmountKobo + estimatedBachsFeeKobo — the total the payer will actually be charged */
  estimatedTotalKobo: number;
}

/**
 * Computes all fee components for a given contribution/share amount.
 *
 * @param amountDueKobo — the pure share or contribution amount (integer kobo, no fees included)
 * @returns FeeBreakdown with all fee components
 */
export function computeFees(amountDueKobo: number): FeeBreakdown {
  const platformFeeKobo = Math.min(
    Math.round(amountDueKobo * PLATFORM_FEE_RATE),
    PLATFORM_FEE_CAP_KOBO
  );
  const checkoutAmountKobo = amountDueKobo + platformFeeKobo;
  const estimatedBachsFeeKobo = Math.min(
    Math.round(checkoutAmountKobo * BACHS_BANK_TRANSFER_RATE),
    BACHS_BANK_TRANSFER_CAP_KOBO
  );
  return {
    amountDueKobo,
    platformFeeKobo,
    checkoutAmountKobo,
    estimatedBachsFeeKobo,
    estimatedTotalKobo: checkoutAmountKobo + estimatedBachsFeeKobo,
  };
}
