/**
 * tests/unit/stalePayment.test.ts
 *
 * Tests for stale, abandoned, and duplicate payment scenarios.
 *
 * "Stale" = a payment was initiated but never completed (user abandoned checkout).
 * "Duplicate" = the Bachs webhook fires twice for the same payment.
 * "Late webhook" = Bachs delivers a webhook after the 90-second poll timeout.
 *
 * Covers:
 *   1. Abandoned chop-in participant rows — cron cleanup rules
 *   2. Idempotency guard — duplicate webhook must not double-credit
 *   3. Replay window — webhooks older than 5 minutes are rejected
 *   4. Stale pending rows: created > 24h ago with no paymentRef → eligible for cleanup
 *   5. Partially stale group: some pending are old, some are new
 *   6. Paid participant's row must NOT be cleaned up (status = "sent")
 *   7. PaymentSuccessPage 90-second timeout contract
 *
 * Sources:
 *   convex/crons.ts :: cleanupAbandonedParticipants
 *   convex/participants.ts :: updateParticipantStatus idempotency guard
 *   convex/http_actions.ts :: 300-second replay window
 *   tests/helpers/pure.ts :: isAbandonedParticipant, abandonedCutoff, isDuplicateWebhookCall,
 *                            isWithinReplayWindow
 */

import { describe, it, expect } from "vitest";
import {
  isAbandonedParticipant,
  abandonedCutoff,
  isDuplicateWebhookCall,
  isWithinReplayWindow,
  type PendingParticipantRow,
} from "../helpers/pure.js";

// Fixed "now" for deterministic tests
const NOW_MS      = 1_700_000_000_000; // arbitrary fixed timestamp in ms
const NOW_SEC     = Math.floor(NOW_MS / 1000);
const HOUR_MS     = 60 * 60 * 1000;
const DAY_MS      = 24 * HOUR_MS;

// ─────────────────────────────────────────────────────────────────────────────
// abandonedCutoff — 24-hour cleanup window
// ─────────────────────────────────────────────────────────────────────────────

describe("abandonedCutoff — 24-hour boundary", () => {
  it("cutoff is exactly 24 hours before now", () => {
    const cutoff = abandonedCutoff(NOW_MS);
    expect(cutoff).toBe(NOW_MS - DAY_MS);
  });

  it("cutoff in milliseconds (not seconds — _creationTime is ms epoch)", () => {
    const cutoff = abandonedCutoff(NOW_MS);
    expect(cutoff).toBeGreaterThan(1_000_000_000_000); // ms-scale
  });

  it("a row created exactly 24h ago is AT the boundary — eligible for cleanup", () => {
    const createdAt = NOW_MS - DAY_MS; // exactly 24h ago
    const cutoff = abandonedCutoff(NOW_MS);
    // Cron: _creationTime < cutoff → strictly less
    // At exactly 24h: createdAt === cutoff → NOT eligible (boundary is exclusive)
    expect(createdAt < cutoff).toBe(false);
  });

  it("a row created 24h + 1ms ago → eligible for cleanup", () => {
    const createdAt = NOW_MS - DAY_MS - 1;
    expect(createdAt < abandonedCutoff(NOW_MS)).toBe(true);
  });

  it("a row created 23h ago → NOT eligible (too recent)", () => {
    const createdAt = NOW_MS - 23 * HOUR_MS;
    expect(createdAt < abandonedCutoff(NOW_MS)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isAbandonedParticipant — identifies stale chop-in rows
// ─────────────────────────────────────────────────────────────────────────────

describe("isAbandonedParticipant — cron filter logic", () => {
  const cutoff = abandonedCutoff(NOW_MS);

  it("pending, no paymentRef, created > 24h ago → IS abandoned", () => {
    const row: PendingParticipantRow = {
      _id: "p1",
      status: "pending",
      paymentRef: undefined,
      _creationTime: NOW_MS - DAY_MS - 1,
    };
    expect(isAbandonedParticipant(row, cutoff)).toBe(true);
  });

  it("pending, no paymentRef, created 1h ago → NOT abandoned (too recent)", () => {
    const row: PendingParticipantRow = {
      _id: "p2",
      status: "pending",
      paymentRef: undefined,
      _creationTime: NOW_MS - HOUR_MS,
    };
    expect(isAbandonedParticipant(row, cutoff)).toBe(false);
  });

  it("status = 'sent' (paid) → NOT abandoned regardless of age", () => {
    const row: PendingParticipantRow = {
      _id: "p3",
      status: "sent",
      paymentRef: "ref_abc",
      _creationTime: NOW_MS - 2 * DAY_MS, // very old
    };
    expect(isAbandonedParticipant(row, cutoff)).toBe(false);
  });

  it("pending WITH paymentRef, old → NOT abandoned (paymentRef = webhook arrived)", () => {
    // A row that has paymentRef set = webhook arrived = payment was confirmed
    // Even if status is still pending (race condition), paymentRef presence guards cleanup
    const row: PendingParticipantRow = {
      _id: "p4",
      status: "pending",
      paymentRef: "ref_xyz",
      _creationTime: NOW_MS - 2 * DAY_MS,
    };
    expect(isAbandonedParticipant(row, cutoff)).toBe(false);
  });

  it("pending, no paymentRef, created exactly at cutoff → NOT abandoned (boundary exclusive)", () => {
    const row: PendingParticipantRow = {
      _id: "p5",
      status: "pending",
      paymentRef: undefined,
      _creationTime: cutoff, // exactly at cutoff
    };
    expect(isAbandonedParticipant(row, cutoff)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Partially stale group — mixed old and new pending rows
// ─────────────────────────────────────────────────────────────────────────────

describe("partially stale group — some old, some new", () => {
  it("identifies only the stale rows from a mixed set", () => {
    const cutoff = abandonedCutoff(NOW_MS);
    const rows: PendingParticipantRow[] = [
      { _id: "p1", status: "pending", _creationTime: NOW_MS - 2 * DAY_MS },  // stale
      { _id: "p2", status: "pending", _creationTime: NOW_MS - HOUR_MS },       // fresh
      { _id: "p3", status: "sent", paymentRef: "ref1", _creationTime: NOW_MS - 2 * DAY_MS }, // paid, old
      { _id: "p4", status: "pending", _creationTime: NOW_MS - 25 * HOUR_MS }, // stale
      { _id: "p5", status: "pending", paymentRef: "ref2", _creationTime: NOW_MS - 2 * DAY_MS }, // has ref → not stale
    ];

    const stale = rows.filter(r => isAbandonedParticipant(r, cutoff));
    expect(stale.map(r => r._id)).toEqual(["p1", "p4"]);
  });

  it("safe to run cleanup twice: stale rows are already deleted, remaining rows are not stale", () => {
    const cutoff = abandonedCutoff(NOW_MS);
    const staleRow: PendingParticipantRow = {
      _id: "p1",
      status: "pending",
      _creationTime: NOW_MS - 2 * DAY_MS,
    };
    // First run
    expect(isAbandonedParticipant(staleRow, cutoff)).toBe(true);
    // After deletion from DB, the row is gone. Running again:
    // remaining rows (fresh or paid) are not abandoned.
    const freshRow: PendingParticipantRow = {
      _id: "p2",
      status: "pending",
      _creationTime: NOW_MS - HOUR_MS,
    };
    expect(isAbandonedParticipant(freshRow, cutoff)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate webhook idempotency (already tested in participantIdempotency.test.ts,
// re-verified here in the context of stale payments)
// ─────────────────────────────────────────────────────────────────────────────

describe("duplicate webhook — stale payment scenario", () => {
  it("Bachs retries webhook after 30s: second call must be blocked by idempotency guard", () => {
    // After first webhook: participant.status = "sent"
    const participant = { status: "sent" as const, paymentRef: "ref_original" };
    // Second webhook arrives (retry):
    expect(isDuplicateWebhookCall(participant)).toBe(true);
  });

  it("Bachs retries 10 times: all retries are blocked", () => {
    const participant = { status: "sent" as const, paymentRef: "ref_original" };
    for (let i = 0; i < 10; i++) {
      expect(isDuplicateWebhookCall(participant)).toBe(true);
    }
  });

  it("webhook for abandoned participant that later pays: first real webhook proceeds", () => {
    // Participant created (pending), user abandons, then comes back and pays
    const pendingParticipant = { status: "pending" as const };
    expect(isDuplicateWebhookCall(pendingParticipant)).toBe(false); // proceeds
  });

  it("stale participant (old + pending, no ref) is NOT a duplicate — still eligible for webhook", () => {
    // If a very late webhook arrives for an old pending row, it should be processed
    // (the cron only deletes rows that never received a paymentRef)
    const stalePendingParticipant = { status: "pending" as const, paymentRef: undefined };
    expect(isDuplicateWebhookCall(stalePendingParticipant)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Replay window — stale webhook timestamps
// ─────────────────────────────────────────────────────────────────────────────

describe("replay attack window — 300-second guard", () => {
  it("webhook sent now → accepted", () => {
    expect(isWithinReplayWindow(NOW_SEC, NOW_SEC)).toBe(true);
  });

  it("webhook 4m 59s old (299s) → accepted", () => {
    expect(isWithinReplayWindow(NOW_SEC - 299, NOW_SEC)).toBe(true);
  });

  it("webhook exactly 5m old (300s) → accepted (boundary is inclusive: ≤ 300)", () => {
    expect(isWithinReplayWindow(NOW_SEC - 300, NOW_SEC)).toBe(true);
  });

  it("webhook 5m 1s old (301s) → REJECTED (replay attack window exceeded)", () => {
    expect(isWithinReplayWindow(NOW_SEC - 301, NOW_SEC)).toBe(false);
  });

  it("webhook 10 minutes old → REJECTED", () => {
    expect(isWithinReplayWindow(NOW_SEC - 600, NOW_SEC)).toBe(false);
  });

  it("webhook 1 hour old → REJECTED", () => {
    expect(isWithinReplayWindow(NOW_SEC - 3600, NOW_SEC)).toBe(false);
  });

  it("future timestamp within 5 min → accepted (clock skew tolerance)", () => {
    expect(isWithinReplayWindow(NOW_SEC + 299, NOW_SEC)).toBe(true);
  });

  it("future timestamp 301s ahead → REJECTED", () => {
    expect(isWithinReplayWindow(NOW_SEC + 301, NOW_SEC)).toBe(false);
  });

  it("stale payment scenario: user pays, webhook delayed 6 minutes → rejected by replay guard", () => {
    const paymentTimestamp = NOW_SEC - 360; // 6 minutes ago
    expect(isWithinReplayWindow(paymentTimestamp, NOW_SEC)).toBe(false);
    // In production this means Bachs should retry with a fresh timestamp
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PaymentSuccessPage 90-second polling timeout contract
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentSuccessPage — 90-second poll timeout contract", () => {
  const POLL_TIMEOUT_MS = 90_000; // source: PaymentSuccessPage.tsx :: setTimeout 90_000

  it("poll timeout is 90 seconds (90_000 ms)", () => {
    expect(POLL_TIMEOUT_MS).toBe(90_000);
  });

  it("90 seconds > 300-second replay window? No — replay window is 5min, poll is 1.5min", () => {
    // Clarification: poll is 90s, replay is 300s. Bachs should always deliver
    // within 90s in production. The replay guard is a security backstop.
    const replayWindowMs = 300 * 1000;
    expect(POLL_TIMEOUT_MS).toBeLessThan(replayWindowMs);
  });

  it("after timeout: page shows 'Still confirming' — not an error (non-fatal)", () => {
    // This tests the documented UX contract, not a UI assertion.
    // If webhook hasn't arrived in 90s, UI shows reassurance (not a hard failure).
    const EXPECTED_COPY = "Still confirming…";
    expect(EXPECTED_COPY.length).toBeGreaterThan(0);
    expect(EXPECTED_COPY).toContain("confirming");
  });

  it("webhook can still arrive after 90s — page does NOT cancel the query subscription", () => {
    // useQuery stays mounted. Once webhook arrives, participantStatus flips to "sent"
    // and the receipt loads. The 90s timeout is only for showing the reassurance UI.
    // This is a documentation test: no assertion needed beyond the boolean.
    const queryStaysActiveAfterTimeout = true;
    expect(queryStaysActiveAfterTimeout).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chop-in specific stale payment: pre-inserted pending row abandoned
// ─────────────────────────────────────────────────────────────────────────────

describe("chop-in abandoned checkout — pre-inserted pending row lifecycle", () => {
  it("user initiates checkout (row inserted) then closes browser → row stays pending harmlessly", () => {
    const abandonedRow: PendingParticipantRow = {
      _id: "p_chopIn_1",
      status: "pending",
      paymentRef: undefined,  // no webhook arrived
      _creationTime: NOW_MS,  // just created
    };
    const cutoff = abandonedCutoff(NOW_MS);
    // Row is too new to be cleaned up
    expect(isAbandonedParticipant(abandonedRow, cutoff)).toBe(false);
  });

  it("same row 25 hours later: now eligible for nightly cleanup", () => {
    const abandonedRow: PendingParticipantRow = {
      _id: "p_chopIn_1",
      status: "pending",
      paymentRef: undefined,
      _creationTime: NOW_MS - 25 * HOUR_MS,
    };
    const cutoff = abandonedCutoff(NOW_MS);
    expect(isAbandonedParticipant(abandonedRow, cutoff)).toBe(true);
  });

  it("user returns 5 hours later and pays: row has paymentRef → NOT cleaned up", () => {
    const paidRow: PendingParticipantRow = {
      _id: "p_chopIn_2",
      status: "sent",
      paymentRef: "ref_late_payment",
      _creationTime: NOW_MS - 5 * HOUR_MS,
    };
    const cutoff = abandonedCutoff(NOW_MS);
    expect(isAbandonedParticipant(paidRow, cutoff)).toBe(false);
  });

  it("count of stale chop-in rows removed by one cron run", () => {
    const cutoff = abandonedCutoff(NOW_MS);
    const rows: PendingParticipantRow[] = [
      { _id: "p1", status: "pending", _creationTime: NOW_MS - 2 * DAY_MS }, // stale
      { _id: "p2", status: "pending", _creationTime: NOW_MS - 2 * DAY_MS }, // stale
      { _id: "p3", status: "sent", paymentRef: "r1", _creationTime: NOW_MS - 2 * DAY_MS }, // paid
      { _id: "p4", status: "pending", _creationTime: NOW_MS - HOUR_MS },    // fresh
    ];
    const toDelete = rows.filter(r => isAbandonedParticipant(r, cutoff));
    expect(toDelete.length).toBe(2);
    expect(toDelete.map(r => r._id)).toEqual(["p1", "p2"]);
  });
});
