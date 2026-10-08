import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Returns all notifications for the current user, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Returns the count of unread notifications for the current user. */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
      .collect();
    return rows.length;
  },
});

/** Marks a single notification as read. */
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const notif = await ctx.db.get(notificationId);
    if (!notif || notif.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(notificationId, { read: true });
  },
});

/** Marks all notifications for the current user as read. */
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
      .collect();
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { read: true })));
  },
});

/**
 * Internal helper — called by demoMarkPaid and the Bachs webhook to
 * insert a notification for the session organizer.
 */
export const insertPaymentNotification = mutation({
  args: {
    organizerId: v.string(),
    sessionId: v.id("sessions"),
    participantId: v.id("participants"),
    participantName: v.string(),
    amountKobo: v.number(),
    allPaid: v.boolean(),
  },
  handler: async (ctx, args) => {
    const naira = Math.round(args.amountKobo / 100).toLocaleString("en-NG");
    await ctx.db.insert("notifications", {
      userId: args.organizerId,
      type: "payment",
      title: `${args.participantName} paid ₦${naira}`,
      body: args.allPaid ? "All participants have now paid — your session is closed." : undefined,
      sessionId: args.sessionId,
      participantId: args.participantId,
      read: false,
    });

    if (args.allPaid) {
      await ctx.db.insert("notifications", {
        userId: args.organizerId,
        type: "session_closed",
        title: "Session fully paid 🎉",
        body: "All participants have paid. Your chop session is now closed.",
        sessionId: args.sessionId,
        read: false,
      });
    }
  },
});
