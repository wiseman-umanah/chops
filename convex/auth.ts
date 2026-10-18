import { convexAuth, type GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { type GenericDataModel } from "convex/server";

/**
 * Resend email provider — used for password reset OTP emails.
 * Requires two env vars:
 *   AUTH_RESEND_KEY  — your Resend API key (re_...)
 *   AUTH_EMAIL_FROM  — verified sender address (e.g. noreply@yourdomain.com)
 *                      or "onboarding@resend.dev" for sandbox testing
 */
const SITE = "https://usechop.xyz";

const ResendOTP = Email({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  sendVerificationRequest: async ({ identifier: email, provider, token }) => {
    const from = process.env.AUTH_EMAIL_FROM ?? "Chop <noreply@usechop.xyz>";

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
        <tr>
          <td style="padding:32px 32px 8px">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b">Password reset</h1>
            <p style="margin:0;font-size:14px;color:#6b7280">Use this code to reset your Chop password. It expires in <strong>15 minutes</strong>.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px">
            <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#18181b;background:#f4f4f5;border-radius:12px;padding:20px;text-align:center">
              ${token}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px">
            <p style="margin:0;font-size:13px;color:#9ca3af">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
          </td>
        </tr>
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

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        reply_to: "support@usechop.xyz",
        to: email,
        subject: "Your Chop password reset code",
        html,
        text: `Your Chop password reset code is: ${token}\n\nExpires in 15 minutes.\n\nIf you didn't request this, ignore this email.`,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Failed to send reset email: ${err}`);
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password({
      profile(params, _ctx: GenericActionCtxWithAuthConfig<GenericDataModel>) {
        // Extra fields passed from the signup form are available in params
        return {
          email: params.email as string,
          firstName: (params.firstName as string | undefined) ?? "",
          lastName: (params.lastName as string | undefined) ?? "",
          phone: (params.phone as string | undefined) ?? "",
        };
      },
      // Wire the Resend email provider for password reset OTP delivery
      reset: ResendOTP,
    }),
  ],
});
