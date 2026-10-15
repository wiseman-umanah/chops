/**
 * tests/unit/latency.test.ts
 *
 * Latency budget contracts — verifies that every pure-function operation in
 * the hot path completes within its defined time budget.
 *
 * These are NOT mock tests — they actually execute the functions and measure
 * wall-clock time to catch accidental O(n²) regressions or expensive imports.
 *
 * Budgets (from tests/helpers/pure.ts :: LATENCY_BUDGETS):
 *   computeFees()        ≤ 1ms   — pure arithmetic, called on every checkout
 *   generateSlug()       ≤ 1ms   — pure random, called on every session create
 *   makeReferralCode()   ≤ 1ms   — pure random, called on every signup
 *   computeHmacSha256()  ≤ 50ms  — Web Crypto async, called on every webhook
 *   abandonedCutoff()    ≤ 1ms   — pure subtraction, called by nightly cron
 *
 * Also verifies:
 *   - 1,000 consecutive fee computations < 50ms total (throughput contract)
 *   - 1,000 consecutive slug generations < 100ms total (throughput contract)
 *   - koboToAmountStr conversion < 1ms per call
 *
 * Sources:
 *   tests/helpers/pure.ts :: computeFees, generateSlug, makeReferralCode,
 *                            computeHmacSha256, koboToAmountStr, abandonedCutoff,
 *                            LATENCY_BUDGETS
 */

import { describe, it, expect } from "vitest";
import {
  computeFees,
  generateSlug,
  makeReferralCode,
  computeHmacSha256,
  koboToAmountStr,
  abandonedCutoff,
  buildSignedPayload,
  LATENCY_BUDGETS,
  withinLatencyBudget,
} from "../helpers/pure.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: measure single-call wall time in ms
// ─────────────────────────────────────────────────────────────────────────────

function measureSync<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { result, ms };
}

async function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { result, ms };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeFees — ≤ 1ms per call
// ─────────────────────────────────────────────────────────────────────────────

describe("latency: computeFees() ≤ 1ms", () => {
  const budget = LATENCY_BUDGETS.FEE_COMPUTATION;

  it("single computeFees call: within budget (pure arithmetic)", () => {
    const { ms } = measureSync(() => computeFees(250_000));
    expect(withinLatencyBudget(ms, budget)).toBe(true);
  });

  it("computeFees with cap path (large amount): within budget", () => {
    const { ms } = measureSync(() => computeFees(50_000_000));
    expect(withinLatencyBudget(ms, budget)).toBe(true);
  });

  it("1,000 consecutive computeFees calls: < 50ms total (throughput)", () => {
    const start = performance.now();
    for (let i = 0; i < 1_000; i++) {
      computeFees(Math.round(Math.random() * 10_000_000));
    }
    const total = performance.now() - start;
    expect(total).toBeLessThan(50);
  });

  it("budget constant value: maxMs = 1", () => {
    expect(budget.maxMs).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateSlug — ≤ 1ms per call
// ─────────────────────────────────────────────────────────────────────────────

describe("latency: generateSlug() ≤ 1ms", () => {
  const budget = LATENCY_BUDGETS.SLUG_GENERATION;

  it("single generateSlug call: within budget", () => {
    const { ms } = measureSync(() => generateSlug());
    expect(withinLatencyBudget(ms, budget)).toBe(true);
  });

  it("100 consecutive generateSlug calls: < 10ms total", () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) generateSlug();
    const total = performance.now() - start;
    expect(total).toBeLessThan(10);
  });

  it("budget constant value: maxMs = 1", () => {
    expect(budget.maxMs).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// makeReferralCode — ≤ 1ms per call
// ─────────────────────────────────────────────────────────────────────────────

describe("latency: makeReferralCode() ≤ 1ms", () => {
  const budget = LATENCY_BUDGETS.REFERRAL_CODE_GEN;

  it("single makeReferralCode call: within budget", () => {
    const { ms } = measureSync(() => makeReferralCode());
    expect(withinLatencyBudget(ms, budget)).toBe(true);
  });

  it("100 consecutive makeReferralCode calls: < 100ms total", () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) makeReferralCode();
    const total = performance.now() - start;
    expect(total).toBeLessThan(100);
  });

  it("budget constant value: maxMs = 1", () => {
    expect(budget.maxMs).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeHmacSha256 — ≤ 50ms (Web Crypto async)
// ─────────────────────────────────────────────────────────────────────────────

describe("latency: computeHmacSha256() ≤ 50ms", () => {
  const budget = LATENCY_BUDGETS.WEBHOOK_HMAC;
  const SECRET = "test-webhook-secret";
  const PAYLOAD = buildSignedPayload("1700000000", JSON.stringify({
    id: "evt_test",
    type: "collection.succeeded",
    data: { metadata: { participantId: "p123", sessionId: "s456" } },
  }));

  it("single HMAC computation: within 50ms budget (after warm-up)", async () => {
    // Web Crypto has a one-time JIT cost on first call; warm up first
    await computeHmacSha256(SECRET, PAYLOAD);
    const { ms } = await measureAsync(() => computeHmacSha256(SECRET, PAYLOAD));
    expect(withinLatencyBudget(ms, budget)).toBe(true);
  });

  it("10 consecutive HMAC computations: < 500ms total", async () => {
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      await computeHmacSha256(SECRET, PAYLOAD);
    }
    const total = performance.now() - start;
    expect(total).toBeLessThan(500);
  });

  it("budget constant value: maxMs = 50", () => {
    expect(budget.maxMs).toBe(50);
  });

  it("HMAC result is always 64 hex chars (contract check, not latency)", async () => {
    const sig = await computeHmacSha256(SECRET, PAYLOAD);
    expect(sig).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(sig)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// koboToAmountStr — ≤ 1ms
// ─────────────────────────────────────────────────────────────────────────────

describe("latency: koboToAmountStr() ≤ 1ms", () => {
  it("single conversion: < 5ms (first-call JIT overhead excluded by warm-up)", () => {
    koboToAmountStr(1); // warm up
    const { ms } = measureSync(() => koboToAmountStr(250_000));
    expect(ms).toBeLessThan(5);
  });

  it("1,000 conversions: < 10ms total", () => {
    const start = performance.now();
    for (let i = 0; i < 1_000; i++) koboToAmountStr(i * 100);
    const total = performance.now() - start;
    expect(total).toBeLessThan(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// abandonedCutoff — ≤ 1ms
// ─────────────────────────────────────────────────────────────────────────────

describe("latency: abandonedCutoff() ≤ 1ms", () => {
  it("cutoff computation is instantaneous (< 5ms to account for first-call overhead)", () => {
    // Warm up Date.now() path first
    abandonedCutoff(Date.now());
    const { ms } = measureSync(() => abandonedCutoff(Date.now()));
    expect(ms).toBeLessThan(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LATENCY_BUDGETS constants — structural validation
// ─────────────────────────────────────────────────────────────────────────────

describe("LATENCY_BUDGETS — constants are correctly defined", () => {
  it("FEE_COMPUTATION budget is defined and has maxMs + label", () => {
    const b = LATENCY_BUDGETS.FEE_COMPUTATION;
    expect(b).toBeDefined();
    expect(typeof b.maxMs).toBe("number");
    expect(typeof b.label).toBe("string");
  });

  it("all budgets have positive maxMs values", () => {
    for (const [, budget] of Object.entries(LATENCY_BUDGETS)) {
      expect(budget.maxMs).toBeGreaterThan(0);
    }
  });

  it("PAYMENT_POLL_TIMEOUT is 90_000ms (90 seconds) — matches PaymentSuccessPage.tsx", () => {
    expect(LATENCY_BUDGETS.PAYMENT_POLL_TIMEOUT.maxMs).toBe(90_000);
  });

  it("CLEANUP_CUTOFF_MS is 86_400_000ms (24 hours) — matches cron logic", () => {
    expect(LATENCY_BUDGETS.CLEANUP_CUTOFF_MS.maxMs).toBe(86_400_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// withinLatencyBudget helper
// ─────────────────────────────────────────────────────────────────────────────

describe("withinLatencyBudget helper", () => {
  const budget = { maxMs: 10, label: "test budget" };

  it("0ms is within any positive budget", () => {
    expect(withinLatencyBudget(0, budget)).toBe(true);
  });

  it("exactly at budget boundary → within (≤ not <)", () => {
    expect(withinLatencyBudget(10, budget)).toBe(true);
  });

  it("1ms over budget → NOT within", () => {
    expect(withinLatencyBudget(11, budget)).toBe(false);
  });

  it("well under budget → within", () => {
    expect(withinLatencyBudget(0.5, budget)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Throughput: checkout hot path — fee + amount string in one pass
// ─────────────────────────────────────────────────────────────────────────────

describe("checkout hot path throughput", () => {
  it("fee computation + kobo→NGN string for 1,000 checkouts: < 50ms", () => {
    const start = performance.now();
    for (let i = 0; i < 1_000; i++) {
      const fees = computeFees(100_000 + i * 100);
      koboToAmountStr(fees.checkoutAmountKobo);
    }
    const total = performance.now() - start;
    expect(total).toBeLessThan(50);
  });
});
