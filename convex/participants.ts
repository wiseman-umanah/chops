import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

/**
 * Looks up a single participant + their session by payment reference.
 * Used by the public receipt page (/r/:paymentRef).
 * payerEmail is stripped — it is never needed by the receipt UI.
 */
export const getByPaymentRef = query({
  args: { paymentRef: v.string() },
  handler: async (ctx, { paymentRef }) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_payment_ref", (q) => q.eq("paymentRef", paymentRef))
      .first();

    if (!participant) return null;

    const session = await ctx.db.get(participant.sessionId);
    if (!session) return null;

    // Also fetch all participants so the receipt can show group progress
    const allParticipants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", participant.sessionId))
      .collect();

    // Strip payerEmail before sending to the client
    const { payerEmail: _pe, ...safeParticipant } = participant;
    void _pe;
    const safeAll = allParticipants.map(({ payerEmail: _e, ...p }) => { void _e; return p; });

    return { participant: safeParticipant, session, allParticipants: safeAll };
  },
});

/**
 * Fetches a single participant by ID — for internal use by actions.
 * Returns the full row including payerEmail (needed by initiateCheckout + webhook).
 */
export const getParticipantById = internalQuery({
  args: { participantId: v.id("participants") },
  handler: async (ctx, { participantId }) => {
    return ctx.db.get(participantId);
  },
});

/**
 * Public status-only poll — used by PaymentSuccessPage to detect when the
 * Bachs webhook has marked the participant as paid.
 * Returns only { status, paymentRef } — no PII, no email.
 */
export const getParticipantStatus = query({
  args: { participantId: v.id("participants") },
  handler: async (ctx, { participantId }) => {
    const row = await ctx.db.get(participantId);
    if (!row) return null;
    return { status: row.status, paymentRef: row.paymentRef ?? null };
  },
});

/**
 * Returns participants for a session (public — shown on the pay page).
 * payerEmail is stripped — it is private to the participant.
 */
export const getParticipantsBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const rows = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    return rows.map(({ payerEmail: _e, ...p }) => { void _e; return p; });
  },
});

/**
 * Called ONLY by the Bachs webhook HTTP action after signature verification.
 * Internal-only — cannot be called by any authenticated frontend client.
 *
 * Flips participant status to "sent", records the payment reference,
 * fires a notification to the organizer, and auto-closes food/bill sessions
 * when all participants have paid.
 */
export const updateParticipantStatus = internalMutation({
  args: {
    participantId: v.id("participants"),
    paymentRef: v.string(),
  },
  handler: async (ctx, { participantId, paymentRef }) => {
    const participant = await ctx.db.get(participantId);
    if (!participant) throw new Error("Participant not found");

    // Idempotency guard — if already paid, this is a duplicate webhook call. Ignore it.
    if (participant.status === "sent") {
      console.log(`Duplicate webhook for participant ${participantId} — already sent, skipping`);
      return;
    }

    await ctx.db.patch(participantId, { status: "sent", paymentRef });

    const session = await ctx.db.get(participant.sessionId);
    if (!session) return; // session deleted mid-flight — nothing to do

    // Check if all participants are now paid (food/bill only — chop-in never auto-closes)
    const allParticipants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", participant.sessionId))
      .collect();

    const allPaid =
      session.mode !== "chop-in" &&
      allParticipants.length > 0 &&
      allParticipants.every((p) => p.status === "sent");

    // Notify organizer of this payment
    const naira = Math.round(participant.amountOwed / 100).toLocaleString("en-NG");
    await ctx.db.insert("notifications", {
      userId: session.organizerId,
      type: "payment",
      title: `${participant.name} paid ₦${naira}`,
      body: allPaid ? "All participants have now paid." : undefined,
      sessionId: participant.sessionId,
      participantId,
      read: false,
    });

    if (allPaid) {
      await ctx.db.patch(participant.sessionId, { status: "closed" });
      await ctx.db.insert("notifications", {
        userId: session.organizerId,
        type: "session_closed",
        title: "Session fully paid 🎉",
        body: `All participants in "${session.name}" have paid. Session is now closed.`,
        sessionId: participant.sessionId,
        read: false,
      });
    }
  },
});

// demoMarkPaid removed — replaced by real Bachs payment flow.
// If needed for testing, use the Bachs sandbox with a real checkout session.

// patchPayerEmail removed — email patching is handled internally by
// internalPatchPayerEmail in payments.ts (called from initiateCheckout action).
