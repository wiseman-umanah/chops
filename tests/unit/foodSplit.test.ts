/**
 * tests/unit/foodSplit.test.ts
 *
 * Strict tests for the food-mode participant amountOwed calculation.
 *
 * Source: convex/sessions.ts :: createSession handler (food branch)
 *
 * Formula:
 *   taxTipRatio = totalAmount > 0 ? (taxKobo + tipKobo) / totalAmount : 0
 *   share       = Math.round(itemsTotal * (1 + taxTipRatio))
 *   amountOwed  = share + feePerParticipant
 *
 * Critical invariants:
 *   - When totalAmount = 0, taxTipRatio = 0 (no divide-by-zero)
 *   - amountOwed is always an integer
 *   - Tax + tip is distributed proportionally by each participant's item subtotal
 *   - feePerParticipant is always added on top of the proportional share
 */

import { describe, it, expect } from "vitest";
import { computeFoodParticipantOwed } from "../helpers/pure.js";

describe("computeFoodParticipantOwed", () => {
  // ── No tax/tip ────────────────────────────────────────────────────────────

  it("no tax, no tip: amountOwed = itemsTotal + feePerParticipant", () => {
    // itemsTotal=300_000, totalAmount=300_000, tax=0, tip=0, fee=10_000
    expect(computeFoodParticipantOwed(300_000, 300_000, 0, 0, 10_000)).toBe(310_000);
  });

  it("no tax, no tip, zero fee: amountOwed = itemsTotal", () => {
    expect(computeFoodParticipantOwed(500_000, 500_000, 0, 0, 0)).toBe(500_000);
  });

  it("no tax, no tip: 1 kobo item → 1 kobo share + fee", () => {
    expect(computeFoodParticipantOwed(1, 1, 0, 0, 0)).toBe(1);
  });

  // ── Tax only ──────────────────────────────────────────────────────────────

  it("single participant, 10% tax: amountOwed = round(itemsTotal * 1.1) + fee", () => {
    // totalAmount = 100_000 (gross, incl. 10_000 tax)
    // itemsSubtotal = 100_000 - 10_000 = 90_000
    // taxTipRatio = 10_000 / 90_000 ≈ 0.1111
    // share = round(90_000 * 1.1111) = round(100_000) = 100_000
    expect(computeFoodParticipantOwed(90_000, 100_000, 10_000, 0, 0)).toBe(100_000);
  });

  it("tax is proportionally distributed: participant with bigger order pays more tax", () => {
    // totalAmount includes tax+tip; two participants with 60k and 40k items
    // totalSubtotal = 100_000, taxKobo = 10_000, tipKobo = 5_000
    // taxTipRatio = 15_000 / 115_000 ≈ 0.13043...
    // participant1 (60k items): share = round(60_000 * 1.13043...) = round(67826.08...) = 67_826
    // participant2 (40k items): share = round(40_000 * 1.13043...) = round(45217.39...) = 45_217
    const tax = 10_000;
    const tip = 5_000;
    const total = 115_000; // 100_000 items + 15_000 tax+tip
    const share1 = computeFoodParticipantOwed(60_000, total, tax, tip, 0);
    const share2 = computeFoodParticipantOwed(40_000, total, tax, tip, 0);
    expect(share1).toBeGreaterThan(share2);
    // Combined should approximate total (rounding means it won't always be exact)
    expect(Math.abs(share1 + share2 - total)).toBeLessThanOrEqual(2);
  });

  // ── Divide-by-zero guard: totalAmount = 0 ────────────────────────────────

  it("totalAmount = 0 → taxTipRatio = 0, no division by zero", () => {
    // taxTipRatio = 0 (guarded), share = Math.round(50_000 * 1) = 50_000
    expect(computeFoodParticipantOwed(50_000, 0, 10_000, 5_000, 0)).toBe(50_000);
  });

  // ── Result is always an integer ───────────────────────────────────────────

  it("result is always an integer (Math.round applied)", () => {
    const cases: [number, number, number, number, number][] = [
      [33_333, 100_000, 5_000, 2_000, 3_333],
      [99_999, 300_000, 15_000, 7_500, 7_500],
      [12_345, 50_000, 3_000, 1_000, 1_000],
    ];
    for (const [items, total, tax, tip, fee] of cases) {
      const result = computeFoodParticipantOwed(items, total, tax, tip, fee);
      expect(result).toBe(Math.floor(result)); // integer check
    }
  });

  // ── Fee is always included ────────────────────────────────────────────────

  it("fee is always added on top of the share (not absorbed)", () => {
    const noFee = computeFoodParticipantOwed(100_000, 100_000, 0, 0, 0);
    const withFee = computeFoodParticipantOwed(100_000, 100_000, 0, 0, 10_000);
    expect(withFee - noFee).toBe(10_000);
  });

  // ── Large numbers ─────────────────────────────────────────────────────────

  it("large order (₦50,000 items, 5% tax, 2% tip): no overflow", () => {
    const items = 5_000_000; // ₦50,000 in kobo
    const total = 5_350_000; // ₦53,500 (7% added)
    const tax = 250_000;
    const tip = 100_000;
    const fee = 25_000;
    const result = computeFoodParticipantOwed(items, total, tax, tip, fee);
    expect(result).toBeGreaterThan(5_000_000);
    expect(result).toBe(Math.floor(result));
  });
});
