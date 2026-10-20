/**
 * Frontend fee helpers — mirrors convex/fees.ts exactly.
 * Keep in sync with the backend constants.
 *
 * Fee model (food & bill only — chop-in is separate):
 *   Settlement fee  = dynamic (participant-count + amount based), capped ₦800
 *   Bachs fee       = 1.5% gross-up so the pot receives exactly the principal
 *   Withdrawal      = ₦50 flat (Bachs bank transfer fee) — deducted from pot at payout
 *
 * The TARGET AMOUNT (pot) is always 100% intact.
 * All fees are borne by the participant on top of their share.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

export const SMALL_GROUP_LIMIT    = 7;
export const SMALL_GROUP_FEE      = 70;    // ₦70 flat for ≤7 participants
export const PER_PERSON_FEE       = 10;    // ₦10 per person for >7 participants
export const PERCENTAGE_RATE      = 0.004; // 0.4% of target amount
export const MINIMUM_FEE_NAIRA    = 70;    // ₦70 minimum
export const MAXIMUM_FEE_NAIRA    = 800;   // ₦800 hard cap
export const BACHS_RATE           = 0.015; // 1.5% gross-up
export const BACHS_WITHDRAWAL_FEE_KOBO    = 5_000;    // ₦50 flat payout fee
/** Below this collected amount, the ₦50 transfer fee is charged to the organiser */
export const CHOPIN_FEE_THRESHOLD_KOBO    = 500_000;  // ₦5,000
/** Minimum contribution allowed for chop-in (₦100) */
export const CHOPIN_MIN_CONTRIBUTION_KOBO = 10_000;   // ₦100

// ── Settlement fee (food & bill) ──────────────────────────────────────────────

/**
 * Calculates the total settlement fee in NAIRA (whole naira, ceiling).
 *
 * @param targetAmountKobo  — total bill / pot in kobo
 * @param participantCount  — number of participants
 */
export function calculateSettlementFeeNaira(
  targetAmountKobo: number,
  participantCount: number
): number {
  const targetNaira = targetAmountKobo / 100;

  let fee = participantCount <= SMALL_GROUP_LIMIT
    ? SMALL_GROUP_FEE
    : participantCount * PER_PERSON_FEE;

  const percentageFee = targetNaira * PERCENTAGE_RATE;
  fee = Math.max(fee, percentageFee);
  fee = Math.max(fee, MINIMUM_FEE_NAIRA);
  fee = Math.min(fee, MAXIMUM_FEE_NAIRA);

  return Math.ceil(fee); // whole naira, always round up
}

// ── Per-participant breakdown ──────────────────────────────────────────────────

export interface ParticipantFeeBreakdown {
  /** Pure bill share — goes to the pot intact */
  principalShareKobo: number;
  /** This person's proportional share of the settlement fee (kobo) */
  feeShareKobo: number;
  /** Bachs 1.5% gross-up charged on top (kobo) */
  processingFeeKobo: number;
  /** What the participant actually taps "Pay" for (kobo) */
  finalAmountKobo: number;
}

/**
 * Computes per-participant fee breakdown for food & bill modes.
 *
 * @param principalShareKobo   — this person's share of the bill (kobo)
 * @param targetAmountKobo     — total session amount (kobo) — used for proportion
 * @param settlementFeeNaira   — total settlement fee (naira) from calculateSettlementFeeNaira
 */
export function computeParticipantFees(
  principalShareKobo: number,
  targetAmountKobo: number,
  settlementFeeNaira: number
): ParticipantFeeBreakdown {
  const proportion = targetAmountKobo > 0 ? principalShareKobo / targetAmountKobo : 0;
  // Round up to the nearest whole naira (100 kobo) so the final charge is always
  // a clean whole-naira amount — avoids fractional kobo mismatch at Bachs checkout.
  const feeShareKobo = Math.ceil(proportion * settlementFeeNaira) * 100;

  // Amount we need Bachs to pass through to the pot (principal + settlement share)
  const amountBeforeBachsKobo = principalShareKobo + feeShareKobo;

  // Gross-up: Net / (1 - 0.015) so Bachs 1.5% doesn't eat into the amount
  const finalAmountKobo = Math.ceil(amountBeforeBachsKobo / (1 - BACHS_RATE));

  const processingFeeKobo = finalAmountKobo - amountBeforeBachsKobo;

  return {
    principalShareKobo,
    feeShareKobo,
    processingFeeKobo,
    finalAmountKobo,
  };
}

// ── Chop-in contribution fee ───────────────────────────────────────────────────

/**
 * Platform fee for a chop-in contribution, in whole naira (Math.ceil).
 *
 * Tiers:
 *   ₦100 – ₦499      → flat ₦10
 *   ₦500 – ₦5,000    → linear ₦20 → ₦50  (formula: 20 + (amount - 500) × 30/4500)
 *   above ₦5,000     → 1% of amount, min ₦50, max ₦1,000
 *
 * Tier 2 includes ₦5,000 exactly (fee = ₦50). Tier 3 starts strictly above ₦5,000.
 *
 * @param contributionNaira — desired contribution in naira (not kobo)
 */
export function calculateChopInPlatformFeeNaira(contributionNaira: number): number {
  if (contributionNaira <= 0) return 0;

  if (contributionNaira < 500) {
    // Tier 1: ₦100 – ₦499
    return 10;
  }

  if (contributionNaira <= 5_000) {
    // Tier 2: ₦500 – ₦5,000 inclusive
    const fee = 20 + (contributionNaira - 500) * (30 / 4_500);
    return Math.ceil(fee);
  }

  // Tier 3: above ₦5,000
  const fee = contributionNaira * 0.01;
  return Math.min(1_000, Math.max(50, Math.ceil(fee)));
}

/**
 * Charge breakdown for a chop-in contribution.
 *
 * We send (contribution + platformFee) to Bachs with customer_bears_fee: true.
 * Bachs then adds their own 1.5% on top at the hosted checkout page — we do NOT
 * gross-up ourselves (that would double-count the Bachs fee).
 *
 * contributionKobo  — pure amount that reaches the pot (stored as amountOwed)
 *
 * Returns:
 *   platformFeeKobo  — our platform fee in kobo (whole-naira multiple)
 *   finalChargeKobo  — amount we send to Bachs (contribution + platformFee);
 *                      Bachs adds 1.5% on top of this at checkout
 */
export function computeChopInCharge(contributionKobo: number): {
  platformFeeKobo: number;
  finalChargeKobo: number;
} {
  const contributionNaira = contributionKobo / 100;
  const platformFeeNaira  = calculateChopInPlatformFeeNaira(contributionNaira);
  const platformFeeKobo   = platformFeeNaira * 100; // already whole naira from ceil

  // No gross-up — customer_bears_fee: true makes Bachs add their 1.5% on top
  const finalChargeKobo = contributionKobo + platformFeeKobo;

  return { platformFeeKobo, finalChargeKobo };
}
