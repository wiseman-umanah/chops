/**
 * tests/unit/payerEmailStrip.test.ts
 *
 * Strict tests for the payerEmail PII stripping contract.
 *
 * Source: convex/participants.ts — multiple query handlers strip payerEmail
 *   getByPaymentRef:          const { payerEmail: _pe, ...safeParticipant } = participant;
 *   getParticipantsBySession: rows.map(({ payerEmail: _e, ...p }) => p)
 *   getParticipantStatus:     returns only { status, paymentRef } — no other fields
 *
 * Contract:
 *   - The `payerEmail` key must NEVER appear in any public query response
 *   - This applies even when payerEmail is undefined (field must be absent, not undefined)
 *   - stripPayerEmail must omit the key structurally, not just set it to undefined
 *
 * Why this matters:
 *   payerEmail is a user's private email used for Bachs checkout. If it leaks
 *   through a public query it constitutes a PII data breach.
 */

import { describe, it, expect } from "vitest";
import { stripPayerEmail, type FullParticipantRow } from "../helpers/pure.js";

const BASE_ROW: FullParticipantRow = {
  _id: "p123",
  sessionId: "s456",
  name: "Tolu",
  amountOwed: 250_000,
  status: "pending",
};

describe("stripPayerEmail — structural PII protection", () => {
  // ── Key must not exist in the output ─────────────────────────────────────

  it("when payerEmail is present: output does NOT have 'payerEmail' key", () => {
    const row: FullParticipantRow = {
      ...BASE_ROW,
      payerEmail: "tolu@example.com",
    };
    const safe = stripPayerEmail(row);
    expect("payerEmail" in safe).toBe(false);
  });

  it("when payerEmail is undefined: output still does NOT have 'payerEmail' key", () => {
    const row: FullParticipantRow = {
      ...BASE_ROW,
      payerEmail: undefined,
    };
    const safe = stripPayerEmail(row);
    expect("payerEmail" in safe).toBe(false);
  });

  it("when payerEmail is absent on input: output still does NOT have 'payerEmail' key", () => {
    const safe = stripPayerEmail(BASE_ROW);
    expect("payerEmail" in safe).toBe(false);
  });

  // ── Other fields are preserved ────────────────────────────────────────────

  it("all non-PII fields are preserved after stripping", () => {
    const row: FullParticipantRow = {
      ...BASE_ROW,
      payerEmail: "private@example.com",
      paymentRef: "ref_abc",
    };
    const safe = stripPayerEmail(row);
    expect(safe._id).toBe(row._id);
    expect(safe.sessionId).toBe(row.sessionId);
    expect(safe.name).toBe(row.name);
    expect(safe.amountOwed).toBe(row.amountOwed);
    expect(safe.status).toBe(row.status);
    expect(safe.paymentRef).toBe(row.paymentRef);
  });

  // ── Strict key count check ─────────────────────────────────────────────────

  it("output has the expected number of keys — no extra keys, no missing keys", () => {
    const row: FullParticipantRow = {
      ...BASE_ROW,
      payerEmail: "email@example.com",
      paymentRef: "ref_xyz",
    };
    const safe = stripPayerEmail(row);
    const keys = Object.keys(safe);
    // Expect exactly: _id, sessionId, name, amountOwed, status, paymentRef
    expect(keys).not.toContain("payerEmail");
    expect(keys).toContain("_id");
    expect(keys).toContain("name");
    expect(keys).toContain("amountOwed");
    expect(keys).toContain("status");
  });

  // ── Output is a new object (no reference sharing with input) ──────────────

  it("strip returns a new object — does not mutate the original", () => {
    const row: FullParticipantRow = {
      ...BASE_ROW,
      payerEmail: "private@example.com",
    };
    const safe = stripPayerEmail(row);
    expect(safe).not.toBe(row); // different object reference
    // Original still has payerEmail
    expect("payerEmail" in row).toBe(true);
  });

  // ── Array strip (mirrors getParticipantsBySession behaviour) ─────────────

  it("stripping an array of rows: no row in the result has payerEmail", () => {
    const rows: FullParticipantRow[] = [
      { ...BASE_ROW, _id: "p1", payerEmail: "a@example.com" },
      { ...BASE_ROW, _id: "p2", payerEmail: "b@example.com" },
      { ...BASE_ROW, _id: "p3" }, // no payerEmail
    ];
    const safeRows = rows.map(stripPayerEmail);
    for (const safe of safeRows) {
      expect("payerEmail" in safe).toBe(false);
    }
  });

  // ── The value cannot be accessed via dynamic property lookup ──────────────

  it("payerEmail value cannot be retrieved via dynamic property access on the result", () => {
    const row: FullParticipantRow = {
      ...BASE_ROW,
      payerEmail: "sensitive@example.com",
    };
    const safe = stripPayerEmail(row);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((safe as any).payerEmail).toBeUndefined();
  });
});
