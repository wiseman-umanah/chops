import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
 * Flips participant status to "sent" and records the payment reference.
 */
export const updateParticipantStatus = mutation({
  args: {
    participantId: v.id("participants"),
    paymentRef: v.string(),
  },
  handler: async (ctx, { participantId, paymentRef }) => {
    const participant = await ctx.db.get(participantId);
    if (!participant) throw new Error("Participant not found");

    await ctx.db.patch(participantId, {
      status: "sent",
      paymentRef,
    });
  },
});
