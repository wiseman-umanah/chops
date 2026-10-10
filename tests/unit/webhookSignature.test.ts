/**
 * tests/unit/webhookSignature.test.ts
 *
 * Strict tests for the Bachs webhook HMAC-SHA256 signature verification.
 *
 * Source: convex/http_actions.ts :: bachsWebhook
 *
 * Contract:
 *   1. Signed payload = "{timestamp}.{rawBody}"
 *   2. Algorithm: HMAC-SHA256 (Web Crypto, hex output)
 *   3. Header format: "X-Bachs-Signature-V2: t={timestamp},v1={hex}"
 *   4. Replay guard: |now - timestamp| > 300 seconds → 401
 *   5. Missing header → 401
 *   6. Malformed header (no t= or no v1=) → 401
 *   7. Signature mismatch (tampered body or wrong secret) → 401
 *   8. Valid signature, within 5 min window → passes
 */

import { describe, it, expect } from "vitest";
import {
  buildSignedPayload,
  computeHmacSha256,
  parseSignatureHeader,
  isWithinReplayWindow,
} from "../helpers/pure.js";

const TEST_SECRET = "test-webhook-secret-abc123";
const TEST_BODY = JSON.stringify({
  id: "evt_test_123",
  type: "collection.succeeded",
  data: {
    metadata: { participantId: "p123", sessionId: "s456" },
    amount: "500.00",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSignedPayload
// ─────────────────────────────────────────────────────────────────────────────

describe("buildSignedPayload", () => {
  it("format is exactly '{timestamp}.{rawBody}'", () => {
    const ts = "1698765432";
    const body = '{"type":"test"}';
    expect(buildSignedPayload(ts, body)).toBe(`${ts}.${body}`);
  });

  it("empty body is still signed: '{timestamp}.'", () => {
    expect(buildSignedPayload("1698765432", "")).toBe("1698765432.");
  });

  it("body containing dots is not split — only the first dot is the separator", () => {
    const ts = "1698765432";
    const body = '{"key":"val.ue.with.dots"}';
    const payload = buildSignedPayload(ts, body);
    expect(payload).toBe(`${ts}.${body}`);
    // Verify the body is fully intact after the first dot
    expect(payload.slice(ts.length + 1)).toBe(body);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeHmacSha256
// ─────────────────────────────────────────────────────────────────────────────

describe("computeHmacSha256", () => {
  it("returns a hex string of exact length 64 (SHA-256 = 32 bytes = 64 hex chars)", async () => {
    const sig = await computeHmacSha256(TEST_SECRET, "payload");
    expect(sig).toHaveLength(64);
  });

  it("output is lowercase hex only", async () => {
    const sig = await computeHmacSha256(TEST_SECRET, "payload");
    expect(/^[0-9a-f]{64}$/.test(sig)).toBe(true);
  });

  it("same secret + payload → identical signature (deterministic)", async () => {
    const sig1 = await computeHmacSha256(TEST_SECRET, TEST_BODY);
    const sig2 = await computeHmacSha256(TEST_SECRET, TEST_BODY);
    expect(sig1).toBe(sig2);
  });

  it("different secret → different signature", async () => {
    const sig1 = await computeHmacSha256("secret-one", TEST_BODY);
    const sig2 = await computeHmacSha256("secret-two", TEST_BODY);
    expect(sig1).not.toBe(sig2);
  });

  it("1 character change in body → completely different signature (avalanche effect)", async () => {
    const sig1 = await computeHmacSha256(TEST_SECRET, TEST_BODY);
    const sig2 = await computeHmacSha256(TEST_SECRET, TEST_BODY + " ");
    expect(sig1).not.toBe(sig2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end signature verification (mirrors the webhook handler logic)
// ─────────────────────────────────────────────────────────────────────────────

describe("webhook signature end-to-end verification", () => {
  async function makeValidHeader(
    secret: string,
    rawBody: string,
    ts: number,
  ): Promise<string> {
    const timestamp = String(ts);
    const signedPayload = buildSignedPayload(timestamp, rawBody);
    const sig = await computeHmacSha256(secret, signedPayload);
    return `t=${timestamp},v1=${sig}`;
  }

  it("valid signature + valid timestamp → parsed header matches computed sig", async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = await makeValidHeader(TEST_SECRET, TEST_BODY, now);

    const parsed = parseSignatureHeader(header);
    expect(parsed).not.toBeNull();

    const { t, v1 } = parsed!;
    const expected = await computeHmacSha256(
      TEST_SECRET,
      buildSignedPayload(t, TEST_BODY),
    );
    expect(v1).toBe(expected);
  });

  it("tampered body → computed sig does NOT match header sig", async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = await makeValidHeader(TEST_SECRET, TEST_BODY, now);
    const parsed = parseSignatureHeader(header)!;

    const tamperedBody = TEST_BODY + "_tampered";
    const recomputed = await computeHmacSha256(
      TEST_SECRET,
      buildSignedPayload(parsed.t, tamperedBody),
    );
    expect(recomputed).not.toBe(parsed.v1); // mismatch → should 401
  });

  it("wrong secret → computed sig does NOT match", async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = await makeValidHeader(TEST_SECRET, TEST_BODY, now);
    const parsed = parseSignatureHeader(header)!;

    const wrongSecretSig = await computeHmacSha256(
      "wrong-secret",
      buildSignedPayload(parsed.t, TEST_BODY),
    );
    expect(wrongSecretSig).not.toBe(parsed.v1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseSignatureHeader
// ─────────────────────────────────────────────────────────────────────────────

describe("parseSignatureHeader", () => {
  it("valid header → returns { t, v1 }", () => {
    const result = parseSignatureHeader("t=1698765432,v1=abcdef1234567890");
    expect(result).toEqual({ t: "1698765432", v1: "abcdef1234567890" });
  });

  it("missing t= → returns null", () => {
    expect(parseSignatureHeader("v1=abcdef")).toBeNull();
  });

  it("missing v1= → returns null", () => {
    expect(parseSignatureHeader("t=1698765432")).toBeNull();
  });

  it("empty string → returns null", () => {
    expect(parseSignatureHeader("")).toBeNull();
  });

  it("completely malformed → returns null", () => {
    expect(parseSignatureHeader("garbage")).toBeNull();
  });

  it("v1 value containing '=' characters (base64-like) — parses correctly", () => {
    // The backend uses indexOf("=") not split("="), so values with = are handled
    const result = parseSignatureHeader("t=123,v1=abc=def=ghi");
    expect(result?.t).toBe("123");
    // "v1=abc=def=ghi" → key="v1", value="abc=def=ghi" (everything after first =)
    expect(result?.v1).toBe("abc=def=ghi");
  });

  it("extra segments (future fields) are ignored — still parses t and v1", () => {
    const result = parseSignatureHeader("t=1698765432,v1=hexsig,extra=future");
    expect(result).toEqual({ t: "1698765432", v1: "hexsig" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isWithinReplayWindow
// ─────────────────────────────────────────────────────────────────────────────

describe("isWithinReplayWindow — 300-second replay guard", () => {
  it("timestamp = now → passes (diff = 0)", () => {
    const now = 1_700_000_000;
    expect(isWithinReplayWindow(now, now)).toBe(true);
  });

  it("timestamp = now - 299 seconds → passes (just inside window)", () => {
    const now = 1_700_000_000;
    expect(isWithinReplayWindow(now - 299, now)).toBe(true);
  });

  it("timestamp = now - 300 seconds → passes (at boundary — diff = 300, not > 300)", () => {
    const now = 1_700_000_000;
    expect(isWithinReplayWindow(now - 300, now)).toBe(true);
  });

  it("CRITICAL — timestamp = now - 301 seconds → FAILS (diff = 301 > 300)", () => {
    const now = 1_700_000_000;
    expect(isWithinReplayWindow(now - 301, now)).toBe(false);
  });

  it("timestamp in the future (up to 300s ahead) → passes (|diff| is symmetric)", () => {
    const now = 1_700_000_000;
    expect(isWithinReplayWindow(now + 300, now)).toBe(true);
  });

  it("timestamp 301s in the future → fails", () => {
    const now = 1_700_000_000;
    expect(isWithinReplayWindow(now + 301, now)).toBe(false);
  });

  it("very old timestamp (1 hour ago) → fails", () => {
    const now = 1_700_000_000;
    expect(isWithinReplayWindow(now - 3600, now)).toBe(false);
  });
});
