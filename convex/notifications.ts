import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
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
 * Internal — insert a system notification (payout delivered / failed).
 * Called by the Bachs webhook handler; does not require auth.
 */
export const insertSystemNotification = internalMutation({
  args: {
    userId: v.string(),
    type: v.union(v.literal("payment"), v.literal("session_closed")),
    title: v.string(),
    body: v.optional(v.string()),
    sessionId: v.optional(v.id("sessions")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      sessionId: args.sessionId,
      read: false,
    });
  },
});

/**
 * Internal — sends a payment confirmation email to the payer.
 * Uses the Bachs Transactional Email API if BACHS_EMAIL_FROM is set,
 * otherwise logs the details (safe no-op in development).
 *
 * Called by the Bachs webhook after a successful collection.succeeded event.
 */
export const sendPayerConfirmation = internalAction({
  args: {
    payerEmail: v.string(),
    payerName: v.string(),
    sessionName: v.string(),
    amountKobo: v.number(),
    paymentRef: v.string(),
  },
  handler: async (_ctx, { payerEmail, payerName, sessionName, amountKobo, paymentRef }) => {
    const fromEmail = process.env.BACHS_EMAIL_FROM;
    const secretKey = process.env.BACHS_SECRET_KEY;

    const naira = `₦${Math.round(amountKobo / 100).toLocaleString("en-NG")}`;

    if (!fromEmail || !secretKey) {
      // Development / misconfiguration — log and skip silently
      console.log(
        `[sendPayerConfirmation] Would send to ${payerEmail}: ${naira} paid for "${sessionName}" (ref: ${paymentRef})`
      );
      return;
    }

    const BACHS_API_BASE =
      process.env.BACHS_ENV === "production"
        ? "https://api.bachs.io/v1"
        : "https://sandbox-api.bachs.io/v1";

    const body = {
      from: fromEmail,
      to: payerEmail,
      subject: `Payment confirmed — ${sessionName}`,
      html: `<p>Hi ${payerName},</p><p>Your payment of <strong>${naira}</strong> for <strong>${sessionName}</strong> was received successfully.</p><p>Reference: <code>${paymentRef}</code></p><p>Thanks for using Chop!</p>`,
    };

    try {
      const res = await fetch(`${BACHS_API_BASE}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secretKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[sendPayerConfirmation] Bachs email API ${res.status}: ${text}`);
      }
    } catch (err) {
      // Non-fatal — payment already confirmed; don't surface email errors to the user
      console.warn("[sendPayerConfirmation] Failed to send confirmation email:", err);
    }
  },
});
