/**
 * tests/unit/kobo.test.ts
 *
 * Strict tests for koboToAmountStr — the kobo→NGN decimal string conversion
 * used everywhere the Bachs API is called.
 *
 * Source: convex/payments.ts and convex/payouts.ts
 *   const amountStr = (amountKobo / 100).toFixed(2);
 *
 * Contract:
 *   - Input is always a non-negative integer (stored in DB as integer)
 *   - Output is always a string with exactly 2 decimal places
 *   - 100 kobo = exactly "1.00" (Nigerian Naira has 2 decimal places)
 *   - Precision edge cases: no floating-point drift for common values
 */

import { describe, it, expect } from "vitest";
import { koboToAmountStr } from "../helpers/pure.js";

describe("koboToAmountStr", () => {
  // ── Standard conversions ──────────────────────────────────────────────────

  it("0 kobo → '0.00'", () => {
    expect(koboToAmountStr(0)).toBe("0.00");
  });

  it("1 kobo → '0.01' (smallest possible amount)", () => {
    expect(koboToAmountStr(1)).toBe("0.01");
  });

  it("50 kobo → '0.50'", () => {
    expect(koboToAmountStr(50)).toBe("0.50");
  });

  it("100 kobo → '1.00' (₦1 exactly)", () => {
    expect(koboToAmountStr(100)).toBe("1.00");
  });

  it("75_000 kobo → '750.00' (₦750 — the example from AGENTS.md)", () => {
    expect(koboToAmountStr(75_000)).toBe("750.00");
  });

  it("99_99 kobo → '9.99'", () => {
    expect(koboToAmountStr(999)).toBe("9.99");
  });

  it("99_999 kobo → '999.99'", () => {
    expect(koboToAmountStr(99_999)).toBe("999.99");
  });

  it("500_050 kobo → '5000.50'", () => {
    expect(koboToAmountStr(500_050)).toBe("5000.50");
  });

  it("1_000_000 kobo → '10000.00' (₦10,000)", () => {
    expect(koboToAmountStr(1_000_000)).toBe("10000.00");
  });

  // ── Format contract ───────────────────────────────────────────────────────

  it("output always has exactly 2 decimal places", () => {
    const cases = [1, 10, 100, 1000, 10_000, 100_000, 1_000_000];
    for (const kobo of cases) {
      const str = koboToAmountStr(kobo);
      const parts = str.split(".");
      expect(parts.length).toBe(2);
      expect(parts[1].length).toBe(2);
    }
  });

  it("output is a string, never a number", () => {
    expect(typeof koboToAmountStr(100)).toBe("string");
  });

  // ── No floating point drift ───────────────────────────────────────────────

  it("5_001 kobo → '50.01' (tests JS float precision doesn't drift)", () => {
    expect(koboToAmountStr(5_001)).toBe("50.01");
  });

  it("3_333 kobo → '33.33' (repeating decimal in binary — no drift)", () => {
    expect(koboToAmountStr(3_333)).toBe("33.33");
  });

  it("6_666 kobo → '66.66'", () => {
    expect(koboToAmountStr(6_666)).toBe("66.66");
  });

  it("7_777 kobo → '77.77'", () => {
    expect(koboToAmountStr(7_777)).toBe("77.77");
  });

  // ── Large amounts (payout scale) ─────────────────────────────────────────

  it("10_000_000 kobo → '100000.00' (₦100,000 payout)", () => {
    expect(koboToAmountStr(10_000_000)).toBe("100000.00");
  });
});
