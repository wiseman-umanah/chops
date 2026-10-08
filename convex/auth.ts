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
const ResendOTP = Email({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  sendVerificationRequest: async ({ identifier: email, provider, token }) => {
    const from = process.env.AUTH_EMAIL_FROM ?? "Chops <onboarding@resend.dev>";

    // Call Resend directly — send a branded OTP email
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Your Chops password reset code",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
            <h2 style="color:#FF6900;margin-bottom:4px">Chops</h2>
            <p style="color:#374151;margin-bottom:24px">Password reset request</p>
            <p style="font-size:15px;color:#374151">Use this code to reset your password. It expires in <strong>15 minutes</strong>.</p>
            <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#18181b;background:#f4f4f5;border-radius:12px;padding:20px 32px;text-align:center;margin:24px 0">
              ${token}
            </div>
            <p style="font-size:13px;color:#9ca3af">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
        text: `Your Chops password reset code is: ${token}\n\nExpires in 15 minutes.`,
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
