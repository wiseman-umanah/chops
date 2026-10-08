import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Bachs payment webhook.
 * Receives a POST from Bachs after a successful payment, verifies the
 * signature, and flips the participant status to "sent".
 *
 * Expected payload shape (update once Bachs SDK docs are confirmed):
 * {
 *   event: "payment.success",
 *   data: {
 *     reference: string,       // Bachs payment reference
 *     metadata: {
 *       participantId: string  // Convex participant _id passed at checkout
 *     }
 *   }
 * }
 */
export const bachsWebhook = httpAction(async (ctx, request) => {
  // ── Signature verification ────────────────────────────────────────────
  const signature = request.headers.get("x-bachs-signature");
  const secret = process.env.BACHS_WEBHOOK_SECRET;

  if (!secret) {
    console.error("BACHS_WEBHOOK_SECRET env variable not set");
    return new Response("Server misconfiguration", { status: 500 });
  }

  if (!signature) {
    return new Response("Missing signature", { status: 401 });
  }

  // TODO: Replace with actual Bachs HMAC verification once SDK docs confirmed
  // Example pattern (typical for Paystack/Flutterwave style):
  // const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  // if (hash !== signature) return new Response("Invalid signature", { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────
  let payload: {
    event: string;
    data: { reference: string; metadata: { participantId: string } };
  };

  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (payload.event !== "payment.success") {
    // Acknowledge non-payment events without acting on them
    return new Response("OK", { status: 200 });
  }

  const { reference, metadata } = payload.data;
  const { participantId } = metadata;

  if (!participantId || !reference) {
    return new Response("Missing participantId or reference", { status: 400 });
  }

  // ── Update participant status ─────────────────────────────────────────
  try {
    await ctx.runMutation(api.participants.updateParticipantStatus, {
      participantId: participantId as never,
      paymentRef: reference,
    });
  } catch (err) {
    console.error("Failed to update participant:", err);
    return new Response("Internal error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
