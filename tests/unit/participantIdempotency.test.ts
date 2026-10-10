/**
 * tests/unit/participantIdempotency.test.ts
 *
 * Strict tests for the duplicate webhook idempotency guard.
 *
 * Source: convex/participants.ts :: updateParticipantStatus
 *
 * Guard code:
 *   if (participant.status === "sent") {
 *     console.log(`Duplicate webhook for participant ${participantId} — already sent, skipping`);
 *     return;
 *   }
 *
 * Contract:
 *   - If participant.status === "sent" → this is a duplicate; operation is a no-op
 *   - If participant.status === "pending" → proceed (first call)
 *   - The idempotency decision must be purely status-based (not ref-based)
 *   - A duplicate call must NOT change paymentRef or any other field
 *
 * Why this matters:
 *   Bachs may deliver the same webhook multiple times (retry on delivery failure).
 *   A non-idempotent handler could double-credit, fire duplicate notifications,
 *   or incorrectly close the session a second time.
 */

import { describe, it, expect } from "vitest";
import { isDuplicateWebhookCall, type ParticipantLike } from "../helpers/pure.js";

describe("isDuplicateWebhookCall — idempotency guard", () => {
  // ── Primary guard ─────────────────────────────────────────────────────────

  it("status = 'sent' → IS a duplicate (skip processing)", () => {
    const participant: ParticipantLike = {
      status: "sent",
      paymentRef: "ref_already_set",
    };
    expect(isDuplicateWebhookCall(participant)).toBe(true);
  });

  it("status = 'pending' → NOT a duplicate (first call, proceed)", () => {
    const participant: ParticipantLike = {
      status: "pending",
    };
    expect(isDuplicateWebhookCall(participant)).toBe(false);
  });

  // ── Guard is status-based, NOT paymentRef-based ───────────────────────────

  it("status = 'pending' with a paymentRef already set → still NOT a duplicate (status wins)", () => {
    // This is an edge case: paymentRef could be set from a prior partial update
    const participant: ParticipantLike = {
      status: "pending",
      paymentRef: "orphan_ref",
    };
    expect(isDuplicateWebhookCall(participant)).toBe(false);
  });

  it("status = 'sent' with no paymentRef → IS a duplicate (status is the only check)", () => {
    const participant: ParticipantLike = {
      status: "sent",
      paymentRef: undefined,
    };
    expect(isDuplicateWebhookCall(participant)).toBe(true);
  });

  // ── Idempotency simulation: multiple calls with 'sent' ────────────────────

  it("calling duplicate check multiple times with 'sent' status always returns true", () => {
    const participant: ParticipantLike = { status: "sent", paymentRef: "ref_1" };
    for (let i = 0; i < 10; i++) {
      expect(isDuplicateWebhookCall(participant)).toBe(true);
    }
  });

  // ── State mutation tests (simulating the no-op contract) ─────────────────

  it("after a duplicate call, participant state is unchanged (no mutation on 'sent')", () => {
    const participant: ParticipantLike = {
      status: "sent",
      paymentRef: "original_ref",
    };
    const originalStatus = participant.status;
    const originalRef = participant.paymentRef;

    // Simulate idempotent handler: if duplicate, we return without mutating
    if (!isDuplicateWebhookCall(participant)) {
      // This block should NOT execute for a 'sent' participant
      participant.paymentRef = "new_ref";
    }

    expect(participant.status).toBe(originalStatus);
    expect(participant.paymentRef).toBe(originalRef);
  });

  it("after a NON-duplicate call, state CAN be mutated", () => {
    const participant: ParticipantLike = {
      status: "pending",
    };

    let mutated = false;
    if (!isDuplicateWebhookCall(participant)) {
      participant.status = "sent";
      participant.paymentRef = "new_ref_from_bachs";
      mutated = true;
    }

    expect(mutated).toBe(true);
    expect(participant.status).toBe("sent");
    expect(participant.paymentRef).toBe("new_ref_from_bachs");
  });

  // ── Only exactly 'sent' triggers the guard ────────────────────────────────

  it("only the literal string 'sent' triggers the guard — any other value proceeds", () => {
    const statuses = ["pending"] as const;
    for (const status of statuses) {
      expect(isDuplicateWebhookCall({ status })).toBe(false);
    }
    expect(isDuplicateWebhookCall({ status: "sent" })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session auto-close idempotency
// Covers the second part of updateParticipantStatus:
//   allPaid = mode !== "chop-in" && allParticipants.length > 0 && every(==sent)
// When called twice (duplicate), the second call won't change anything
// because participant.status === "sent" already and we return early.
// ─────────────────────────────────────────────────────────────────────────────

describe("auto-close not triggered on duplicate webhook", () => {
  it("duplicate call returns before reaching the allPaid check", () => {
    // Simulate: participant already 'sent', isDuplicateWebhookCall returns true
    // so the function returns BEFORE checking allPaid → session status unchanged
    const participant: ParticipantLike = { status: "sent", paymentRef: "ref_1" };
    let sessionStatusWouldChange = false;

    if (!isDuplicateWebhookCall(participant)) {
      // This would be where allPaid is computed and session is patched
      sessionStatusWouldChange = true;
    }

    expect(sessionStatusWouldChange).toBe(false);
  });

  it("first (non-duplicate) call proceeds to the allPaid check", () => {
    const participant: ParticipantLike = { status: "pending" };
    let sessionStatusWouldChange = false;

    if (!isDuplicateWebhookCall(participant)) {
      sessionStatusWouldChange = true; // would proceed to allPaid computation
    }

    expect(sessionStatusWouldChange).toBe(true);
  });
});
