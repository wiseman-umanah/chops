/**
 * Frontend fee helper — mirrors convex/fees.ts exactly.
 * Keep in sync with the backend constants.
 */

export const PLATFORM_FEE_RATE = 0.02;
export const PLATFORM_FEE_CAP_KOBO = 200_000;       // ₦2,000
export const BACHS_BANK_TRANSFER_RATE = 0.015;
export const BACHS_BANK_TRANSFER_CAP_KOBO = 200_000; // ₦2,000
export const BACHS_WITHDRAWAL_FEE_KOBO = 5_000;      // ₦50

export interface FeeBreakdown {
  amountDueKobo: number;
  platformFeeKobo: number;
  checkoutAmountKobo: number;
  estimatedBachsFeeKobo: number;
  estimatedTotalKobo: number;
}

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
