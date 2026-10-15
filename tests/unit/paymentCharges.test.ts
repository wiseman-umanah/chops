/**
 * tests/unit/paymentCharges.test.ts
 *
 * Strict charge accuracy tests — verifies every kobo that leaves a payer's
 * account is correct, capped, and never double-charged.
 *
 * Covers:
 *   1. Exact charge amounts for all three modes (food, bill, chop-in)
 *   2. Platform fee cap enforcement (never > ₦2,000 per transaction)
 *   3. Bachs processing fee cap enforcement (never > ₦2,000 per transaction)
 *   4. Double-charge detection (legacy migration risk)
 *   5. Migration correctness — migrateParticipantAmountOwed strips old fee
 *   6. The 1-kobo rounding contract (no sub-kobo amounts anywhere)
 *   7. "What the payer actually pays" = checkoutAmount + Bachs (estimatedTotal)
 *   8. Platform keeps exactly: platformFeeKobo per transaction
 *
 * Sources:
 *   convex/fees.ts, convex/payments.ts, convex/migrations.ts
 *   tests/helpers/pure.ts :: computeFees, isDoubleChargeRisk, migrateParticipantAmountOwed
 */

import { describe, it, expect } from "vitest";
import {
  computeFees,
  PLATFORM_FEE_CAP_KOBO,
  BACHS_BANK_TRANSFER_CAP_KOBO,
  BACHS_WITHDRAWAL_FEE_KOBO,
  isDoubleChargeRisk,
  migrateParticipantAmountOwed,
  buildFoodBillCheckoutIntent,
  buildChopInCheckoutIntent,
} from "../helpers/pure.js";

// ─────────────────────────────────────────────────────────────────────────────
// Exact charge amounts — spot-check common transaction sizes
// ─────────────────────────────────────────────────────────────────────────────

describe("exact charge amounts — common transaction sizes", () => {
  const cases: { label: string; shareKobo: number; expectPlatformKobo: number; expectCheckoutKobo: number }[] = [
    { label: "₦500 share",   shareKobo:    50_000, expectPlatformKobo:    1_000, expectCheckoutKobo:    51_000 },
    { label: "₦1,000 share", shareKobo:   100_000, expectPlatformKobo:    2_000, expectCheckoutKobo:   102_000 },
    { label: "₦2,500 share", shareKobo:   250_000, expectPlatformKobo:    5_000, expectCheckoutKobo:   255_000 },
    { label: "₦5,000 share", shareKobo:   500_000, expectPlatformKobo:   10_000, expectCheckoutKobo:   510_000 },
    { label: "₦10,000 share",shareKobo: 1_000_000, expectPlatformKobo:   20_000, expectCheckoutKobo: 1_020_000 },
    { label: "₦50,000 share",shareKobo: 5_000_000, expectPlatformKobo:  100_000, expectCheckoutKobo: 5_100_000 },
    { label: "₦100,000 share (at cap)",
      shareKobo: 10_000_000, expectPlatformKobo: 200_000, expectCheckoutKobo: 10_200_000 },
    { label: "₦200,000 share (above cap)",
      shareKobo: 20_000_000, expectPlatformKobo: 200_000, expectCheckoutKobo: 20_200_000 },
  ];

  for (const c of cases) {
    it(`${c.label}: platform fee = ${c.expectPlatformKobo} kobo, checkout = ${c.expectCheckoutKobo} kobo`, () => {
      const { platformFeeKobo, checkoutAmountKobo } = computeFees(c.shareKobo);
      expect(platformFeeKobo).toBe(c.expectPlatformKobo);
      expect(checkoutAmountKobo).toBe(c.expectCheckoutKobo);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Platform fee cap — never exceeds ₦2,000 (200_000 kobo)
// ─────────────────────────────────────────────────────────────────────────────

describe("platform fee cap — never exceeds ₦2,000", () => {
  it("cap constant is ₦2,000 (200_000 kobo)", () => {
    expect(PLATFORM_FEE_CAP_KOBO).toBe(200_000);
  });

  it("₦100,000 share (10M kobo) → platform fee exactly at cap", () => {
    expect(computeFees(10_000_000).platformFeeKobo).toBe(200_000);
  });

  it("₦101,000 share → platform fee still capped at ₦2,000", () => {
    expect(computeFees(10_100_000).platformFeeKobo).toBe(200_000);
  });

  it("₦1,000,000 share → platform fee still capped at ₦2,000", () => {
    expect(computeFees(100_000_000).platformFeeKobo).toBe(200_000);
  });

  it("any amount ≥ ₦100,000 has exactly ₦2,000 platform fee (monotone test)", () => {
    for (let naira = 100_000; naira <= 500_000; naira += 50_000) {
      const kobo = naira * 100;
      expect(computeFees(kobo).platformFeeKobo).toBe(200_000);
    }
  });

  it("platform fee INCREASES up to ₦100,000 share then FLATTENS (cap boundary)", () => {
    const below = computeFees(9_999_900); // ₦99,999 — just below cap
    const atCap = computeFees(10_000_000); // ₦100,000 — exactly at cap
    const above = computeFees(10_000_100); // ₦100,001 — just above cap
    expect(below.platformFeeKobo).toBeLessThan(200_000);
    expect(atCap.platformFeeKobo).toBe(200_000);
    expect(above.platformFeeKobo).toBe(200_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bachs processing fee cap — never exceeds ₦2,000 (200_000 kobo)
// ─────────────────────────────────────────────────────────────────────────────

describe("Bachs processing fee cap — never exceeds ₦2,000", () => {
  it("cap constant is ₦2,000 (200_000 kobo)", () => {
    expect(BACHS_BANK_TRANSFER_CAP_KOBO).toBe(200_000);
  });

  it("large transaction: Bachs est. capped at ₦2,000", () => {
    // checkout = 20_200_000; 1.5% = 303_000 > 200_000 → capped
    const { estimatedBachsFeeKobo } = computeFees(20_000_000);
    expect(estimatedBachsFeeKobo).toBe(200_000);
  });

  it("₦1,000 share: Bachs est. = ₦15.30 (well below cap)", () => {
    const { estimatedBachsFeeKobo } = computeFees(100_000);
    expect(estimatedBachsFeeKobo).toBe(1_530); // 1.5% of 102_000
    expect(estimatedBachsFeeKobo).toBeLessThan(200_000);
  });

  it("Bachs fee is never negative", () => {
    for (const amount of [1, 100, 1_000, 1_000_000]) {
      expect(computeFees(amount).estimatedBachsFeeKobo).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Total payer charge = checkout + Bachs (not just share)
// ─────────────────────────────────────────────────────────────────────────────

describe("total payer charge = estimatedTotalKobo", () => {
  it("payer pays: share + platform fee + Bachs processing (three components)", () => {
    const share = 250_000;
    const { amountDueKobo, platformFeeKobo, estimatedBachsFeeKobo, estimatedTotalKobo } = computeFees(share);
    expect(estimatedTotalKobo).toBe(amountDueKobo + platformFeeKobo + estimatedBachsFeeKobo);
  });

  it("organizer receives exactly amountOwed (share) — fees do NOT reduce pot", () => {
    // The pot accumulates amountOwed per participant; fees are Bachs-side
    const share = 250_000;
    const { amountDueKobo } = computeFees(share);
    // What organizer gets = amountOwed × participants (no fee deduction from pot in food/bill)
    expect(amountDueKobo).toBe(share); // pure share unchanged
  });

  it("chop-in: organizer receives collected - ₦50 withdrawal fee (platform fee already taken at contribution time)", () => {
    const contribution = 500_000;
    const { amountDueKobo } = computeFees(contribution);
    const withdrawalPayout = amountDueKobo - BACHS_WITHDRAWAL_FEE_KOBO;
    // Payout = pure contribution - ₦50 (no platform % at withdrawal)
    expect(withdrawalPayout).toBe(495_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Double-charge detection — legacy migration risk
// ─────────────────────────────────────────────────────────────────────────────

describe("isDoubleChargeRisk — legacy participant detection", () => {
  it("legacy session (feePerParticipant set) + no platformFeeKobo → IS at risk", () => {
    expect(isDoubleChargeRisk(
      { amountOwed: 110_000 },                    // 100_000 share + 10_000 old fee baked in
      { feePerParticipant: 10_000 },              // old session
    )).toBe(true);
  });

  it("new session (no feePerParticipant) → NOT at risk", () => {
    expect(isDoubleChargeRisk(
      { amountOwed: 100_000 },
      {},                                         // no feePerParticipant
    )).toBe(false);
  });

  it("legacy session but platformFeeKobo already patched → NOT at risk (migration done)", () => {
    expect(isDoubleChargeRisk(
      { amountOwed: 100_000, platformFeeKobo: 2_000 },
      { feePerParticipant: 10_000 },
    )).toBe(false);
  });

  it("legacy session with feePerParticipant = 0 → NOT at risk (zero fee has no effect)", () => {
    expect(isDoubleChargeRisk(
      { amountOwed: 100_000 },
      { feePerParticipant: 0 },
    )).toBe(false);
  });

  it("null feePerParticipant → NOT at risk", () => {
    expect(isDoubleChargeRisk(
      { amountOwed: 100_000 },
      { feePerParticipant: undefined },
    )).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// migrateParticipantAmountOwed — strips baked-in fee from legacy rows
// ─────────────────────────────────────────────────────────────────────────────

describe("migrateParticipantAmountOwed — strips legacy fee", () => {
  it("110_000 - 10_000 → 100_000 (clean share)", () => {
    expect(migrateParticipantAmountOwed({ amountOwed: 110_000 }, 10_000)).toBe(100_000);
  });

  it("idempotency guard: if amountOwed ≤ fee → throws (already migrated or corrupted)", () => {
    expect(() => migrateParticipantAmountOwed({ amountOwed: 5_000 }, 10_000)).toThrow();
  });

  it("exact fee = amountOwed → returns 0 (allowed by migration helper; guard is <= in backend)", () => {
    // The backend cron skips rows where amountOwed <= fee, but our pure helper
    // only throws for strictly negative results.
    expect(migrateParticipantAmountOwed({ amountOwed: 10_000 }, 10_000)).toBe(0);
  });

  it("after migration: old amountOwed is no longer double-charged by new 2% fee", () => {
    const oldAmountOwed = 110_000;       // share 100_000 + fee 10_000 baked in
    const feePerParticipant = 10_000;
    const cleanShare = migrateParticipantAmountOwed({ amountOwed: oldAmountOwed }, feePerParticipant);
    // New checkout fee on the clean share
    const { checkoutAmountKobo } = computeFees(cleanShare);
    // Total charge after migration: clean share + 2% platform
    expect(cleanShare).toBe(100_000);
    expect(checkoutAmountKobo).toBe(102_000); // ₦1,000 + ₦20 = ₦1,020 — correct, not double-charged
  });

  it("without migration: the old baked-in fee would compound with 2% → overcharge", () => {
    // What would have happened WITHOUT migration (illustrates the bug):
    const legacyAmountOwed = 110_000; // still has old fee baked in
    const { checkoutAmountKobo } = computeFees(legacyAmountOwed);
    // Overcharge: ₦1,100 (already includes ₦100 legacy fee) + 2% = ₦1,122 instead of ₦1,020
    expect(checkoutAmountKobo).toBe(112_200);       // wrong if not migrated
    expect(checkoutAmountKobo).not.toBe(102_000);   // correct post-migration value
  });

  it("result is always a positive integer", () => {
    const cases: [number, number][] = [
      [200_000, 10_000],
      [500_000, 15_000],
      [1_000_000, 20_000],
    ];
    for (const [amountOwed, fee] of cases) {
      const result = migrateParticipantAmountOwed({ amountOwed }, fee);
      expect(result).toBeGreaterThan(0);
      expect(result).toBe(Math.floor(result));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No sub-kobo amounts — all results are integers
// ─────────────────────────────────────────────────────────────────────────────

describe("no sub-kobo amounts — integer contract", () => {
  it("computeFees always returns integer kobo for all fields", () => {
    const cases = [1, 33, 100, 1_001, 50_000, 333_333, 10_000_000];
    for (const amount of cases) {
      const f = computeFees(amount);
      expect(f.platformFeeKobo).toBe(Math.floor(f.platformFeeKobo));
      expect(f.checkoutAmountKobo).toBe(Math.floor(f.checkoutAmountKobo));
      expect(f.estimatedBachsFeeKobo).toBe(Math.floor(f.estimatedBachsFeeKobo));
      expect(f.estimatedTotalKobo).toBe(Math.floor(f.estimatedTotalKobo));
    }
  });

  it("bachsAmountStr always has exactly 2 decimal places (integer kobo → clean NGN string)", () => {
    const amounts = [100_000, 250_000, 1_000_000, 5_000_000, 20_000_000];
    for (const amount of amounts) {
      const { bachsAmountStr } = buildFoodBillCheckoutIntent(amount);
      const [, decimals] = bachsAmountStr.split(".");
      expect(decimals.length).toBe(2);
    }
  });

  it("BACHS_WITHDRAWAL_FEE_KOBO is an exact integer (5_000)", () => {
    expect(BACHS_WITHDRAWAL_FEE_KOBO).toBe(5_000);
    expect(BACHS_WITHDRAWAL_FEE_KOBO).toBe(Math.floor(BACHS_WITHDRAWAL_FEE_KOBO));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chop-in specific charge breakdown
// ─────────────────────────────────────────────────────────────────────────────

describe("chop-in charge breakdown", () => {
  it("contributor pays: contribution + 2% platform + 1.5% Bachs (estimated total)", () => {
    const contribution = 500_000;
    const intent = buildChopInCheckoutIntent(contribution);
    expect(intent.fees.estimatedTotalKobo).toBe(
      intent.fees.checkoutAmountKobo + intent.fees.estimatedBachsFeeKobo
    );
  });

  it("organizer receives: all contributions summed - ₦50 flat on withdrawal", () => {
    // Three contributors: ₦5,000 + ₦3,000 + ₦2,000 = ₦10,000 collected
    const contributions = [500_000, 300_000, 200_000];
    const collectedKobo = contributions.reduce((s, c) => s + c, 0); // 1_000_000
    const organizerPayout = collectedKobo - BACHS_WITHDRAWAL_FEE_KOBO;
    expect(collectedKobo).toBe(1_000_000);
    expect(organizerPayout).toBe(995_000); // ₦9,950 (₦50 Bachs withdrawal fee)
  });

  it("organizer's payout does NOT deduct platform % (only ₦50 flat at withdrawal)", () => {
    const collectedKobo = 1_000_000;
    // Old model: would deduct 10% = 100_000 kobo
    const oldPayout = collectedKobo - Math.round(collectedKobo * 0.10);
    // New model: only ₦50 flat
    const newPayout = collectedKobo - BACHS_WITHDRAWAL_FEE_KOBO;
    expect(newPayout).toBeGreaterThan(oldPayout); // organizer keeps more
    expect(newPayout).toBe(995_000);
  });

  it("minimum chop-in contribution (₦100 = 10_000 kobo): platform fee = 200 kobo", () => {
    // Mirrors MIN_CONTRIBUTION_KOBO = 10_000 from SessionPayPage.tsx
    const { platformFeeKobo } = computeFees(10_000);
    expect(platformFeeKobo).toBe(200); // ₦2
  });
});
