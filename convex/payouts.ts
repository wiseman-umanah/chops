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
        const chopFeeKobo = session.feePercent
          ? Math.round(collectedKobo * (session.feePercent / 100))
          : 0;
        // ₦50 flat Bachs bank transfer fee — deducted from payout so our wallet self-funds
        const bachsTransferFeeKobo = 5000;
        const feeKobo = chopFeeKobo + bachsTransferFeeKobo;
        return {
          ...session,
          collectedKobo,
          chopFeeKobo,
          bachsTransferFeeKobo,
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
 * Requires auth — prevents unauthenticated quota burn on the Bachs API.
 * Returns [{ name, code }] sorted by name.
 */
export const listBanks = action({
  args: {},
  handler: async (ctx): Promise<{ name: string; code: string }[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

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
 * Requires auth — prevents unauthenticated enumeration of bank accounts.
 */
export const resolveAccount = action({
  args: {
    accountNumber: v.string(),
    bankCode: v.string(),
  },
  handler: async (ctx, { accountNumber, bankCode }): Promise<{ accountName: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

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

    // ── Duplicate payout guard ────────────────────────────────────────────────
    // Prevents double-payout if the organizer double-clicks or the client retries.
    // The Idempotency-Key alone isn't sufficient because each retry would generate
    // a fresh reference and hit the Bachs API a second time.
    const existingPayouts: { status: string }[] = await ctx.runQuery(
      internal.payouts._getPayoutsBySession,
      { sessionId: args.sessionId }
    );
    const activePayouts = existingPayouts.filter(
      (p) => p.status === "pending" || p.status === "processing" || p.status === "completed"
    );
    if (activePayouts.length > 0) {
      throw new Error(
        "A payout for this session is already in progress or completed. Check your wallet."
      );
    }

    const collectedKobo = participants
      .filter((p) => p.status === "sent")
      .reduce((s, p) => s + p.amountOwed, 0);
    const chopFeeKobo = session.feePercent
      ? Math.round(collectedKobo * (session.feePercent / 100))
      : 0;
    // ₦50 flat Bachs bank transfer fee — deducted from payout so our wallet self-funds
    const bachsTransferFeeKobo = 5000;
    const payoutKobo = collectedKobo - chopFeeKobo - bachsTransferFeeKobo;
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
    // crypto.randomUUID() is available in Convex's V8 runtime (collision-safe)
    const reference = "CPO-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

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

    // Only treat as sandbox when BACHS_ENV is explicitly "sandbox" or "development".
    // Leaving BACHS_ENV unset in production previously triggered the bypass silently.
    const isSandbox = process.env.BACHS_ENV === "sandbox" || process.env.BACHS_ENV === "development";

    let bachsPayoutId: string;

    if (!payoutRes.ok) {
      const errBody = await payoutRes.json().catch(() => ({ error_code: "UNKNOWN" })) as {
        error_code?: string;
        detail?: string;
      };

      // In sandbox, Bachs never credits collected payments to the balance,
      // so INSUFFICIENT_BALANCE is expected. Simulate success so the full
      // UI flow can be tested without a real funded balance.
      if (isSandbox && errBody.error_code === "INSUFFICIENT_BALANCE") {
        console.log(
          `[sandbox] Bypassing INSUFFICIENT_BALANCE — simulating payout success. ` +
          `In production this requires a funded NGN balance.`
        );
        bachsPayoutId = `sandbox_simulated_${reference}`;
      } else {
        throw new Error(
          errBody.detail ??
          `Payout failed (${payoutRes.status})`
        );
      }
    } else {
      const payoutData = await payoutRes.json() as { id: string };
      bachsPayoutId = payoutData.id;
    }

    // ── 3. Insert payout record ──────────────────────────────────────────────
    const payoutDbId = await ctx.runMutation(internal.payouts.insertPayoutRecord, {
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

    // ── 4. Sandbox: simulate immediate payout.paid since no real webhook arrives ──
    if (isSandbox && bachsPayoutId.startsWith("sandbox_simulated_")) {
      await ctx.runMutation(internal.payouts.updatePayoutStatus, {
        payoutId: payoutDbId,
        status: "completed",
      });
      await ctx.runMutation(internal.sessions.setSessionStatus, {
        sessionId: args.sessionId,
        status: "inactive",
      });
      const naira = Math.round(payoutKobo / 100).toLocaleString("en-NG");
      const masked = "•".repeat(args.accountNumber.length - 4) + args.accountNumber.slice(-4);
      await ctx.runMutation(internal.notifications.insertSystemNotification, {
        userId,
        type: "session_closed",
        title: `₦${naira} delivered to your bank`,
        body: `[Sandbox] Payout to ${args.bankName} (${masked}) simulated as delivered.`,
        sessionId: args.sessionId,
      });
    }

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

export const _getPayoutsBySession = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) =>
    ctx.db
      .query("payouts")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect(),
});
