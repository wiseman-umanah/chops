import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Bachs payment webhook.
 *
 * Bachs signs every delivery using HMAC-SHA256 over "{timestamp}.{rawBody}".
 * The result is sent in the `X-Bachs-Signature-V2` header as:
 *   t={unix_timestamp},v1={hex_signature}
 *
 * We parse that header, reconstruct the signed string, verify it, then act
 * on `collection.succeeded` events by flipping the participant to "sent".
 *
 * Webhook payload shape:
 * {
 *   id: string,                  // evt_ — use for deduplication
 *   type: "collection.succeeded",
 *   created_at: string,
 *   data: {
 *     charge_id: string | null,
 *     checkout_id: string | null,
 *     reference: string,
 *     status: "SUCCEEDED",
 *     amount: string,
 *     metadata: {
 *       participantId: string,   // Convex participant _id we passed at checkout
 *       sessionId: string
 *     }
 *   }
 * }
 */
export const bachsWebhook = httpAction(async (_ctx, request) => {
  // ── Read secret ───────────────────────────────────────────────────────────
  const secret = process.env.BACHS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("BACHS_WEBHOOK_SECRET env variable not set");
    return new Response("Server misconfiguration", { status: 500 });
  }

  // ── Read raw body FIRST (must happen before any .json() call) ────────────
  const rawBody = await request.text();

  // ── Parse and verify X-Bachs-Signature-V2 ───────────────────────────────
  // Format: "t=<unix_ts>,v1=<hex_signature>"
  const sigHeader = request.headers.get("X-Bachs-Signature-V2");
  if (!sigHeader) {
    return new Response("Missing signature header", { status: 401 });
  }

  // Parse "t=1234567890,v1=abcdef..."
  const parts: Record<string, string> = {};
  for (const part of sigHeader.split(",")) {
    const eq = part.indexOf("=");
    if (eq !== -1) parts[part.slice(0, eq)] = part.slice(eq + 1);
  }

  const timestamp = parts["t"];
  const receivedSig = parts["v1"];

  if (!timestamp || !receivedSig) {
    return new Response("Malformed signature header", { status: 401 });
  }

  // ── Replay-attack guard: reject events older than 5 minutes ──────────────
  const tsSeconds = parseInt(timestamp, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > 300) {
    return new Response("Timestamp too old", { status: 401 });
  }

  // ── HMAC-SHA256 using Web Crypto (Convex runs V8, not Node) ──────────────
  // Signed payload: "{timestamp}.{rawBody}"
  const signedPayload = `${timestamp}.${rawBody}`;

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(signedPayload)
  );
  const computedSig = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedSig !== receivedSig) {
    console.warn("Bachs webhook: signature mismatch");
    return new Response("Invalid signature", { status: 401 });
  }

  // ── Parse verified body ───────────────────────────────────────────────────
  let payload: {
    id: string;
    type: string;
    data: {
      charge_id: string | null;
      checkout_id: string | null;
      reference: string | null;
      status: string;
      metadata: {
        participantId?: string;
        sessionId?: string;
      };
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── Only act on collection.succeeded ─────────────────────────────────────
  if (payload.type !== "collection.succeeded") {
    // Acknowledge all other event types without acting
    return new Response("OK", { status: 200 });
  }

  const { reference, charge_id, checkout_id, metadata } = payload.data;
  const { participantId } = metadata ?? {};

  // Use the first non-null reference available as our stored paymentRef
  const paymentRef = reference ?? charge_id ?? checkout_id ?? payload.id;

  if (!participantId) {
    console.error("Bachs webhook: missing participantId in metadata", {
      eventId: payload.id,
    });
    return new Response("Missing participantId in metadata", { status: 400 });
  }

  // ── Flip participant to paid ──────────────────────────────────────────────
  try {
    await _ctx.runMutation(api.participants.updateParticipantStatus, {
      participantId: participantId as never,
      paymentRef,
    });
  } catch (err) {
    console.error("Bachs webhook: failed to update participant", err);
    return new Response("Internal error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
