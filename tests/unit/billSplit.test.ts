/**
 * tests/unit/billSplit.test.ts
 *
 * Strict tests for bill-mode split validation and participant amount calculation.
 *
 * Source: convex/sessions.ts :: createSession handler (bill branch)
 *
 * Three split types:
 *   "equal"      — totalAmount / participantCount (round)
 *   "percentage" — totalAmount * (sharePercent / 100) (round)
 *   "custom"     — caller provides amountOwed directly (already in kobo)
 *
 * Validation:
 *   percentage split: sum of sharePercent must be 100 ±0.01 tolerance
 *   custom split:     sum of amountOwed must be totalAmount ±1 kobo tolerance
 *
 * Fee:
 *   Every participant's final amountOwed = base + feePerParticipant
 */

import { describe, it, expect } from "vitest";
import {
  validatePercentageSum,
  validateCustomAmountSum,
  computeBillParticipantOwed,
} from "../helpers/pure.js";

// ─────────────────────────────────────────────────────────────────────────────
// Percentage sum validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validatePercentageSum", () => {
  it("exactly 100 → no throw", () => {
    expect(() =>
      validatePercentageSum([
        { sharePercent: 50 },
        { sharePercent: 50 },
      ]),
    ).not.toThrow();
  });

  it("three-way 33.33+33.33+33.34 (=100.00) → no throw", () => {
    expect(() =>
      validatePercentageSum([
        { sharePercent: 33.33 },
        { sharePercent: 33.33 },
        { sharePercent: 33.34 },
      ]),
    ).not.toThrow();
  });

  it("99.99 (diff = 0.01) → at the boundary → no throw", () => {
    // Math.abs(99.99 - 100) = 0.01 which is NOT > 0.01, so passes
    expect(() =>
      validatePercentageSum([
        { sharePercent: 60 },
        { sharePercent: 39.99 },
      ]),
    ).not.toThrow();
  });

  it("99.98 (diff = 0.02 > 0.01) → MUST throw", () => {
    expect(() =>
      validatePercentageSum([
        { sharePercent: 60 },
        { sharePercent: 39.98 },
      ]),
    ).toThrow("Percentages must add up to 100");
  });

  it("100.02 (diff = 0.02 > 0.01) → MUST throw", () => {
    expect(() =>
      validatePercentageSum([
        { sharePercent: 60 },
        { sharePercent: 40.02 },
      ]),
    ).toThrow("Percentages must add up to 100");
  });

  it("0% total → MUST throw (no participants assigned any share)", () => {
    expect(() =>
      validatePercentageSum([
        { sharePercent: 0 },
        { sharePercent: 0 },
      ]),
    ).toThrow("Percentages must add up to 100");
  });

  it("single participant at 100% → no throw", () => {
    expect(() =>
      validatePercentageSum([{ sharePercent: 100 }]),
    ).not.toThrow();
  });

  it("single participant at 99 → MUST throw (diff = 1 > 0.01)", () => {
    expect(() =>
      validatePercentageSum([{ sharePercent: 99 }]),
    ).toThrow("Percentages must add up to 100");
  });

  // Exact error message contract
  it("throws the exact error message the backend uses", () => {
    expect(() =>
      validatePercentageSum([{ sharePercent: 50 }]),
    ).toThrow("Percentages must add up to 100");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom amount sum validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateCustomAmountSum", () => {
  it("exact match → no throw", () => {
    expect(() =>
      validateCustomAmountSum(
        [{ amountOwed: 150_000 }, { amountOwed: 150_000 }],
        300_000,
      ),
    ).not.toThrow();
  });

  it("sum + 1 kobo (= total + 1) → at boundary → no throw (tolerance is > 1)", () => {
    // Math.abs(300_001 - 300_000) = 1 which is NOT > 1, so passes
    expect(() =>
      validateCustomAmountSum(
        [{ amountOwed: 150_001 }, { amountOwed: 150_000 }],
        300_000,
      ),
    ).not.toThrow();
  });

  it("sum - 1 kobo → at boundary → no throw", () => {
    expect(() =>
      validateCustomAmountSum(
        [{ amountOwed: 149_999 }, { amountOwed: 150_000 }],
        300_000,
      ),
    ).not.toThrow();
  });

  it("sum + 2 kobo (diff = 2 > 1) → MUST throw", () => {
    expect(() =>
      validateCustomAmountSum(
        [{ amountOwed: 150_002 }, { amountOwed: 150_000 }],
        300_000,
      ),
    ).toThrow("Custom amounts must add up to the total bill");
  });

  it("sum - 2 kobo (diff = 2 > 1) → MUST throw", () => {
    expect(() =>
      validateCustomAmountSum(
        [{ amountOwed: 149_998 }, { amountOwed: 150_000 }],
        300_000,
      ),
    ).toThrow("Custom amounts must add up to the total bill");
  });

  it("single participant with exact total → no throw", () => {
    expect(() =>
      validateCustomAmountSum([{ amountOwed: 500_000 }], 500_000),
    ).not.toThrow();
  });

  it("throws the exact error message the backend uses", () => {
    expect(() =>
      validateCustomAmountSum([{ amountOwed: 0 }], 500_000),
    ).toThrow("Custom amounts must add up to the total bill");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeBillParticipantOwed
// ─────────────────────────────────────────────────────────────────────────────

describe("computeBillParticipantOwed — equal split", () => {
  it("3 participants, 300_000 total → each pays 100_000 base", () => {
    const owed = computeBillParticipantOwed("equal", 300_000, 3, undefined, undefined, 0);
    expect(owed).toBe(100_000);
  });

  it("3 participants, 100_001 total → Math.round(100001/3) = 33_334", () => {
    const owed = computeBillParticipantOwed("equal", 100_001, 3, undefined, undefined, 0);
    expect(owed).toBe(33_334);
  });

  it("2 participants, 100_001 total → Math.round(100001/2) = 50_001 (rounds up)", () => {
    const owed = computeBillParticipantOwed("equal", 100_001, 2, undefined, undefined, 0);
    expect(owed).toBe(50_001);
  });

  it("equal split with fee: amountOwed = base + feePerParticipant", () => {
    const fee = 10_000;
    const owed = computeBillParticipantOwed("equal", 300_000, 3, undefined, undefined, fee);
    expect(owed).toBe(100_000 + fee);
  });
});

describe("computeBillParticipantOwed — percentage split", () => {
  it("60% of 500_000 = 300_000 base", () => {
    const owed = computeBillParticipantOwed("percentage", 500_000, 2, 60, undefined, 0);
    expect(owed).toBe(300_000);
  });

  it("40% of 500_000 = 200_000 base", () => {
    const owed = computeBillParticipantOwed("percentage", 500_000, 2, 40, undefined, 0);
    expect(owed).toBe(200_000);
  });

  it("33.33% of 300_000 → Math.round(300_000 * 0.3333) = 99_990", () => {
    const owed = computeBillParticipantOwed("percentage", 300_000, 3, 33.33, undefined, 0);
    expect(owed).toBe(Math.round(300_000 * 0.3333));
  });

  it("percentage split with fee: base + fee", () => {
    const fee = 5_000;
    const owed = computeBillParticipantOwed("percentage", 200_000, 2, 50, undefined, fee);
    expect(owed).toBe(100_000 + fee);
  });
});

describe("computeBillParticipantOwed — custom split", () => {
  it("custom amount passes through as-is + fee", () => {
    const owed = computeBillParticipantOwed("custom", 500_000, 2, undefined, 250_000, 10_000);
    expect(owed).toBe(260_000);
  });

  it("custom amount of 0 → 0 + fee", () => {
    const owed = computeBillParticipantOwed("custom", 500_000, 2, undefined, 0, 10_000);
    expect(owed).toBe(10_000);
  });

  it("undefined custom amountOwed defaults to 0 + fee", () => {
    const owed = computeBillParticipantOwed("custom", 500_000, 2, undefined, undefined, 5_000);
    expect(owed).toBe(5_000);
  });
});
