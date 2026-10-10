import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────────────────────
// Fee logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the flat fee per participant for Chop Food and Chop Bill.
 *
 * Tier table (total = sum of all items incl. tax + tip, in kobo):
 *   < ₦5,000  (500_000 kobo)  → ₦100  (10_000 kobo)
 *   < ₦10,000 (1_000_000)     → ₦150  (15_000 kobo)
 *   < ₦20,000 (2_000_000)     → ₦200  (20_000 kobo)
 *   < ₦50,000 (5_000_000)     → 0.75% of total (rounded to nearest kobo)
 *   ≥ ₦50,000                 → 0.5%  of total
 *
 * The fee is per-participant (each person pays it on top of their share).
 */
function computeFlatFeePerParticipant(
  totalKobo: number,
  participantCount: number
): number {
  if (participantCount === 0) return 0;

  let totalFee: number;
  if (totalKobo < 500_000) {
    totalFee = 10_000; // ₦100
  } else if (totalKobo < 1_000_000) {
    totalFee = 15_000; // ₦150
  } else if (totalKobo < 2_000_000) {
    totalFee = 20_000; // ₦200
  } else if (totalKobo < 5_000_000) {
    totalFee = Math.round(totalKobo * 0.0075); // 0.75%
  } else {
    totalFee = Math.round(totalKobo * 0.005); // 0.5%
  }

  return Math.round(totalFee / participantCount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a slug in the format CH-XXXXXXXX where X is a mix of
 * uppercase letters and digits (at least one of each in every segment).
 * Total visible length: 11 chars (CH- + 8 chars).
 */
function generateSlug(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O to avoid confusion
  const digits = "0123456789";
  const all = letters + digits;

  // Guarantee at least 2 letters and 2 digits in the 8-char body
  const parts: string[] = [];
  // pick 2 random letters
  parts.push(letters[Math.floor(Math.random() * letters.length)]);
  parts.push(letters[Math.floor(Math.random() * letters.length)]);
  // pick 2 random digits
  parts.push(digits[Math.floor(Math.random() * digits.length)]);
  parts.push(digits[Math.floor(Math.random() * digits.length)]);
  // fill remaining 4 from the full set
  for (let i = 0; i < 4; i++) {
    parts.push(all[Math.floor(Math.random() * all.length)]);
  }
  // shuffle
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }

  return "CH-" + parts.join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// createSession
// ─────────────────────────────────────────────────────────────────────────────

export const createSession = mutation({
  args: {
    mode: v.union(v.literal("food"), v.literal("chop-in"), v.literal("bill")),
    name: v.string(),
    /** In kobo. For food/bill: grand total incl. tax+tip. For chop-in: goal amount. */
    totalAmount: v.number(),
    /** Chop In only — goal amount in kobo */
    goalAmount: v.optional(v.number()),
    /** Chop Food only — tax in kobo */
    taxKobo: v.optional(v.number()),
    /** Chop Food only — tip in kobo */
    tipKobo: v.optional(v.number()),
    /** Chop Bill only */
    splitType: v.optional(
      v.union(v.literal("equal"), v.literal("custom"), v.literal("percentage"))
    ),
    participants: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const {
      mode,
      name,
      totalAmount,
      goalAmount,
      taxKobo,
      tipKobo,
      splitType,
      participants,
    } = args;

    if (!name.trim()) throw new Error("Session title is required");
    // chop-in participants are added dynamically when contributors follow the link
    if (mode !== "chop-in" && participants.length === 0) {
      throw new Error("At least one participant is required");
    }

    // ── Mode-specific validation ──────────────────────────────────────────

    if (mode === "food") {
      const invalid = (participants as { items?: unknown[] }[]).some(
        (p) => !p.items || (p.items as unknown[]).length === 0
      );
      if (invalid) throw new Error("Each participant must have at least one menu item");
    }

    if (mode === "chop-in") {
      if (!goalAmount || goalAmount <= 0) {
        throw new Error("A positive goal amount is required for Chop In");
      }
    }

    if (mode === "bill") {
      if (!splitType) throw new Error("splitType is required for Chop Bill");

      if (splitType === "percentage") {
        const total = (participants as { sharePercent: number }[]).reduce(
          (sum, p) => sum + (p.sharePercent ?? 0),
          0
        );
        if (Math.abs(total - 100) > 0.01) {
          throw new Error("Percentages must add up to 100");
        }
      }

      if (splitType === "custom") {
        const sum = (participants as { amountOwed: number }[]).reduce(
          (s, p) => s + (p.amountOwed ?? 0),
          0
        );
        if (Math.abs(sum - totalAmount) > 1) {
          throw new Error("Custom amounts must add up to the total bill");
        }
      }
    }

    // ── Generate unique slug (auto-retry on collision) ────────────────────

    let slug = generateSlug();
    let existing = await ctx.db
      .query("sessions")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    while (existing) {
      slug = generateSlug();
      existing = await ctx.db
        .query("sessions")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
    }

    // ── Fee computation ───────────────────────────────────────────────────

    let feePerParticipant: number | undefined;
    let feePercent: number | undefined;

    if (mode === "food" || mode === "bill") {
      feePerParticipant = computeFlatFeePerParticipant(
        totalAmount,
        participants.length
      );
    } else {
      // chop-in: 10% charged at withdrawal, not on each participant
      feePercent = 10;
    }

    // ── Insert session ────────────────────────────────────────────────────

    const sessionId = await ctx.db.insert("sessions", {
      slug,
      mode,
      name: name.trim(),
      totalAmount,
      goalAmount: mode === "chop-in" ? goalAmount : undefined,
      taxKobo: mode === "food" ? (taxKobo ?? 0) : undefined,
      tipKobo: mode === "food" ? (tipKobo ?? 0) : undefined,
      splitType: mode === "bill" ? splitType : undefined,
      organizerId: userId,
      status: "active",
      feePerParticipant,
      feePercent,
    });

    // ── Insert participants ───────────────────────────────────────────────

    for (const p of participants) {
      if (mode === "food") {
        type FoodP = { name: string; items: { name: string; price: number }[] };
        const fp = p as FoodP;
        const itemsTotal = fp.items.reduce((s, item) => s + item.price, 0);
        // Denominator must be the items subtotal (gross minus tax+tip), not the gross total.
        // Using gross causes each participant's pro-rata tax to sum to less than the actual
        // tax+tip — the organizer collects less than the session total on every food split.
        const taxTip = (taxKobo ?? 0) + (tipKobo ?? 0);
        const itemsSubtotal = totalAmount - taxTip;
        const taxTipRatio = itemsSubtotal > 0 ? taxTip / itemsSubtotal : 0;
        const share = Math.round(itemsTotal * (1 + taxTipRatio));
        const amountOwed = share + (feePerParticipant ?? 0);
        await ctx.db.insert("participants", {
          sessionId,
          name: fp.name,
          amountOwed,
          status: "pending",
          items: fp.items,
        });
      } else if (mode === "bill") {
        type BillP = {
          name: string;
          sharePercent?: number;
          amountOwed?: number;
        };
        const bp = p as BillP;
        let base = 0;
        let sharePercent: number | undefined;

        if (splitType === "equal") {
          base = Math.round(totalAmount / participants.length);
        } else if (splitType === "percentage") {
          sharePercent = bp.sharePercent!;
          base = Math.round(totalAmount * (sharePercent / 100));
        } else {
          // custom — amountOwed already provided by caller in kobo
          base = bp.amountOwed ?? 0;
        }

        await ctx.db.insert("participants", {
          sessionId,
          name: bp.name,
          amountOwed: base + (feePerParticipant ?? 0),
          status: "pending",
          sharePercent,
        });
      } else {
        // chop-in — no pre-set amountOwed per participant; contributions are flexible
        type ChopInP = { name: string; contributionAmount?: number };
        const cp = p as ChopInP;
        await ctx.db.insert("participants", {
          sessionId,
          name: cp.name,
          amountOwed: cp.contributionAmount ?? goalAmount ?? 0,
          status: "pending",
          contributionAmount: cp.contributionAmount,
        });
      }
    }

    return { sessionId, slug };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// editSession — only allowed when NO participant has paid yet
// ─────────────────────────────────────────────────────────────────────────────

export const editSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    name: v.optional(v.string()),
    totalAmount: v.optional(v.number()),
    goalAmount: v.optional(v.number()),
    taxKobo: v.optional(v.number()),
    tipKobo: v.optional(v.number()),
    participants: v.optional(v.array(v.any())),
  },
  handler: async (ctx, { sessionId, name, totalAmount, goalAmount, taxKobo, tipKobo, participants }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.organizerId !== userId) throw new Error("Not your session");

    // Disallow edit if any payment has been made
    const paid = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .filter((q) => q.eq(q.field("status"), "sent"))
      .first();
    if (paid) throw new Error("Cannot edit a session that already has payments");

    const patch: Partial<typeof session> = {};
    if (name !== undefined) patch.name = name.trim();
    if (totalAmount !== undefined) patch.totalAmount = totalAmount;
    if (goalAmount !== undefined) patch.goalAmount = goalAmount;
    if (taxKobo !== undefined) patch.taxKobo = taxKobo;
    if (tipKobo !== undefined) patch.tipKobo = tipKobo;

    await ctx.db.patch(sessionId, patch);

    // If participants array is supplied, replace them entirely
    if (participants !== undefined) {
      const newTotal = totalAmount ?? session.totalAmount;
      const newTax   = taxKobo ?? session.taxKobo ?? 0;
      const newTip   = tipKobo ?? session.tipKobo ?? 0;
      const mode     = session.mode;

      // ── Same validations as createSession ──────────────────────────────────

      if (mode === "food") {
        const invalid = (participants as { items?: unknown[] }[]).some(
          (p) => !p.items || (p.items as unknown[]).length === 0
        );
        if (invalid) throw new Error("Each participant must have at least one menu item");
      }

      if (mode === "bill") {
        if (session.splitType === "percentage") {
          const pctTotal = (participants as { sharePercent: number }[]).reduce(
            (sum, p) => sum + (p.sharePercent ?? 0),
            0
          );
          if (Math.abs(pctTotal - 100) > 0.01) {
            throw new Error("Percentages must add up to 100");
          }
        }
        if (session.splitType === "custom") {
          const sum = (participants as { amountOwed: number }[]).reduce(
            (s, p) => s + (p.amountOwed ?? 0),
            0
          );
          if (Math.abs(sum - newTotal) > 1) {
            throw new Error("Custom amounts must add up to the total bill");
          }
        }
      }

      // ── Delete existing participants ─────────────────────────────────────────
      const existing = await ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();
      for (const ep of existing) {
        await ctx.db.delete(ep._id);
      }

      const newFee = computeFlatFeePerParticipant(newTotal, participants.length);
      await ctx.db.patch(sessionId, { feePerParticipant: newFee });

      for (const p of participants) {
        if (mode === "food") {
          type FoodP = { name: string; items: { name: string; price: number }[] };
          const fp = p as FoodP;
          const itemsTotal = fp.items.reduce((s: number, item: { price: number }) => s + item.price, 0);
          // Use itemsSubtotal (gross minus tax+tip) as denominator — same fix as createSession.
          const taxTip = newTax + newTip;
          const itemsSubtotal = newTotal - taxTip;
          const taxTipRatio = itemsSubtotal > 0 ? taxTip / itemsSubtotal : 0;
          const share = Math.round(itemsTotal * (1 + taxTipRatio));
          await ctx.db.insert("participants", {
            sessionId,
            name: fp.name,
            amountOwed: share + newFee,
            status: "pending",
            items: fp.items,
          });
        } else if (mode === "bill") {
          type BillP = { name: string; sharePercent?: number; amountOwed?: number };
          const bp = p as BillP;
          let base = 0;
          let sharePercent: number | undefined;
          if (session.splitType === "equal") {
            base = Math.round(newTotal / participants.length);
          } else if (session.splitType === "percentage") {
            sharePercent = bp.sharePercent!;
            base = Math.round(newTotal * (sharePercent / 100));
          } else {
            base = bp.amountOwed ?? 0;
          }
          await ctx.db.insert("participants", {
            sessionId,
            name: bp.name,
            amountOwed: base + newFee,
            status: "pending",
            sharePercent,
          });
        } else {
          type ChopInP = { name: string; contributionAmount?: number };
          const cp = p as ChopInP;
          await ctx.db.insert("participants", {
            sessionId,
            name: cp.name,
            amountOwed: cp.contributionAmount ?? goalAmount ?? session.goalAmount ?? 0,
            status: "pending",
            contributionAmount: cp.contributionAmount,
          });
        }
      }
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteSession — only allowed when NO payment has been made
// ─────────────────────────────────────────────────────────────────────────────

export const deleteSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.organizerId !== userId) throw new Error("Not your session");

    const paid = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .filter((q) => q.eq(q.field("status"), "sent"))
      .first();
    if (paid) throw new Error("Cannot delete a session that already has payments");

    // Delete all participants first, then the session
    const allParticipants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const p of allParticipants) {
      await ctx.db.delete(p._id);
    }
    await ctx.db.delete(sessionId);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// closeSession
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Closes a session. For chop-in sessions, also runs the fraud-detection
 * early-close check:
 *
 *   Suspicious = collected < 50% of goal AND at least 1 contributor paid
 *
 * Each suspicious close increments earlyCloseCount on the organizer.
 * At 5 strikes the account is set to "under_review" and their active sessions
 * stop accepting new payments.
 */
export const closeSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.organizerId !== userId) throw new Error("Not your session");

    await ctx.db.patch(sessionId, { status: "closed" });

    // ── Fraud detection (chop-in only) ──────────────────────────────────────
    if (session.mode === "chop-in") {
      const participants = await ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();

      const paidParticipants = participants.filter((p) => p.status === "sent");
      const collected = paidParticipants.reduce((s, p) => s + p.amountOwed, 0);
      const goal = session.goalAmount ?? session.totalAmount;

      // Suspicious: at least 1 paid contributor AND collected < 50% of goal
      const isSuspicious =
        paidParticipants.length > 0 &&
        goal > 0 &&
        collected / goal < 0.5;

      if (isSuspicious) {
        // userId is a Convex Id<"users"> — cast so we can read/patch the users table
        const organizerRow = await ctx.db.get(userId as Id<"users">);
        if (organizerRow) {
          const currentCount = (organizerRow.earlyCloseCount as number | undefined) ?? 0;
          const newCount = currentCount + 1;
          const currentStatus = (organizerRow.accountStatus as string | undefined) ?? "active";

          // Never downgrade a more severe status. Severity: active < under_review < suspended.
          // Only escalate to under_review when hitting 5 strikes AND not already at a worse level.
          const shouldEscalate =
            newCount >= 5 &&
            currentStatus !== "under_review" &&
            currentStatus !== "suspended";

          if (shouldEscalate) {
            await ctx.db.patch(userId as Id<"users">, {
              earlyCloseCount: newCount,
              accountStatus: "under_review" as const,
            });
          } else {
            // Increment counter only — leave accountStatus untouched
            await ctx.db.patch(userId as Id<"users">, {
              earlyCloseCount: newCount,
            });
          }

          console.log(
            `[fraud] User ${userId} early-close strike ${newCount}/5` +
              (shouldEscalate ? " — account set to under_review" : "")
          );
        }
      }
    }
  },
});

/**
 * Returns the accountStatus of a user by their Convex user ID.
 * Internal-only — called by initiateCheckout before creating a Bachs session.
 * Keeping this internal prevents external probing of user suspension status.
 */
export const getOrganizerStatus = internalQuery({
  args: { organizerId: v.string() },
  handler: async (ctx, { organizerId }) => {
    const user = await ctx.db.get(organizerId as Id<"users">);
    if (!user) return "active" as const;
    return ((user as { accountStatus?: string }).accountStatus ?? "active") as string;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// finalizeSession — called after payout is confirmed; marks session inactive
// ─────────────────────────────────────────────────────────────────────────────

export const finalizeSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.organizerId !== userId) throw new Error("Not your session");
    if (session.status !== "closed") throw new Error("Session is not in completed state");

    await ctx.db.patch(sessionId, { status: "inactive" });
  },
});

/** Internal — used by webhook handlers to transition session status. */
export const setSessionStatus = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    status: v.union(v.literal("active"), v.literal("closed"), v.literal("inactive")),
  },
  handler: async (ctx, { sessionId, status }) => {
    await ctx.db.patch(sessionId, { status });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// getSessionBySlug — public (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a single session by its Convex ID.
 * Internal-only — used by the webhook email action and initiateCheckout.
 */
export const getSessionById = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return ctx.db.get(sessionId);
  },
});

// ─────────────────────────────────────────────────────────────────────────────

export const getSessionBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (!session) return null;

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();

    return { ...session, participants };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// getOrganizerSessions — dashboard chop list
// ─────────────────────────────────────────────────────────────────────────────

export const getOrganizerSessions = query({
  args: {
    /** Filter by status. Omit to get all. */
    status: v.optional(
      v.union(v.literal("active"), v.literal("closed"), v.literal("inactive"))
    ),
  },
  handler: async (ctx, { status }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let sessions = await ctx.db
      .query("sessions")
      .withIndex("by_organizer", (q) => q.eq("organizerId", userId))
      .order("desc")
      .collect();

    if (status) {
      sessions = sessions.filter((s) => s.status === status);
    }

    return Promise.all(
      sessions.map(async (session) => {
        const participants = await ctx.db
          .query("participants")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        const fee = session.feePerParticipant ?? 0;
        const paidCount = participants.filter((p) => p.status === "sent").length;
        // Subtract the platform fee so amounts reflect what the organizer receives,
        // not the gross collected from payers (used in dashboard cards + payout modal).
        const paidAmount = participants
          .filter((p) => p.status === "sent")
          .reduce((s, p) => s + p.amountOwed - fee, 0);
        const pendingAmount = participants
          .filter((p) => p.status === "pending")
          .reduce((s, p) => s + p.amountOwed - fee, 0);
        // A session with 0 payments and status=active can be edited/deleted
        const canEdit = session.status === "active" && paidCount === 0;

        return {
          ...session,
          participantCount: participants.length,
          paidCount,
          paidAmount,
          pendingAmount,
          canEdit,
        };
      })
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// getSessionStats — aggregated dashboard stats
// ─────────────────────────────────────────────────────────────────────────────

export const getSessionStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { activeChops: 0, pendingKobo: 0, settledKobo: 0 };

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_organizer", (q) => q.eq("organizerId", userId))
      .collect();

    let activeChops = 0;
    let pendingKobo = 0;
    let settledKobo = 0;

    for (const session of sessions) {
      if (session.status === "active") activeChops++;

      const participants = await ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      const fee = session.feePerParticipant ?? 0;
      for (const p of participants) {
        if (p.status === "sent") {
          // Subtract the platform fee so settledKobo reflects what the organizer
          // actually receives, not the gross amount collected from payers.
          settledKobo += p.amountOwed - fee;
        } else {
          pendingKobo += p.amountOwed - fee;
        }
      }
    }

    return { activeChops, pendingKobo, settledKobo };
  },
});
