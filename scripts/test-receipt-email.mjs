/**
 * Test script — sends a dummy payment receipt email via Resend.
 *
 * Usage:
 *   AUTH_RESEND_KEY=re_... node scripts/test-receipt-email.mjs your@email.com
 */

const TO = process.argv[2];
if (!TO) {
  console.error("Usage: AUTH_RESEND_KEY=re_... node scripts/test-receipt-email.mjs <to@email.com>");
  process.exit(1);
}

const API_KEY = process.env.AUTH_RESEND_KEY;
if (!API_KEY) {
  console.error(
    "AUTH_RESEND_KEY not set.\n" +
    "Run: AUTH_RESEND_KEY=re_YOUR_KEY node scripts/test-receipt-email.mjs your@email.com"
  );
  process.exit(1);
}

// ── Dummy data ────────────────────────────────────────────────────────────────
const FROM        = process.env.RESEND_FROM ?? "Chop <payments@usechop.xyz>";
const payerName   = "Emeka Okonkwo";
const sessionName = "Mama Put Friday Lunch";
const amountKobo  = 350000; // ₦3,500
const paymentRef  = "CPY-TEST12345678";

const naira = `₦${Math.round(amountKobo / 100).toLocaleString("en-NG")}`;
const now = new Date().toLocaleString("en-NG", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false,
  timeZone: "Africa/Lagos",
});

// ── HTML — mirrors convex/notifications.ts sendPayerConfirmation ──────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%">

        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid #f0f0f0">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <img src="https://usechop.xyz/logo.png" alt="Chop" width="36" height="36"
                    style="border-radius:50%;display:block">
                </td>
                <td style="padding-left:12px;vertical-align:middle">
                  <span style="font-size:18px;font-weight:700;color:#FF6900">Chop</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:24px 32px 4px">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Receipt</p>
            <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#18181b">${sessionName}</h1>
          </td>
        </tr>

        <!-- Receipt rows -->
        <tr>
          <td style="padding:20px 32px 0">
            <table width="100%" cellpadding="0" cellspacing="0">

              <tr>
                <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#6b7280">Reference</td>
                <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#18181b;text-align:right;font-weight:500">${paymentRef}</td>
              </tr>

              <tr>
                <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#6b7280">Paid by</td>
                <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#18181b;text-align:right;font-weight:500">${payerName}</td>
              </tr>

              <tr>
                <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#6b7280">Method</td>
                <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#18181b;text-align:right;font-weight:500">Direct Transfer</td>
              </tr>

              <tr>
                <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#6b7280">Date</td>
                <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#18181b;text-align:right;font-weight:500">${now}</td>
              </tr>

              <tr>
                <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#6b7280">Contribution</td>
                <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#18181b;text-align:right;font-weight:500">${naira}</td>
              </tr>

              <!-- Total -->
              <tr>
                <td style="padding:14px 0 20px;font-size:15px;font-weight:700;color:#18181b">Total</td>
                <td style="padding:14px 0 20px;font-size:15px;font-weight:700;color:#18181b;text-align:right">${naira}</td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f0f0f0;background:#fafafa">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
              Need help? Contact us at
              <a href="mailto:support@usechop.xyz" style="color:#FF6900;text-decoration:none">support@usechop.xyz</a>
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#d1d5db;text-align:center">
              © Chop · usechop.xyz
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const text =
  `Hi ${payerName},\n\n` +
  `Your payment of ${naira} for "${sessionName}" was received.\n\n` +
  `Reference: ${paymentRef}\nDate: ${now}\n\n` +
  `Thanks for using Chop!\nFor support: support@usechop.xyz`;

// ── Send ──────────────────────────────────────────────────────────────────────
console.log(`Sending receipt to ${TO} …`);

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: FROM,
    reply_to: "support@usechop.xyz",
    to: TO,
    subject: `Payment confirmed — ${sessionName}`,
    html,
    text,
  }),
});

const body = await res.json().catch(() => ({}));

if (res.ok) {
  console.log(`✅  Sent! Resend email id: ${body.id}`);
  console.log(`    Check ${TO} — replies go to support@usechop.xyz`);
} else {
  console.error(`❌  Resend ${res.status}:`, body);
  process.exit(1);
}
