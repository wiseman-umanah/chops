/**
 * tests/unit/fee.test.ts
 *
 * Strict tests for computeFlatFeePerParticipant — the platform fee tier logic.
 *
 * Source: convex/sessions.ts
 *
 * Tier table:
 *   total < 500_000 kobo       → flat ₦100  (10_000 kobo total fee)
 *   total < 1_000_000 kobo     → flat ₦150  (15_000 kobo total fee)
 *   total < 2_000_000 kobo     → flat ₦200  (20_000 kobo total fee)
 *   total < 5_000_000 kobo     → 0.75% of total (rounded)
 *   total >= 5_000_000 kobo    → 0.5%  of total (rounded)
 *
 * Per-participant fee = Math.round(totalFee / participantCount)
 */

import { describe, it, expect } from "vitest";
import { computeFlatFeePerParticipant } from "../helpers/pure.js";

describe("computeFlatFeePerParticipant", () => {
  // ── Guard: zero participants ──────────────────────────────────────────────

  it("returns 0 when participantCount is 0", () => {
    expect(computeFlatFeePerParticipant(1_000_000, 0)).toBe(0);
  });

  // ── Tier 1: total < ₦5,000 (500_000 kobo) → flat ₦100 total ─────────────

  it("Tier 1: total = 1 kobo → totalFee = 10_000, 1 participant → 10_000 per", () => {
    expect(computeFlatFeePerParticipant(1, 1)).toBe(10_000);
  });

  it("Tier 1: total = 499_999 kobo (< 500k), 1 participant → 10_000 per", () => {
    expect(computeFlatFeePerParticipant(499_999, 1)).toBe(10_000);
  });

  it("Tier 1: total = 499_999, 3 participants → Math.round(10_000/3) = 3_333", () => {
    expect(computeFlatFeePerParticipant(499_999, 3)).toBe(3_333);
  });

  it("Tier 1: total = 499_999, 10 participants → 1_000 per", () => {
    expect(computeFlatFeePerParticipant(499_999, 10)).toBe(1_000);
  });

  // ── Tier 1 boundary: at exactly 500_000 must NOT apply tier 1 ────────────

  it("Tier 2 boundary: total = 500_000 (≥ 500k) → shifts to tier 2 (₦150 total)", () => {
    // tier 2: totalFee = 15_000, per participant (1) = 15_000
    expect(computeFlatFeePerParticipant(500_000, 1)).toBe(15_000);
  });

  // ── Tier 2: 500_000 ≤ total < 1_000_000 → flat ₦150 total ───────────────

  it("Tier 2: total = 750_000, 1 participant → 15_000 per", () => {
    expect(computeFlatFeePerParticipant(750_000, 1)).toBe(15_000);
  });

  it("Tier 2: total = 999_999, 2 participants → Math.round(15_000/2) = 7_500", () => {
    expect(computeFlatFeePerParticipant(999_999, 2)).toBe(7_500);
  });

  // ── Tier 2 boundary: exactly 1_000_000 shifts to tier 3 ──────────────────

  it("Tier 3 boundary: total = 1_000_000 → tier 3 (₦200 total), 1 participant → 20_000", () => {
    expect(computeFlatFeePerParticipant(1_000_000, 1)).toBe(20_000);
  });

  // ── Tier 3: 1_000_000 ≤ total < 2_000_000 → flat ₦200 total ─────────────

  it("Tier 3: total = 1_500_000, 1 participant → 20_000 per", () => {
    expect(computeFlatFeePerParticipant(1_500_000, 1)).toBe(20_000);
  });

  it("Tier 3: total = 1_999_999, 4 participants → Math.round(20_000/4) = 5_000", () => {
    expect(computeFlatFeePerParticipant(1_999_999, 4)).toBe(5_000);
  });

  // ── Tier 3 boundary: exactly 2_000_000 shifts to tier 4 ──────────────────

  it("Tier 4 boundary: total = 2_000_000 → 0.75% = 15_000, 1 participant → 15_000", () => {
    // Math.round(2_000_000 * 0.0075) = Math.round(15_000) = 15_000
    expect(computeFlatFeePerParticipant(2_000_000, 1)).toBe(15_000);
  });

  // ── Tier 4: 2_000_000 ≤ total < 5_000_000 → 0.75% ───────────────────────

  it("Tier 4: total = 3_000_000, 1 participant → Math.round(3_000_000 * 0.0075) = 22_500", () => {
    expect(computeFlatFeePerParticipant(3_000_000, 1)).toBe(22_500);
  });

  it("Tier 4: total = 4_999_999, 1 participant → Math.round(4_999_999 * 0.0075) = Math.round(37_499.99) = 37_500", () => {
    expect(computeFlatFeePerParticipant(4_999_999, 1)).toBe(37_500);
  });

  it("Tier 4: total = 4_000_000, 5 participants → Math.round(Math.round(30_000)/5) = 6_000", () => {
    const totalFee = Math.round(4_000_000 * 0.0075); // 30_000
    const expected = Math.round(totalFee / 5);
    expect(computeFlatFeePerParticipant(4_000_000, 5)).toBe(expected);
  });

  // ── Tier 4 boundary: exactly 5_000_000 shifts to tier 5 ──────────────────

  it("Tier 5 boundary: total = 5_000_000 → 0.5% = 25_000, 1 participant → 25_000", () => {
    expect(computeFlatFeePerParticipant(5_000_000, 1)).toBe(25_000);
  });

  // ── Tier 5: total ≥ 5_000_000 → 0.5% ────────────────────────────────────

  it("Tier 5: total = 10_000_000, 1 participant → Math.round(10_000_000 * 0.005) = 50_000", () => {
    expect(computeFlatFeePerParticipant(10_000_000, 1)).toBe(50_000);
  });

  it("Tier 5: total = 10_000_000, 4 participants → 50_000 / 4 = 12_500", () => {
    expect(computeFlatFeePerParticipant(10_000_000, 4)).toBe(12_500);
  });

  // ── Rounding: result is always integer (no fractional kobo) ──────────────

  it("result is always an integer (never has a decimal component)", () => {
    const cases: [number, number][] = [
      [300_000, 7],
      [900_000, 3],
      [1_800_000, 7],
      [3_333_333, 7],
      [7_777_777, 7],
    ];
    for (const [total, count] of cases) {
      const result = computeFlatFeePerParticipant(total, count);
      expect(result).toBe(Math.floor(result));
    }
  });
});
