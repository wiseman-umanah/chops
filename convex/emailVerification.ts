/**
 * Email verification flow for password-signup users.
 *
 * Flow:
 *  1. After signUp succeeds on the frontend, call sendVerificationCode.
 *  2. User is redirected to /verify-email.
 *  3. User enters the 6-digit code → call verifyEmailCode.
 *  4. On success, the user is marked verified and redirected to /dashboard.
 *
 * Google OAuth users are already verified — skip this flow for them.
 */
import { v } from "convex/values";
import { internalAction, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Send (or resend) a verification code ──────────────────────────────────────

export const sendVerificationCode = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.email) throw new Error("No email on account");

    // If already verified, skip
    if (user.emailVerificationTime) return { alreadyVerified: true };

    // Invalidate any existing pending code for this user
    const existing = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(existing.map((r) => ctx.db.delete(r._id)));

    // Generate a 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + CODE_TTL_MS;

    await ctx.db.insert("emailVerifications", {
      userId,
      email: user.email,
      code,
      expiresAt,
      verified: false,
    });

    // Schedule email send (action called via scheduler so mutation stays fast)
    await ctx.scheduler.runAfter(0, internal.emailVerification.sendCodeEmail, {
      email: user.email,
      code,
    });

    return { alreadyVerified: false };
  },
});

// ── Verify the submitted code ─────────────────────────────────────────────────

export const verifyEmailCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rows = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const pending = rows.find((r) => !r.verified);
    if (!pending) throw new Error("No pending verification. Request a new code.");
    if (Date.now() > pending.expiresAt) throw new Error("Code expired. Request a new one.");
    if (pending.code !== code.trim()) throw new Error("Incorrect code. Please try again.");

    // Mark verified
    await ctx.db.patch(pending._id, { verified: true });

    // Stamp emailVerificationTime on the user row (checked by auth)
    await ctx.db.patch(userId as Id<"users">, { emailVerificationTime: Date.now() });

    // Clean up the verification row
    await ctx.db.delete(pending._id);

    return { success: true };
  },
});

// ── Check current verification status ────────────────────────────────────────

export const getVerificationStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { verified: false, email: null };
    const user = await ctx.db.get(userId);
    return {
      verified: !!user?.emailVerificationTime,
      email: user?.email ?? null,
    };
  },
});

// ── Internal: send the email (runs as a scheduled action) ────────────────────

export const sendCodeEmail = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (_ctx, { email, code }) => {
    const apiKey = process.env.AUTH_RESEND_KEY;
    const from   = process.env.AUTH_EMAIL_FROM ?? "Chop <noreply@usechop.xyz>";
    const SITE   = "https://usechop.xyz";

    if (!apiKey) {
      console.log(`[sendCodeEmail] no key — verification code for ${email}: ${code}`);
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%">
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid #f0f0f0">
            <table cellpadding="0" cellspacing="0"><tr>
              <td><img src="${SITE}/logo.png" alt="Chop" width="36" height="36" style="border-radius:50%;display:block"></td>
              <td style="padding-left:10px;vertical-align:middle"><span style="font-size:18px;font-weight:700;color:#FF6900">Chop</span></td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="padding:32px 32px 8px">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b">Verify your email</h1>
          <p style="margin:0;font-size:14px;color:#6b7280">Enter this code to confirm your Chop account. It expires in <strong>5 minutes</strong>.</p>
        </td></tr>
        <tr><td style="padding:24px 32px">
          <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#18181b;background:#f4f4f5;border-radius:12px;padding:20px;text-align:center">
            ${code}
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 28px">
          <p style="margin:0;font-size:13px;color:#9ca3af">If you didn't create a Chop account, you can safely ignore this email.</p>
        </td></tr>
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

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          reply_to: "support@usechop.xyz",
          to: email,
          subject: "Verify your Chop account",
          html,
          text: `Your Chop email verification code is: ${code}\n\nExpires in 5 minutes.\n\nIf you didn't create a Chop account, ignore this email.`,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[sendCodeEmail] Resend ${res.status}: ${text}`);
      }
    } catch (err) {
      console.warn("[sendCodeEmail] failed:", err);
    }
  },
});
