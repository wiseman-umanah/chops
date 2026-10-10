/**
 * tests/unit/chopinFee.test.ts
 *
 * Strict tests for the chop-in withdrawal fee computation.
 *
 * Source: convex/sessions.ts (createSession sets feePercent = 10 for chop-in)
 *         convex/payouts.ts  (listCompletedChopIn, requestPayout compute payout)
 *
 * Contract:
 *   - feePercent for chop-in is ALWAYS 10 (set at session creation, never changes)
 *   - feeKobo = Math.round(collectedKobo * (feePercent / 100))
 *   - payoutKobo = collectedKobo - feeKobo
 *   - Result is always an integer (Math.round)
 *   - When feePercent = 0 → feeKobo = 0, payoutKobo = collectedKobo (no platform cut)
 */

import { describe, it, expect } from "vitest";
import { computeChopInPayout } from "../helpers/pure.js";

describe("computeChopInPayout — fee is always 10% for chop-in", () => {
  // ── Standard 10% fee ─────────────────────────────────────────────────────

  it("10% of 500_000 kobo → feeKobo=50_000, payoutKobo=450_000", () => {
    const { feeKobo, payoutKobo } = computeChopInPayout(500_000, 10);
    expect(feeKobo).toBe(50_000);
    expect(payoutKobo).toBe(450_000);
  });

  it("10% of 1_000_000 kobo → feeKobo=100_000, payoutKobo=900_000", () => {
    const { feeKobo, payoutKobo } = computeChopInPayout(1_000_000, 10);
    expect(feeKobo).toBe(100_000);
    expect(payoutKobo).toBe(900_000);
  });

  it("10% of 100 kobo → feeKobo=10, payoutKobo=90", () => {
    const { feeKobo, payoutKobo } = computeChopInPayout(100, 10);
    expect(feeKobo).toBe(10);
    expect(payoutKobo).toBe(90);
  });

  it("10% of 1 kobo → Math.round(0.1) = 0 fee, payoutKobo = 1", () => {
    // Math.round(1 * 0.10) = Math.round(0.1) = 0
    const { feeKobo, payoutKobo } = computeChopInPayout(1, 10);
    expect(feeKobo).toBe(0);
    expect(payoutKobo).toBe(1);
  });

  it("10% of 5 kobo → Math.round(0.5) = 1 (banker's-round is irrelevant — JS rounds 0.5 up)", () => {
    // Math.round(5 * 0.10) = Math.round(0.5) = 1
    const { feeKobo, payoutKobo } = computeChopInPayout(5, 10);
    expect(feeKobo).toBe(Math.round(5 * 0.1));
    expect(payoutKobo).toBe(5 - Math.round(5 * 0.1));
  });

  it("10% of 333_333 kobo → Math.round(33333.3) = 33_333, payout = 299_999 + 1 = 300_000", () => {
    const { feeKobo, payoutKobo } = computeChopInPayout(333_333, 10);
    expect(feeKobo).toBe(Math.round(333_333 * 0.10));
    expect(payoutKobo).toBe(333_333 - feeKobo);
  });

  // ── Fee invariant: feeKobo + payoutKobo = collectedKobo ──────────────────

  it("feeKobo + payoutKobo always equals collectedKobo", () => {
    const cases = [1, 100, 50_000, 333_333, 1_000_000, 9_999_999];
    for (const collected of cases) {
      const { feeKobo, payoutKobo } = computeChopInPayout(collected, 10);
      expect(feeKobo + payoutKobo).toBe(collected);
    }
  });

  // ── feePercent = 0 (unusual but must be handled gracefully) ──────────────

  it("feePercent = 0 → feeKobo = 0, payoutKobo = collectedKobo (full amount)", () => {
    const { feeKobo, payoutKobo } = computeChopInPayout(500_000, 0);
    expect(feeKobo).toBe(0);
    expect(payoutKobo).toBe(500_000);
  });

  // ── Results are integers ──────────────────────────────────────────────────

  it("feeKobo and payoutKobo are always integers", () => {
    const cases = [1, 3, 7, 100, 333, 1001, 50_000, 333_333];
    for (const collected of cases) {
      const { feeKobo, payoutKobo } = computeChopInPayout(collected, 10);
      expect(feeKobo).toBe(Math.floor(feeKobo));
      expect(payoutKobo).toBe(Math.floor(payoutKobo));
    }
  });

  // ── payoutKobo is never negative ─────────────────────────────────────────

  it("payoutKobo is never negative (fee can't exceed principal)", () => {
    const { payoutKobo } = computeChopInPayout(100, 10);
    expect(payoutKobo).toBeGreaterThanOrEqual(0);
  });

  // ── Large collections ─────────────────────────────────────────────────────

  it("₦1,000,000 raised (100_000_000 kobo) → 10% = 10_000_000 fee, 90_000_000 payout", () => {
    const { feeKobo, payoutKobo } = computeChopInPayout(100_000_000, 10);
    expect(feeKobo).toBe(10_000_000);
    expect(payoutKobo).toBe(90_000_000);
  });
});
