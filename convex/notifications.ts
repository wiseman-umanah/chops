import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Shared email helpers ───────────────────────────────────────────────────────

const SITE = "https://usechop.xyz";

/** Wraps content in the standard Chop email shell (header + footer). */
function emailShell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%">

        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid #f0f0f0">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td><img src="${SITE}/logo.png" alt="Chop" width="36" height="36" style="border-radius:50%;display:block"></td>
                <td style="padding-left:10px;vertical-align:middle">
                  <span style="font-size:18px;font-weight:700;color:#FF6900">Chop</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${bodyHtml}

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f0f0f0;background:#fafafa">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
              Need help? <a href="mailto:support@usechop.xyz" style="color:#FF6900;text-decoration:none">support@usechop.xyz</a>
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#d1d5db;text-align:center">© Chop · usechop.xyz</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Renders a label/value row with a dashed bottom border. */
function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#6b7280">${label}</td>
    <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#18181b;text-align:right;font-weight:500">${value}</td>
  </tr>`;
}

async function sendEmail(apiKey: string, payload: {
  from: string; reply_to: string; to: string; subject: string; html: string; text: string;
}, tag: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[${tag}] Resend ${res.status}: ${text}`);
  } else {
    console.log(`[${tag}] Sent to ${payload.to}`);
  }
}

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
 * Internal — sends a payment receipt email to the payer via Resend.
 * Called by the Bachs webhook after collection.succeeded.
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
    const apiKey = process.env.AUTH_RESEND_KEY;
    const from = process.env.RESEND_FROM ?? "Chop <payments@usechop.xyz>";
    if (!apiKey) {
      console.log(`[sendPayerConfirmation] no key — would send to ${payerEmail}`);
      return;
    }
    const naira = `₦${Math.round(amountKobo / 100).toLocaleString("en-NG")}`;
    const now = new Date().toLocaleString("en-NG", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: "Africa/Lagos",
    });
    const html = emailShell(`
      <tr><td style="padding:24px 32px 4px">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Receipt</p>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#18181b">${sessionName}</h1>
      </td></tr>
      <tr><td style="padding:20px 32px 0">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row("Reference", paymentRef)}
          ${row("Paid by", payerName)}
          ${row("Method", "Direct Transfer")}
          ${row("Date", now)}
          ${row("Contribution", naira)}
          <tr>
            <td style="padding:14px 0 20px;font-size:15px;font-weight:700;color:#18181b">Total</td>
            <td style="padding:14px 0 20px;font-size:15px;font-weight:700;color:#18181b;text-align:right">${naira}</td>
          </tr>
        </table>
      </td></tr>
    `);
    await sendEmail(apiKey, {
      from, reply_to: "support@usechop.xyz", to: payerEmail,
      subject: `Payment confirmed — ${sessionName}`,
      html,
      text: `Hi ${payerName},\n\nYour payment of ${naira} for "${sessionName}" was received.\n\nReference: ${paymentRef}\nDate: ${now}\n\nThanks for using Chop!\nsupport@usechop.xyz`,
    }, "sendPayerConfirmation");
  },
});

/**
 * Internal — sends a payout confirmation email to the organizer after funds land.
 * Called by the Bachs webhook after payout.paid.
 */
export const sendOrganizerPayout = internalAction({
  args: {
    organizerEmail: v.string(),
    organizerName: v.string(),
    sessionName: v.string(),
    amountKobo: v.number(),
    bankName: v.string(),
    accountNumber: v.string(),
    reference: v.string(),
  },
  handler: async (_ctx, { organizerEmail, organizerName, sessionName, amountKobo, bankName, accountNumber, reference }) => {
    const apiKey = process.env.AUTH_RESEND_KEY;
    const from = process.env.RESEND_FROM ?? "Chop <payments@usechop.xyz>";
    if (!apiKey) {
      console.log(`[sendOrganizerPayout] no key — would send to ${organizerEmail}`);
      return;
    }
    const naira = `₦${Math.round(amountKobo / 100).toLocaleString("en-NG")}`;
    const masked = "•".repeat(accountNumber.length - 4) + accountNumber.slice(-4);
    const now = new Date().toLocaleString("en-NG", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: "Africa/Lagos",
    });
    const html = emailShell(`
      <tr><td style="padding:24px 32px 4px">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Payout</p>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#18181b">${sessionName}</h1>
      </td></tr>
      <tr><td style="padding:12px 32px 4px">
        <p style="margin:0;font-size:14px;color:#374151">Hi <strong>${organizerName}</strong>, your payout has landed.</p>
      </td></tr>
      <tr><td style="padding:8px 32px 0">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row("Reference", reference)}
          ${row("Bank", bankName)}
          ${row("Account", masked)}
          ${row("Date", now)}
          <tr>
            <td style="padding:14px 0 20px;font-size:15px;font-weight:700;color:#18181b">Amount received</td>
            <td style="padding:14px 0 20px;font-size:15px;font-weight:700;color:#00C950;text-align:right">${naira}</td>
          </tr>
        </table>
      </td></tr>
    `);
    await sendEmail(apiKey, {
      from, reply_to: "support@usechop.xyz", to: organizerEmail,
      subject: `${naira} delivered — ${sessionName}`,
      html,
      text: `Hi ${organizerName},\n\nYour payout of ${naira} for "${sessionName}" has been delivered to ${bankName} (${masked}).\n\nReference: ${reference}\nDate: ${now}\n\nThanks for using Chop!\nsupport@usechop.xyz`,
    }, "sendOrganizerPayout");
  },
});
