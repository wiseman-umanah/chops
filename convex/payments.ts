import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";

// ── Constants ──────────────────────────────────────────────────────────────────

const BACHS_API_BASE =
  process.env.BACHS_ENV === "production"
    ? "https://api.bachs.io/v1"
    : "https://sandbox-api.bachs.io/v1";

// ── Pre-insert participant for chop-in ────────────────────────────────────────

/**
 * Inserts a pending participant row for a chop-in contributor BEFORE redirecting
 * to Bachs checkout. This gives us a stable participantId to embed in metadata.
 * If the user abandons payment, the row stays pending and is harmless.
 */
export const reserveChopInParticipant = mutation({
  args: {
    sessionId: v.id("sessions"),
    contributorName: v.string(),
    amountKobo: v.number(),
  },
  handler: async (ctx, { sessionId, contributorName, amountKobo }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.mode !== "chop-in") throw new Error("Only for chop-in sessions");

    const participantId = await ctx.db.insert("participants", {
      sessionId,
      name: contributorName || "Anonymous",
      amountOwed: amountKobo,
      status: "pending",
      contributionAmount: amountKobo,
    });

    return participantId;
  },
});

// ── Initiate Bachs checkout ────────────────────────────────────────────────────

/**
 * Server-side checkout initiation — the Bachs secret key never reaches the browser.
 *
 * Food/bill: receives an existing participantId; amount comes from participant.amountOwed.
 * Chop-in:   receives contributorName + amountKobo; pre-inserts a pending participant
 *            row first so the webhook has a stable participantId to act on.
 *
 * Returns { checkoutUrl } — redirect the user to this URL.
 */
export const initiateCheckout = action({
  args: {
    sessionId: v.id("sessions"),
    // Food/bill: ID of existing participant row
    participantId: v.optional(v.id("participants")),
    // Chop-in: contributor details
    contributorName: v.optional(v.string()),
    amountKobo: v.optional(v.number()),
    // Where Bachs sends the user after payment (?checkout_id= is appended by Bachs)
    successUrl: v.string(),
    cancelUrl: v.string(),
    // Optional payer email — used as customer identifier if provided
    payerEmail: v.optional(v.string()),
    payerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const secretKey = process.env.BACHS_SECRET_KEY;
    if (!secretKey) throw new Error("BACHS_SECRET_KEY is not configured");

    // ── Resolve participant and amount ──────────────────────────────────────

    let resolvedParticipantId: string;
    let amountKobo: number;
    let payerName: string;

    if (args.participantId) {
      // Food / bill — participant already exists
      const participant = await ctx.runQuery(
        api.participants.getParticipantById,
        { participantId: args.participantId }
      );
      if (!participant) throw new Error("Participant not found");
      if (participant.status === "sent") throw new Error("Already paid");
      resolvedParticipantId = args.participantId;
      amountKobo = participant.amountOwed;
      payerName = args.payerName ?? participant.name;
    } else {
      // Chop-in — pre-insert a pending participant row so the webhook has an ID
      if (!args.amountKobo || args.amountKobo <= 0) {
        throw new Error("amountKobo required for chop-in");
      }
      const newId = await ctx.runMutation(api.payments.reserveChopInParticipant, {
        sessionId: args.sessionId,
        contributorName: args.contributorName ?? "Anonymous",
        amountKobo: args.amountKobo,
      });
      resolvedParticipantId = newId;
      amountKobo = args.amountKobo;
      payerName = args.contributorName ?? "Anonymous";
    }

    // ── Convert kobo → NGN string (Bachs uses currency units, not subunits) ──
    // e.g. 75000 kobo → "750.00"
    const amountStr = (amountKobo / 100).toFixed(2);

    // ── Build Bachs request body ────────────────────────────────────────────
    // customer requires either email or customer_id — omit the field entirely
    // if we have neither (Bachs allows anonymous checkout with pricing-only sessions).
    const customer = args.payerEmail
      ? { email: args.payerEmail, name: payerName }
      : undefined;

    const requestBody: Record<string, unknown> = {
      pricing: {
        currency: "NGN",
        amount: amountStr,
      },
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      // Echoed back verbatim in webhook data.metadata
      metadata: {
        participantId: resolvedParticipantId,
        sessionId: args.sessionId,
      },
    };

    if (customer) requestBody.customer = customer;

    // ── Call Bachs API ─────────────────────────────────────────────────────

    const response = await fetch(`${BACHS_API_BASE}/checkout-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown error");
      throw new Error(`Bachs API error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as {
      checkout_id: string;
      checkout_url: string;
      status: string;
      reference?: string;
    };

    return {
      checkoutUrl: data.checkout_url,
      checkoutId: data.checkout_id,
      participantId: resolvedParticipantId,
    };
  },
});
