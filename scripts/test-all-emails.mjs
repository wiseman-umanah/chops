/**
 * Test script — sends all Chop email templates to a target address.
 *
 * Usage:
 *   AUTH_RESEND_KEY=re_... node scripts/test-all-emails.mjs your@email.com
 *
 * Templates sent:
 *   1. Payer receipt       (payment confirmed)
 *   2. Organizer payout    (funds delivered)
 *   3. Password reset OTP  (6-digit code)
 */

const TO = process.argv[2];
if (!TO) {
  console.error("Usage: AUTH_RESEND_KEY=re_... node scripts/test-all-emails.mjs <to@email.com>");
  process.exit(1);
}
const API_KEY = process.env.AUTH_RESEND_KEY;
if (!API_KEY) {
  console.error("AUTH_RESEND_KEY not set.");
  process.exit(1);
}

const FROM_PAYMENTS = process.env.RESEND_FROM ?? "Chop <payments@usechop.xyz>";
const FROM_NOREPLY  = process.env.AUTH_EMAIL_FROM ?? "Chop <noreply@usechop.xyz>";
const SITE = "https://usechop.xyz";

const now = new Date().toLocaleString("en-NG", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false,
  timeZone: "Africa/Lagos",
});

// ── Shared helpers ────────────────────────────────────────────────────────────

function shell(bodyHtml) {
  return `<!DOCTYPE html>
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
        ${bodyHtml}
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

function row(label, value) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#6b7280">${label}</td>
    <td style="padding:10px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;color:#18181b;text-align:right;font-weight:500">${value}</td>
  </tr>`;
}

async function send(label, payload) {
  process.stdout.write(`Sending [${label}] to ${payload.to} … `);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log(`✅  id: ${body.id}`);
  } else {
    console.log(`❌  ${res.status}:`, body);
  }
}

// ── 1. Payer receipt ──────────────────────────────────────────────────────────
const payerName   = "Emeka Okonkwo";
const sessionName = "Mama Put Friday Lunch";
const amountKobo  = 350000;
const paymentRef  = "CPY-TEST12345678";
const naira       = `₦${Math.round(amountKobo / 100).toLocaleString("en-NG")}`;

await send("payer receipt", {
  from: FROM_PAYMENTS, reply_to: "support@usechop.xyz", to: TO,
  subject: `[TEST] Payment confirmed — ${sessionName}`,
  html: shell(`
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
  `),
  text: `Hi ${payerName},\n\nYour payment of ${naira} for "${sessionName}" was received.\n\nReference: ${paymentRef}\nDate: ${now}\n\nThanks for using Chop!\nsupport@usechop.xyz`,
});

// ── 2. Organizer payout ───────────────────────────────────────────────────────
const orgName      = "Adaeze Nwosu";
const payoutAmount = 1680000; // ₦16,800
const payoutNaira  = `₦${Math.round(payoutAmount / 100).toLocaleString("en-NG")}`;
const bankName     = "Guaranty Trust Bank";
const acct         = "0123456789";
const masked       = "•".repeat(acct.length - 4) + acct.slice(-4);
const payoutRef    = "CPO-TEST87654321";

await send("organizer payout", {
  from: FROM_PAYMENTS, reply_to: "support@usechop.xyz", to: TO,
  subject: `[TEST] ${payoutNaira} delivered — ${sessionName}`,
  html: shell(`
    <tr><td style="padding:24px 32px 4px">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Payout</p>
      <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#18181b">${sessionName}</h1>
    </td></tr>
    <tr><td style="padding:12px 32px 4px">
      <p style="margin:0;font-size:14px;color:#374151">Hi <strong>${orgName}</strong>, your payout has landed.</p>
    </td></tr>
    <tr><td style="padding:8px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Reference", payoutRef)}
        ${row("Bank", bankName)}
        ${row("Account", masked)}
        ${row("Date", now)}
        <tr>
          <td style="padding:14px 0 20px;font-size:15px;font-weight:700;color:#18181b">Amount received</td>
          <td style="padding:14px 0 20px;font-size:15px;font-weight:700;color:#00C950;text-align:right">${payoutNaira}</td>
        </tr>
      </table>
    </td></tr>
  `),
  text: `Hi ${orgName},\n\nYour payout of ${payoutNaira} for "${sessionName}" has been delivered to ${bankName} (${masked}).\n\nReference: ${payoutRef}\nDate: ${now}\n\nThanks for using Chop!\nsupport@usechop.xyz`,
});

// ── 3. Password reset OTP ─────────────────────────────────────────────────────
const token = "847291";

await send("password reset OTP", {
  from: FROM_NOREPLY, reply_to: "support@usechop.xyz", to: TO,
  subject: "[TEST] Your Chop password reset code",
  html: `<!DOCTYPE html>
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
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b">Password reset</h1>
          <p style="margin:0;font-size:14px;color:#6b7280">Use this code to reset your Chop password. It expires in <strong>15 minutes</strong>.</p>
        </td></tr>
        <tr><td style="padding:24px 32px">
          <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#18181b;background:#f4f4f5;border-radius:12px;padding:20px;text-align:center">
            ${token}
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 28px">
          <p style="margin:0;font-size:13px;color:#9ca3af">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
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
</html>`,
  text: `Your Chop password reset code is: ${token}\n\nExpires in 15 minutes.\n\nIf you didn't request this, ignore this email.`,
});

console.log(`\nDone — 3 emails sent to ${TO}. Check your inbox!`);
