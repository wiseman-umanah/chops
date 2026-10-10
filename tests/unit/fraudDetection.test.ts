/**
 * tests/unit/fraudDetection.test.ts
 *
 * Strict tests for the chop-in early-close fraud detection logic.
 *
 * Source: convex/sessions.ts :: closeSession handler
 *
 * Rule:
 *   Suspicious = paidParticipantCount > 0
 *             AND goalKobo > 0
 *             AND (collectedKobo / goalKobo) < 0.5
 *
 * Consequence:
 *   earlyCloseCount increments by 1.
 *   When newCount >= 5 → accountStatus = "under_review"
 *   Current status is preserved below 5 strikes.
 *
 * Critical boundary:
 *   At EXACTLY the 5th strike (count = 5) the account goes under_review.
 *   The condition is >= 5 (not > 5).
 */

import { describe, it, expect } from "vitest";
import { isSuspiciousEarlyClose, applyFraudStrike } from "../helpers/pure.js";

// ─────────────────────────────────────────────────────────────────────────────
// isSuspiciousEarlyClose
// ─────────────────────────────────────────────────────────────────────────────

describe("isSuspiciousEarlyClose", () => {
  // ── Not suspicious cases ──────────────────────────────────────────────────

  it("0 paid participants → NOT suspicious (no one was defrauded)", () => {
    expect(
      isSuspiciousEarlyClose({ paidParticipantCount: 0, collectedKobo: 0, goalKobo: 100_000 }),
    ).toBe(false);
  });

  it("goalKobo = 0 → NOT suspicious (no goal to measure against)", () => {
    expect(
      isSuspiciousEarlyClose({ paidParticipantCount: 2, collectedKobo: 0, goalKobo: 0 }),
    ).toBe(false);
  });

  it("collected = exactly 50% of goal → NOT suspicious (boundary: < 0.5 is false at exactly 0.5)", () => {
    // collectedKobo / goalKobo = 0.5 → NOT < 0.5
    expect(
      isSuspiciousEarlyClose({
        paidParticipantCount: 1,
        collectedKobo: 50_000,
        goalKobo: 100_000,
      }),
    ).toBe(false);
  });

  it("collected > 50% of goal → NOT suspicious", () => {
    expect(
      isSuspiciousEarlyClose({
        paidParticipantCount: 1,
        collectedKobo: 60_000,
        goalKobo: 100_000,
      }),
    ).toBe(false);
  });

  it("collected = 100% of goal → NOT suspicious", () => {
    expect(
      isSuspiciousEarlyClose({
        paidParticipantCount: 3,
        collectedKobo: 100_000,
        goalKobo: 100_000,
      }),
    ).toBe(false);
  });

  // ── Suspicious cases ──────────────────────────────────────────────────────

  it("1 paid participant, collected < 50% → IS suspicious", () => {
    expect(
      isSuspiciousEarlyClose({
        paidParticipantCount: 1,
        collectedKobo: 49_999,
        goalKobo: 100_000,
      }),
    ).toBe(true);
  });

  it("collected = 0 (all abandoned), but 1 paid row → IS suspicious", () => {
    // Edge: participant row exists with status=sent but 0 collected? Shouldn't happen normally,
    // but tests the pure logic strictly.
    expect(
      isSuspiciousEarlyClose({
        paidParticipantCount: 1,
        collectedKobo: 0,
        goalKobo: 100_000,
      }),
    ).toBe(true);
  });

  it("collected = 49% of goal → IS suspicious", () => {
    expect(
      isSuspiciousEarlyClose({
        paidParticipantCount: 1,
        collectedKobo: 49_000,
        goalKobo: 100_000,
      }),
    ).toBe(true);
  });

  it("10 paid participants, only 10% collected → IS suspicious", () => {
    expect(
      isSuspiciousEarlyClose({
        paidParticipantCount: 10,
        collectedKobo: 10_000,
        goalKobo: 100_000,
      }),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyFraudStrike — earlyCloseCount & accountStatus transitions
// ─────────────────────────────────────────────────────────────────────────────

describe("applyFraudStrike", () => {
  // ── Count increments ──────────────────────────────────────────────────────

  it("strike 1: count 0 → 1, status stays 'active'", () => {
    const { newCount, newStatus } = applyFraudStrike(0, "active");
    expect(newCount).toBe(1);
    expect(newStatus).toBe("active");
  });

  it("strike 2: count 1 → 2, status stays 'active'", () => {
    const { newCount, newStatus } = applyFraudStrike(1, "active");
    expect(newCount).toBe(2);
    expect(newStatus).toBe("active");
  });

  it("strike 3: count 2 → 3, status stays 'active'", () => {
    const { newCount, newStatus } = applyFraudStrike(2, "active");
    expect(newCount).toBe(3);
    expect(newStatus).toBe("active");
  });

  it("strike 4: count 3 → 4, status stays 'active'", () => {
    const { newCount, newStatus } = applyFraudStrike(3, "active");
    expect(newCount).toBe(4);
    expect(newStatus).toBe("active");
  });

  // ── The critical 5th strike ───────────────────────────────────────────────

  it("CRITICAL — strike 5: count 4 → 5, status MUST become 'under_review'", () => {
    const { newCount, newStatus } = applyFraudStrike(4, "active");
    expect(newCount).toBe(5);
    expect(newStatus).toBe("under_review");
  });

  it("CRITICAL — the boundary is >= 5 (not > 5); at exactly 5, account is under_review", () => {
    // This confirms the backend uses >= 5 not > 5
    const result4 = applyFraudStrike(4, "active"); // newCount = 5 → under_review
    expect(result4.newStatus).toBe("under_review");
  });

  it("strike 6+: already under_review, status stays 'under_review'", () => {
    const { newCount, newStatus } = applyFraudStrike(5, "under_review");
    expect(newCount).toBe(6);
    expect(newStatus).toBe("under_review");
  });

  // ── Count never decrements ────────────────────────────────────────────────

  it("count is monotonically increasing — never decrements", () => {
    let count = 0;
    let status: "active" | "under_review" = "active";
    for (let i = 0; i < 10; i++) {
      const prev = count;
      const result = applyFraudStrike(count, status);
      count = result.newCount;
      status = result.newStatus;
      expect(count).toBe(prev + 1);
    }
  });

  // ── Account under_review at 5, stays there ────────────────────────────────

  it("sequential strikes 0→1→2→3→4→5: status is 'active' until strike 5", () => {
    let count = 0;
    let status: "active" | "under_review" = "active";
    const statuses: string[] = [];
    for (let i = 0; i < 5; i++) {
      const result = applyFraudStrike(count, status);
      count = result.newCount;
      status = result.newStatus;
      statuses.push(status);
    }
    // First 4 strikes: active; 5th strike: under_review
    expect(statuses).toEqual(["active", "active", "active", "active", "under_review"]);
  });

  // ── Suspended accounts ────────────────────────────────────────────────────

  it("suspended account: additional strike does NOT downgrade to under_review (suspended is worse)", () => {
    // newCount = 2, < 5 → shouldEscalate is false → currentStatus preserved unchanged
    // "suspended" is the most severe state — it must never be downgraded by a fraud strike
    const { newStatus } = applyFraudStrike(1, "suspended");
    expect(newStatus).toBe("suspended");
  });
});
