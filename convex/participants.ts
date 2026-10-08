import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Looks up a single participant + their session by payment reference.
 * Used by the public receipt page (/r/:paymentRef).
 */
export const getByPaymentRef = query({
  args: { paymentRef: v.string() },
  handler: async (ctx, { paymentRef }) => {
    // Scan is acceptable — paymentRef is unique and receipts are viewed rarely
    const participant = await ctx.db
      .query("participants")
      .filter((q) => q.eq(q.field("paymentRef"), paymentRef))
      .first();

    if (!participant) return null;

    const session = await ctx.db.get(participant.sessionId);
    if (!session) return null;

    // Also fetch all participants so the receipt can show group progress
    const allParticipants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", participant.sessionId))
      .collect();

    return { participant, session, allParticipants };
  },
});

/** Fetches a single participant by ID. Used by the checkout action. */
export const getParticipantById = query({
  args: { participantId: v.id("participants") },
  handler: async (ctx, { participantId }) => {
    return ctx.db.get(participantId);
  },
});

/** Returns all participants for a session (public) */
export const getParticipantsBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
  },
});

/**
 * Called by the Bachs webhook after a verified payment.
 * Flips participant status to "sent", records the payment reference,
 * fires a notification to the organizer, and auto-closes the session
 * when all participants have paid (food/bill modes).
 */
export const updateParticipantStatus = mutation({
  args: {
    participantId: v.id("participants"),
    paymentRef: v.string(),
  },
  handler: async (ctx, { participantId, paymentRef }) => {
    const participant = await ctx.db.get(participantId);
    if (!participant) throw new Error("Participant not found");

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

/**
 * Demo payment — marks an existing participant as paid (food/bill),
 * or inserts a new contributor and marks them paid (chop-in).
 * No payment gateway involved; for development/demo use only.
 */
export const demoMarkPaid = mutation({
  args: {
    /** The session the payment belongs to */
    sessionId: v.id("sessions"),
    /**
     * For food/bill: the _id of the existing participant row.
     * For chop-in: omit — a new row will be inserted.
     */
    participantId: v.optional(v.id("participants")),
    /** chop-in only — contributor display name */
    contributorName: v.optional(v.string()),
    /** chop-in only — amount contributed in kobo */
    amountKobo: v.optional(v.number()),
    /** A client-generated demo reference (e.g. "DEMO-xxxxxx") */
    paymentRef: v.string(),
  },
  handler: async (ctx, args) => {
    const { sessionId, participantId, contributorName, amountKobo, paymentRef } = args;

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");

    let participantName: string;
    let paidAmount: number;
    let notifParticipantId: (typeof args)["participantId"];

    if (participantId) {
      // food / bill — flip existing participant
      const p = await ctx.db.get(participantId);
      if (!p) throw new Error("Participant not found");
      await ctx.db.patch(participantId, { status: "sent", paymentRef });
      participantName = p.name;
      paidAmount = p.amountOwed;
      notifParticipantId = participantId;
    } else {
      // chop-in — insert a new contributor row and immediately mark it paid
      if (!amountKobo || amountKobo <= 0) throw new Error("amountKobo required for chop-in");
      const newId = await ctx.db.insert("participants", {
        sessionId,
        name: contributorName ?? "Anonymous",
        amountOwed: amountKobo,
        status: "sent",
        paymentRef,
        contributionAmount: amountKobo,
      });
      notifParticipantId = newId;
      participantName = contributorName ?? "Anonymous";
      paidAmount = amountKobo;
    }

    // Check if all participants are now paid (for food/bill — chop-in never fully "closes")
    const allParticipants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    const allPaid =
      session.mode !== "chop-in" &&
      allParticipants.length > 0 &&
      allParticipants.every((p) => p.status === "sent");

    // Insert payment notification for the organizer
    const naira = Math.round(paidAmount / 100).toLocaleString("en-NG");
    await ctx.db.insert("notifications", {
      userId: session.organizerId,
      type: "payment",
      title: `${participantName} paid ₦${naira}`,
      body: allPaid ? "All participants have now paid." : undefined,
      sessionId,
      participantId: notifParticipantId,
      read: false,
    });

    if (allPaid) {
      // Close the session
      await ctx.db.patch(sessionId, { status: "closed" });
      await ctx.db.insert("notifications", {
        userId: session.organizerId,
        type: "session_closed",
        title: "Session fully paid 🎉",
        body: `All participants in "${session.name}" have paid. Session is now closed.`,
        sessionId,
        read: false,
      });
    }
  },
});
