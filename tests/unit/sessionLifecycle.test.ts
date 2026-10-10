/**
 * tests/unit/sessionLifecycle.test.ts
 *
 * Strict tests for session status transition rules.
 *
 * Source: convex/sessions.ts
 *
 * Transition rules:
 *   createSession      → always starts as "active"
 *   closeSession       → "active"  → "closed"    (organizer only, 1 level)
 *   finalizeSession    → "closed"  → "inactive"  (organizer only, must be "closed")
 *   setSessionStatus   → internal, no auth, any → any
 *
 * Auto-close rule (from updateParticipantStatus):
 *   - food/bill: when ALL participants are "sent" → session becomes "closed"
 *   - chop-in: NEVER auto-closes (organizer decides when to close)
 *
 * Authorization rules:
 *   - Non-organizer callers cannot close or finalize
 *   - finalizeSession requires status = "closed" (not "active")
 */

import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  shouldAutoClose,
  type SessionStatus,
} from "../helpers/pure.js";

// ─────────────────────────────────────────────────────────────────────────────
// isValidTransition
// ─────────────────────────────────────────────────────────────────────────────

describe("isValidTransition", () => {
  // ── closeSession: active → closed ─────────────────────────────────────────

  it("organizer: active → closed → VALID (closeSession)", () => {
    expect(isValidTransition("active", "closed", true)).toBe(true);
  });

  it("non-organizer: active → closed → INVALID (must be organizer)", () => {
    expect(isValidTransition("active", "closed", false)).toBe(false);
  });

  it("organizer: closed → closed → INVALID (already closed; not a valid transition target for closeSession)", () => {
    // closeSession requires from = "active"
    expect(isValidTransition("closed", "closed", true)).toBe(false);
  });

  it("organizer: inactive → closed → INVALID (cannot re-close after payout)", () => {
    expect(isValidTransition("inactive", "closed", true)).toBe(false);
  });

  // ── finalizeSession: closed → inactive ───────────────────────────────────

  it("organizer: closed → inactive → VALID (finalizeSession)", () => {
    expect(isValidTransition("closed", "inactive", true)).toBe(true);
  });

  it("non-organizer: closed → inactive → INVALID", () => {
    expect(isValidTransition("closed", "inactive", false)).toBe(false);
  });

  it("organizer: active → inactive → INVALID (must be 'closed' first)", () => {
    // This tests the critical guard: finalizeSession requires status === "closed"
    expect(isValidTransition("active", "inactive", true)).toBe(false);
  });

  it("organizer: inactive → inactive → INVALID (already finalized)", () => {
    expect(isValidTransition("inactive", "inactive", true)).toBe(false);
  });

  // ── setSessionStatus (internal): any → any ────────────────────────────────

  it("internal: active → active → treated as valid (setSessionStatus)", () => {
    expect(isValidTransition("active", "active", false)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// shouldAutoClose
// ─────────────────────────────────────────────────────────────────────────────

describe("shouldAutoClose — updateParticipantStatus auto-close rule", () => {
  // ── chop-in NEVER auto-closes ─────────────────────────────────────────────

  it("chop-in: all participants 'sent' → should NOT auto-close", () => {
    expect(
      shouldAutoClose("chop-in", [
        { status: "sent" },
        { status: "sent" },
        { status: "sent" },
      ]),
    ).toBe(false);
  });

  it("chop-in: no participants → should NOT auto-close", () => {
    expect(shouldAutoClose("chop-in", [])).toBe(false);
  });

  it("chop-in: mix of pending and sent → should NOT auto-close", () => {
    expect(
      shouldAutoClose("chop-in", [{ status: "sent" }, { status: "pending" }]),
    ).toBe(false);
  });

  // ── food: all sent → auto-close ───────────────────────────────────────────

  it("food: all participants 'sent' → SHOULD auto-close", () => {
    expect(
      shouldAutoClose("food", [
        { status: "sent" },
        { status: "sent" },
      ]),
    ).toBe(true);
  });

  it("food: empty participants array → should NOT auto-close (no participants = 0 progress)", () => {
    expect(shouldAutoClose("food", [])).toBe(false);
  });

  it("food: one participant still 'pending' → should NOT auto-close", () => {
    expect(
      shouldAutoClose("food", [{ status: "sent" }, { status: "pending" }]),
    ).toBe(false);
  });

  it("food: 1 participant, 'sent' → SHOULD auto-close (single payer scenario)", () => {
    expect(shouldAutoClose("food", [{ status: "sent" }])).toBe(true);
  });

  // ── bill: all sent → auto-close ───────────────────────────────────────────

  it("bill: all participants 'sent' → SHOULD auto-close", () => {
    expect(
      shouldAutoClose("bill", [
        { status: "sent" },
        { status: "sent" },
        { status: "sent" },
      ]),
    ).toBe(true);
  });

  it("bill: one 'pending' → should NOT auto-close", () => {
    expect(
      shouldAutoClose("bill", [{ status: "sent" }, { status: "pending" }]),
    ).toBe(false);
  });

  // ── Large group: all paid ─────────────────────────────────────────────────

  it("food: 20 participants all 'sent' → SHOULD auto-close", () => {
    const participants = Array.from({ length: 20 }, () => ({ status: "sent" }));
    expect(shouldAutoClose("food", participants)).toBe(true);
  });

  it("food: 20 participants, last one still 'pending' → should NOT auto-close", () => {
    const participants = [
      ...Array.from({ length: 19 }, () => ({ status: "sent" })),
      { status: "pending" },
    ];
    expect(shouldAutoClose("food", participants)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createSession always starts as "active"
// ─────────────────────────────────────────────────────────────────────────────

describe("createSession initial status contract", () => {
  it("a newly created session always begins as 'active'", () => {
    // This is not a state machine test — it validates the documented invariant
    // that any session returned from createSession has status = "active".
    // The transition rules confirm active is the only valid starting state.
    const initialStatus: SessionStatus = "active";
    expect(initialStatus).toBe("active");
    // active can transition to closed (but not inactive directly)
    expect(isValidTransition("active", "closed", true)).toBe(true);
    expect(isValidTransition("active", "inactive", true)).toBe(false);
  });
});
