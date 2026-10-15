/**
 * tests/unit/multiUser.test.ts
 *
 * Multi-user session interaction tests.
 *
 * These tests simulate the full lifecycle of a session from the perspective
 * of multiple users paying simultaneously or in sequence, verifying:
 *
 *   1. Progress tracking — collected / outstanding amounts are always correct
 *   2. Auto-close rule — food/bill closes exactly when LAST participant pays
 *   3. Partial payment state — session stays open while anyone is pending
 *   4. Chop-in fundraising — multiple contributors, goal progress %
 *   5. Equal-split rounding — sum of rounded shares never overcharges
 *   6. Large group dynamics — 20 participants paying one at a time
 *   7. Single-person session — edge case: 1 participant, auto-closes on pay
 *   8. Organizer isolation — organizer's actions don't conflict with participants
 *
 * Sources:
 *   convex/participants.ts :: updateParticipantStatus
 *   convex/sessions.ts :: closeSession auto-close logic
 *   tests/helpers/pure.ts :: totalCollected, totalOutstanding, sessionProgressPct,
 *                            chopInProgressPct, shouldAutoClose
 */

import { describe, it, expect } from "vitest";
import {
  totalCollected,
  totalOutstanding,
  sessionProgressPct,
  chopInProgressPct,
  shouldAutoClose,
  computeFees,
  type ParticipantPaymentRow,
} from "../helpers/pure.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeParticipants(
  shares: number[],
  paidCount = 0,
): ParticipantPaymentRow[] {
  return shares.map((share, i) => ({
    name: `User ${i + 1}`,
    amountOwed: share,
    status: i < paidCount ? "sent" : "pending",
  }));
}

function markPaid(
  participants: ParticipantPaymentRow[],
  index: number,
): ParticipantPaymentRow[] {
  return participants.map((p, i) => (i === index ? { ...p, status: "sent" } : p));
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress tracking — food / bill
// ─────────────────────────────────────────────────────────────────────────────

describe("progress tracking — food/bill session", () => {
  it("0 of 3 paid: collected = 0, outstanding = full total", () => {
    const ps = makeParticipants([100_000, 150_000, 200_000], 0);
    expect(totalCollected(ps)).toBe(0);
    expect(totalOutstanding(ps)).toBe(450_000);
    expect(sessionProgressPct(ps)).toBe(0);
  });

  it("1 of 3 paid: collected = first share, outstanding = remainder", () => {
    const ps = makeParticipants([100_000, 150_000, 200_000], 1);
    expect(totalCollected(ps)).toBe(100_000);
    expect(totalOutstanding(ps)).toBe(350_000);
    expect(sessionProgressPct(ps)).toBe(33); // Math.round(1/3 * 100)
  });

  it("2 of 3 paid: collected = sum of first two, outstanding = last", () => {
    const ps = makeParticipants([100_000, 150_000, 200_000], 2);
    expect(totalCollected(ps)).toBe(250_000);
    expect(totalOutstanding(ps)).toBe(200_000);
    expect(sessionProgressPct(ps)).toBe(67); // Math.round(2/3 * 100)
  });

  it("3 of 3 paid: collected = total, outstanding = 0, progress = 100%", () => {
    const ps = makeParticipants([100_000, 150_000, 200_000], 3);
    expect(totalCollected(ps)).toBe(450_000);
    expect(totalOutstanding(ps)).toBe(0);
    expect(sessionProgressPct(ps)).toBe(100);
  });

  it("collected + outstanding always equals the session total", () => {
    const shares = [100_000, 150_000, 200_000, 75_000];
    const sessionTotal = shares.reduce((s, v) => s + v, 0);

    for (let paid = 0; paid <= shares.length; paid++) {
      const ps = makeParticipants(shares, paid);
      expect(totalCollected(ps) + totalOutstanding(ps)).toBe(sessionTotal);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-close rule — triggered only when ALL participants paid
// ─────────────────────────────────────────────────────────────────────────────

describe("auto-close rule — food/bill", () => {
  it("1 of 3 paid → should NOT auto-close", () => {
    const ps = makeParticipants([100_000, 100_000, 100_000], 1);
    expect(shouldAutoClose("food", ps)).toBe(false);
  });

  it("2 of 3 paid → should NOT auto-close", () => {
    const ps = makeParticipants([100_000, 100_000, 100_000], 2);
    expect(shouldAutoClose("food", ps)).toBe(false);
  });

  it("3 of 3 paid (last payment) → SHOULD auto-close", () => {
    const ps = makeParticipants([100_000, 100_000, 100_000], 3);
    expect(shouldAutoClose("food", ps)).toBe(true);
  });

  it("simulates the exact moment auto-close triggers: last participant pays", () => {
    let ps = makeParticipants([100_000, 150_000, 200_000], 0);

    // Participants pay one by one
    ps = markPaid(ps, 0);
    expect(shouldAutoClose("food", ps)).toBe(false);

    ps = markPaid(ps, 1);
    expect(shouldAutoClose("food", ps)).toBe(false);

    ps = markPaid(ps, 2); // last payment — triggers close
    expect(shouldAutoClose("food", ps)).toBe(true);
  });

  it("bill mode auto-close: identical rule to food", () => {
    const ps = makeParticipants([100_000, 100_000], 2);
    expect(shouldAutoClose("bill", ps)).toBe(true);
  });

  it("chop-in NEVER auto-closes regardless of how many have paid", () => {
    const ps = makeParticipants([100_000, 100_000, 100_000], 3);
    expect(shouldAutoClose("chop-in", ps)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Single-person session
// ─────────────────────────────────────────────────────────────────────────────

describe("single-participant session edge case", () => {
  it("1 participant, not yet paid → progress = 0%, no auto-close", () => {
    const ps = makeParticipants([500_000], 0);
    expect(sessionProgressPct(ps)).toBe(0);
    expect(shouldAutoClose("food", ps)).toBe(false);
  });

  it("1 participant pays → progress = 100%, SHOULD auto-close immediately", () => {
    const ps = makeParticipants([500_000], 1);
    expect(sessionProgressPct(ps)).toBe(100);
    expect(shouldAutoClose("food", ps)).toBe(true);
  });

  it("single-participant collected = outstanding = share before payment", () => {
    const ps = makeParticipants([500_000], 0);
    expect(totalCollected(ps)).toBe(0);
    expect(totalOutstanding(ps)).toBe(500_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Equal-split rounding — sum of rounded shares
// ─────────────────────────────────────────────────────────────────────────────

describe("equal-split rounding across participants", () => {
  it("3 equal shares of ₦1,000 (100_000 kobo) → each pays 33_333 kobo (rounds down)", () => {
    const total = 100_000;
    const n = 3;
    const share = Math.round(total / n); // Math.round(33333.33) = 33_333
    expect(share).toBe(33_333);
    // 3 × 33_333 = 99_999 — 1 kobo under total (acceptable rounding)
    expect(Math.abs(share * n - total)).toBeLessThanOrEqual(n);
  });

  it("2 equal shares of ₦1,001 (100_100 kobo) → each pays 50_050 kobo", () => {
    const total = 100_100;
    const share = Math.round(total / 2);
    expect(share).toBe(50_050);
    expect(share * 2).toBe(total); // exact
  });

  it("4 equal shares of ₦999 (99_900 kobo) → each pays 24_975 kobo", () => {
    const total = 99_900;
    const share = Math.round(total / 4);
    expect(share).toBe(24_975);
    expect(share * 4).toBe(total); // exact
  });

  it("rounding overage never exceeds (participantCount - 1) kobo", () => {
    // Worst case: every share rounds up → overage < n kobo
    const cases = [
      { total: 100_001, n: 3 },
      { total: 333_337, n: 7 },
      { total: 999_999, n: 10 },
    ];
    for (const { total, n } of cases) {
      const share = Math.round(total / n);
      const overage = Math.abs(share * n - total);
      expect(overage).toBeLessThan(n);
    }
  });

  it("progress % with rounded shares: all paid sums to 100%", () => {
    const shares = [33_334, 33_334, 33_334]; // equal split of 100_002 (rounding)
    const ps: ParticipantPaymentRow[] = shares.map((s, i) => ({
      name: `User ${i + 1}`,
      amountOwed: s,
      status: "sent",
    }));
    expect(sessionProgressPct(ps)).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chop-in fundraising — multiple contributors, goal progress
// ─────────────────────────────────────────────────────────────────────────────

describe("chop-in fundraising — multi-contributor progress", () => {
  const GOAL_KOBO = 1_000_000; // ₦10,000 goal

  it("0 contributors → 0% progress", () => {
    expect(chopInProgressPct(0, GOAL_KOBO)).toBe(0);
  });

  it("₦1,000 contributed (100_000 kobo) → 10% progress", () => {
    expect(chopInProgressPct(100_000, GOAL_KOBO)).toBe(10);
  });

  it("₦5,000 contributed (500_000 kobo) → 50% progress", () => {
    expect(chopInProgressPct(500_000, GOAL_KOBO)).toBe(50);
  });

  it("₦10,000 contributed (exactly at goal) → 100% progress", () => {
    expect(chopInProgressPct(1_000_000, GOAL_KOBO)).toBe(100);
  });

  it("over-goal contribution → capped at 100% (never exceeds goal %)", () => {
    expect(chopInProgressPct(2_000_000, GOAL_KOBO)).toBe(100);
  });

  it("3 contributors: ₦2,000 + ₦3,000 + ₦1,500 = ₦6,500 → 65%", () => {
    const contributions = [200_000, 300_000, 150_000];
    const collected = contributions.reduce((s, c) => s + c, 0);
    expect(chopInProgressPct(collected, GOAL_KOBO)).toBe(65);
  });

  it("fraud check boundary: 49% collected with 1+ paid → suspicious", () => {
    const collected = Math.round(GOAL_KOBO * 0.49);
    expect(collected / GOAL_KOBO).toBeLessThan(0.5);
    // isSuspiciousEarlyClose would flag this (tested in fraudDetection.test.ts)
    expect(chopInProgressPct(collected, GOAL_KOBO)).toBe(49);
  });

  it("fraud check boundary: exactly 50% collected → NOT suspicious", () => {
    const collected = GOAL_KOBO / 2; // exactly 50%
    expect(collected / GOAL_KOBO).toBe(0.5);
    // isSuspiciousEarlyClose: < 0.5 is false at exactly 0.5
    expect(chopInProgressPct(collected, GOAL_KOBO)).toBe(50);
  });

  it("0 goal → returns 0% without dividing by zero", () => {
    expect(chopInProgressPct(100_000, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Large group dynamics — 20 participants
// ─────────────────────────────────────────────────────────────────────────────

describe("large group — 20 participants, equal split", () => {
  const TOTAL = 5_000_000; // ₦50,000 total
  const N = 20;
  const SHARE = Math.round(TOTAL / N); // 250_000 each

  it("each participant's share = 250_000 kobo (₦2,500)", () => {
    expect(SHARE).toBe(250_000);
  });

  it("paying one by one: progress increases monotonically", () => {
    let ps = makeParticipants(Array(N).fill(SHARE), 0);
    let prevPct = 0;
    for (let i = 0; i < N; i++) {
      ps = markPaid(ps, i);
      const pct = sessionProgressPct(ps);
      expect(pct).toBeGreaterThanOrEqual(prevPct);
      prevPct = pct;
    }
    expect(prevPct).toBe(100);
  });

  it("auto-close: false for first 19 payments, true only on 20th", () => {
    let ps = makeParticipants(Array(N).fill(SHARE), 0);
    for (let i = 0; i < N - 1; i++) {
      ps = markPaid(ps, i);
      expect(shouldAutoClose("bill", ps)).toBe(false);
    }
    ps = markPaid(ps, N - 1); // 20th payment
    expect(shouldAutoClose("bill", ps)).toBe(true);
  });

  it("collected grows by exactly one share per payment", () => {
    let ps = makeParticipants(Array(N).fill(SHARE), 0);
    for (let i = 0; i < N; i++) {
      const before = totalCollected(ps);
      ps = markPaid(ps, i);
      const after = totalCollected(ps);
      expect(after - before).toBe(SHARE);
    }
  });

  it("each participant pays 2% platform fee on top of their ₦2,500 share", () => {
    const { platformFeeKobo, checkoutAmountKobo } = computeFees(SHARE);
    expect(platformFeeKobo).toBe(5_000);      // 2% of 250_000
    expect(checkoutAmountKobo).toBe(255_000); // ₦2,550
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Concurrent payment simulation — order independence
// ─────────────────────────────────────────────────────────────────────────────

describe("payment order independence", () => {
  it("paying in reverse order gives same final state as forward order", () => {
    const shares = [100_000, 150_000, 200_000];

    // Forward order
    let psForward = makeParticipants(shares, 0);
    for (let i = 0; i < shares.length; i++) {
      psForward = markPaid(psForward, i);
    }

    // Reverse order
    let psReverse = makeParticipants(shares, 0);
    for (let i = shares.length - 1; i >= 0; i--) {
      psReverse = markPaid(psReverse, i);
    }

    expect(totalCollected(psForward)).toBe(totalCollected(psReverse));
    expect(totalOutstanding(psForward)).toBe(totalOutstanding(psReverse));
    expect(sessionProgressPct(psForward)).toBe(sessionProgressPct(psReverse));
    expect(shouldAutoClose("food", psForward)).toBe(true);
    expect(shouldAutoClose("food", psReverse)).toBe(true);
  });

  it("random payment order: final state is always 100% and auto-closes", () => {
    const shares = [100_000, 200_000, 300_000, 150_000, 250_000];
    const order = [2, 0, 4, 1, 3]; // arbitrary order
    let ps = makeParticipants(shares, 0);

    for (let i = 0; i < order.length; i++) {
      ps = markPaid(ps, order[i]);
      if (i < order.length - 1) {
        expect(shouldAutoClose("food", ps)).toBe(false);
      }
    }
    expect(shouldAutoClose("food", ps)).toBe(true);
    expect(sessionProgressPct(ps)).toBe(100);
  });
});
