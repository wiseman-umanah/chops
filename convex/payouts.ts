import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Returns all payouts for the current user, newest first.
 * Used by the Wallet page to show transaction history.
 */
export const listPayouts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("payouts")
      .withIndex("by_organizer", (q) => q.eq("organizerId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * Returns all completed (status="closed") chop-in sessions for the current user.
 * These are eligible for withdrawal via the wallet page.
 */
export const listCompletedChopIn = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_organizer", (q) => q.eq("organizerId", userId))
      .order("desc")
      .collect();

    const chopInClosed = sessions.filter(
      (s) => s.mode === "chop-in" && s.status === "closed"
    );

    return Promise.all(
      chopInClosed.map(async (session) => {
        const participants = await ctx.db
          .query("participants")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        const collectedKobo = participants
          .filter((p) => p.status === "sent")
          .reduce((s, p) => s + p.amountOwed, 0);
        const feeKobo = session.feePercent
          ? Math.round(collectedKobo * (session.feePercent / 100))
          : 0;
        return {
          ...session,
          collectedKobo,
          feeKobo,
          payoutKobo: collectedKobo - feeKobo,
        };
      })
    );
  },
});

/**
 * Demo payout — inserts a payout record, closes the chop session (marks inactive),
 * and inserts a notification for the organizer.
 */
export const requestPayout = mutation({
  args: {
    sessionId: v.id("sessions"),
    recipientName: v.string(),
    accountNumber: v.string(),
    bankName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.organizerId !== userId) throw new Error("Not your session");
    if (session.status !== "closed") throw new Error("Session must be completed before payout");

    // Compute amount
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const collectedKobo = participants
      .filter((p) => p.status === "sent")
      .reduce((s, p) => s + p.amountOwed, 0);
    const feeKobo = session.feePercent
      ? Math.round(collectedKobo * (session.feePercent / 100))
      : 0;
    const payoutKobo = collectedKobo - feeKobo;

    const reference =
      "PAY-" + Math.random().toString(36).slice(2, 10).toUpperCase();

    // Insert payout record (demo: immediately processed)
    await ctx.db.insert("payouts", {
      sessionId: args.sessionId,
      organizerId: userId,
      amountKobo: payoutKobo,
      recipientName: args.recipientName,
      accountNumber: args.accountNumber,
      bankName: args.bankName,
      status: "processed",
      reference,
    });

    // Mark session inactive
    await ctx.db.patch(args.sessionId, { status: "inactive" });

    // Notification
    const naira = Math.round(payoutKobo / 100).toLocaleString("en-NG");
    await ctx.db.insert("notifications", {
      userId,
      type: "session_closed",
      title: `Payout of ₦${naira} sent`,
      body: `"${session.name}" payout to ${args.bankName} (${args.accountNumber}) is being processed.`,
      sessionId: args.sessionId,
      read: false,
    });

    return { reference, payoutKobo };
  },
});
