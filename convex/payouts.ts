import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

const BACHS_API_BASE =
  process.env.BACHS_ENV === "production"
    ? "https://api.bachs.io/v1"
    : "https://sandbox-api.bachs.io/v1";

// ── Public queries ─────────────────────────────────────────────────────────────

/**
 * Returns all payouts for the current user, newest first.
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

// ── Internal helpers (called from actions + webhooks) ─────────────────────────

export const findPayoutByBachsId = internalQuery({
  args: { bachsPayoutId: v.string() },
  handler: async (ctx, { bachsPayoutId }) => {
    return ctx.db
      .query("payouts")
      .withIndex("by_bachs_payout", (q) => q.eq("bachsPayoutId", bachsPayoutId))
      .unique();
  },
});

export const updatePayoutStatus = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, { payoutId, status, failureReason }) => {
    await ctx.db.patch(payoutId, {
      status,
      ...(failureReason !== undefined ? { failureReason } : {}),
    });
  },
});

export const insertPayoutRecord = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    organizerId: v.string(),
    amountKobo: v.number(),
    recipientName: v.string(),
    accountNumber: v.string(),
    bankName: v.string(),
    bankCode: v.string(),
    destinationId: v.string(),
    bachsPayoutId: v.string(),
    reference: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("payouts", {
      ...args,
      status: "processing",
    });
  },
});

// ── Public actions ─────────────────────────────────────────────────────────────

/**
 * Fetches the list of Nigerian banks from Bachs.
 * Returns [{ name, code }] sorted by name.
 */
export const listBanks = action({
  args: {},
  handler: async (): Promise<{ name: string; code: string }[]> => {
    const secretKey = process.env.BACHS_SECRET_KEY;
    if (!secretKey) throw new Error("BACHS_SECRET_KEY not configured");

    const res = await fetch(`${BACHS_API_BASE}/reference/banks?country=NG`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) throw new Error(`Bachs banks API error ${res.status}`);

    const data = await res.json() as {
      banks: { name: string; code: string }[]
    };

    return (data.banks ?? [])
      .map((b) => ({ name: b.name, code: b.code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Resolves a Nigerian bank account number to the account holder's name.
 * Called client-side when the user finishes typing 10 digits.
 */
export const resolveAccount = action({
  args: {
    accountNumber: v.string(),
    bankCode: v.string(),
  },
  handler: async (_ctx, { accountNumber, bankCode }): Promise<{ accountName: string }> => {
    const secretKey = process.env.BACHS_SECRET_KEY;
    if (!secretKey) throw new Error("BACHS_SECRET_KEY not configured");

    const res = await fetch(`${BACHS_API_BASE}/misc/bank-accounts/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        res.status === 422 ? "Account not found. Check the number and bank." :
        `Could not verify account (${res.status}${text ? ": " + text : ""})`
      );
    }

    const data = await res.json() as { account_name: string; resolved: boolean };
    if (!data.resolved || !data.account_name) {
      throw new Error("Account not found. Check the number and bank.");
    }
    return { accountName: data.account_name };
  },
});

/**
 * Registers a payout destination with Bachs, then initiates the payout.
 * The recipient name is resolved by Bachs — never supplied by the user.
 *
 * Flow:
 *   1. POST /v1/payouts/destinations  → get pd_... + resolved account_name
 *   2. POST /v1/payouts               → get pay_...
 *   3. Insert payouts row (status: "processing")
 *   4. Session stays "closed" until payout.paid webhook flips it to "inactive"
 */
export const requestPayout = action({
  args: {
    sessionId: v.id("sessions"),
    accountNumber: v.string(),
    bankCode: v.string(),
    bankName: v.string(),
  },
  handler: async (ctx, args) => {
    const secretKey = process.env.BACHS_SECRET_KEY;
    if (!secretKey) throw new Error("BACHS_SECRET_KEY not configured");

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // ── Compute payout amount ────────────────────────────────────────────────
    const participants: { status: string; amountOwed: number }[] =
      await ctx.runQuery(internal.payouts._getSessionParticipants, {
        sessionId: args.sessionId,
      });

    const session: {
      organizerId: string;
      status: string;
      feePercent?: number;
    } | null = await ctx.runQuery(internal.payouts._getSession, {
      sessionId: args.sessionId,
    });

    if (!session) throw new Error("Session not found");
    if (session.organizerId !== userId) throw new Error("Not your session");
    if (session.status !== "closed") throw new Error("Session must be completed before payout");

    const collectedKobo = participants
      .filter((p) => p.status === "sent")
      .reduce((s, p) => s + p.amountOwed, 0);
    const feeKobo = session.feePercent
      ? Math.round(collectedKobo * (session.feePercent / 100))
      : 0;
    const payoutKobo = collectedKobo - feeKobo;
    // Bachs wants decimal string at currency precision
    const amountStr = (payoutKobo / 100).toFixed(2);

    // ── 1. Register payout destination ───────────────────────────────────────
    const destRes = await fetch(`${BACHS_API_BASE}/payouts/destinations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        type: "bank_account",
        currency: "NGN",
        bank_code: args.bankCode,
        account_number: args.accountNumber,
      }),
    });

    if (!destRes.ok) {
      const errText = await destRes.text().catch(() => "");
      throw new Error(`Failed to register bank account (${destRes.status}${errText ? ": " + errText : ""})`);
    }

    const destData = await destRes.json() as {
      id: string;
      account_name: string;
      is_usable: boolean;
    };
    const destinationId = destData.id;
    const resolvedName = destData.account_name;

    // ── 2. Initiate payout ───────────────────────────────────────────────────
    const reference = "CPO-" + Math.random().toString(36).slice(2, 10).toUpperCase();

    const payoutRes = await fetch(`${BACHS_API_BASE}/payouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`,
        "Idempotency-Key": reference,
      },
      body: JSON.stringify({
        destination: destinationId,
        amount: amountStr,
        reference,
      }),
    });

    if (!payoutRes.ok) {
      const errText = await payoutRes.text().catch(() => "");
      throw new Error(`Payout failed (${payoutRes.status}${errText ? ": " + errText : ""})`);
    }

    const payoutData = await payoutRes.json() as { id: string };
    const bachsPayoutId = payoutData.id;

    // ── 3. Insert payout record ──────────────────────────────────────────────
    await ctx.runMutation(internal.payouts.insertPayoutRecord, {
      sessionId: args.sessionId,
      organizerId: userId,
      amountKobo: payoutKobo,
      recipientName: resolvedName,
      accountNumber: args.accountNumber,
      bankName: args.bankName,
      bankCode: args.bankCode,
      destinationId,
      bachsPayoutId,
      reference,
    });

    return { reference, bachsPayoutId, resolvedName };
  },
});

// ── Internal session helpers (used inside action, same file) ──────────────────

export const _getSession = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => ctx.db.get(sessionId),
});

export const _getSessionParticipants = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) =>
    ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect(),
});
