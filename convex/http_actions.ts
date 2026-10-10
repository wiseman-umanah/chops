import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

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
    data: Record<string, unknown>;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── Route by event type ───────────────────────────────────────────────────

  if (payload.type === "collection.succeeded") {
    const data = payload.data as {
      charge_id: string | null;
      checkout_id: string | null;
      reference: string | null;
      status: string;
      metadata: { participantId?: string; sessionId?: string };
    };

    const { reference, charge_id, checkout_id, metadata } = data;
    const { participantId } = metadata ?? {};
    const paymentRef = reference ?? charge_id ?? checkout_id ?? payload.id;

    if (!participantId) {
      console.error("Bachs webhook: missing participantId in metadata", { eventId: payload.id });
      return new Response("Missing participantId in metadata", { status: 400 });
    }

    try {
      await _ctx.runMutation(internal.participants.updateParticipantStatus, {
        participantId: participantId as never,
        paymentRef,
      });
    } catch (err) {
      console.error("Bachs webhook: failed to update participant", err);
      return new Response("Internal error", { status: 500 });
    }

    // Fire payer confirmation email (non-fatal — runs after the mutation succeeds)
    try {
      const participant = await _ctx.runQuery(internal.participants.getParticipantById, {
        participantId: participantId as never,
      });
      if (participant?.payerEmail) {
        const session = await _ctx.runQuery(internal.sessions.getSessionById, {
          sessionId: participant.sessionId,
        });
        if (session) {
          await _ctx.runAction(internal.notifications.sendPayerConfirmation, {
            payerEmail: participant.payerEmail,
            payerName: participant.name,
            sessionName: session.name,
            amountKobo: participant.amountOwed,
            paymentRef,
          });
        }
      }
    } catch (emailErr) {
      console.warn("Bachs webhook: payer confirmation email failed (non-fatal):", emailErr);
    }

    return new Response("OK", { status: 200 });
  }

  if (payload.type === "payout.paid") {
    // data.withdrawal_id is the pay_... ID we stored as bachsPayoutId
    const data = payload.data as { withdrawal_id?: string; id?: string };
    const bachsPayoutId = data.withdrawal_id ?? data.id ?? "";

    if (!bachsPayoutId) {
      console.error("Bachs payout.paid: missing payout ID", payload);
      return new Response("Missing payout ID", { status: 400 });
    }

    try {
      const payout = await _ctx.runQuery(internal.payouts.findPayoutByBachsId, { bachsPayoutId });
      if (!payout) {
        console.warn("Bachs payout.paid: no matching payout row for", bachsPayoutId);
        return new Response("OK", { status: 200 }); // idempotent
      }

      // Mark payout completed
      await _ctx.runMutation(internal.payouts.updatePayoutStatus, {
        payoutId: payout._id,
        status: "completed",
      });

      // Mark session inactive (payout delivered)
      await _ctx.runMutation(internal.sessions.setSessionStatus, {
        sessionId: payout.sessionId,
        status: "inactive",
      });

      // Notify organizer
      const naira = Math.round(payout.amountKobo / 100).toLocaleString("en-NG");
      const masked = "•".repeat(payout.accountNumber.length - 4) + payout.accountNumber.slice(-4);
      await _ctx.runMutation(internal.notifications.insertSystemNotification, {
        userId: payout.organizerId,
        type: "session_closed",
        title: `₦${naira} delivered to your bank`,
        body: `Your payout to ${payout.bankName} (${masked}) has landed.`,
        sessionId: payout.sessionId,
      });
    } catch (err) {
      console.error("Bachs payout.paid: handler error", err);
      return new Response("Internal error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
  }

  if (payload.type === "payout.failed") {
    const data = payload.data as {
      withdrawal_id?: string;
      id?: string;
      failure_reason?: string;
    };
    const bachsPayoutId = data.withdrawal_id ?? data.id ?? "";
    const failureReason = data.failure_reason ?? "Unknown reason";

    if (!bachsPayoutId) {
      console.error("Bachs payout.failed: missing payout ID", payload);
      return new Response("Missing payout ID", { status: 400 });
    }

    try {
      const payout = await _ctx.runQuery(internal.payouts.findPayoutByBachsId, { bachsPayoutId });
      if (!payout) {
        console.warn("Bachs payout.failed: no matching payout row for", bachsPayoutId);
        return new Response("OK", { status: 200 });
      }

      await _ctx.runMutation(internal.payouts.updatePayoutStatus, {
        payoutId: payout._id,
        status: "failed",
        failureReason,
      });

      // Notify organizer so they can retry
      await _ctx.runMutation(internal.notifications.insertSystemNotification, {
        userId: payout.organizerId,
        type: "session_closed",
        title: "Payout failed",
        body: `Your payout to ${payout.bankName} could not be delivered: ${failureReason}. Please try again from your dashboard.`,
        sessionId: payout.sessionId,
      });
    } catch (err) {
      console.error("Bachs payout.failed: handler error", err);
      return new Response("Internal error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
  }

  // All other event types — acknowledge without acting
  return new Response("OK", { status: 200 });
});
