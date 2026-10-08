import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Generate a short URL-safe slug (10 chars) without external deps */
function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 10; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

// ── createSession ──────────────────────────────────────────────────────────

export const createSession = mutation({
  args: {
    mode: v.union(v.literal("food"), v.literal("chop-in"), v.literal("bill")),
    name: v.string(),
    totalAmount: v.number(),
    goalAmount: v.optional(v.number()),
    // Participants are passed as a generic array; validated per mode below
    participants: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { mode, name, totalAmount, goalAmount, participants } = args;

    // ── Validate per mode ──
    if (mode === "bill") {
      const total = (participants as { sharePercent: number }[]).reduce(
        (sum, p) => sum + p.sharePercent,
        0
      );
      if (Math.abs(total - 100) > 0.01) {
        throw new Error("Bill percentages must sum to 100");
      }
    }

    if (mode === "food") {
      const invalid = (participants as { items?: unknown[] }[]).some(
        (p) => !p.items || p.items.length === 0
      );
      if (invalid) throw new Error("Each participant must have at least one item");
    }

    if (mode === "chop-in" && !goalAmount) {
      throw new Error("goalAmount is required for Chop In sessions");
    }

    // ── Generate unique slug ──
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

    // ── Insert session ──
    const sessionId = await ctx.db.insert("sessions", {
      slug,
      mode,
      name,
      totalAmount,
      goalAmount,
      organizerId: userId,
      status: "active",
    });

    // ── Insert participants with computed amountOwed ──
    for (const p of participants) {
      let amountOwed = 0;

      if (mode === "food") {
        const fp = p as { name: string; items: { name: string; price: number }[] };
        amountOwed = fp.items.reduce((sum, item) => sum + item.price, 0);
        await ctx.db.insert("participants", {
          sessionId,
          name: fp.name,
          amountOwed,
          status: "pending",
          items: fp.items,
        });
      } else if (mode === "bill") {
        const bp = p as { name: string; sharePercent: number };
        amountOwed = Math.round(totalAmount * (bp.sharePercent / 100));
        await ctx.db.insert("participants", {
          sessionId,
          name: bp.name,
          amountOwed,
          status: "pending",
          sharePercent: bp.sharePercent,
        });
      } else {
        // chop-in
        const cp = p as { name: string; contributionAmount?: number };
        amountOwed = cp.contributionAmount ?? goalAmount ?? 0;
        await ctx.db.insert("participants", {
          sessionId,
          name: cp.name,
          amountOwed,
          status: "pending",
          contributionAmount: cp.contributionAmount,
        });
      }
    }

    return { sessionId, slug };
  },
});

// ── getSessionBySlug (public — no auth) ───────────────────────────────────

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

// ── getOrganizerSessions ───────────────────────────────────────────────────

export const getOrganizerSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_organizer", (q) => q.eq("organizerId", userId))
      .order("desc")
      .collect();

    // Attach participant counts and paid counts for dashboard cards
    return Promise.all(
      sessions.map(async (session) => {
        const participants = await ctx.db
          .query("participants")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        const paidCount = participants.filter((p) => p.status === "sent").length;
        return { ...session, participantCount: participants.length, paidCount };
      })
    );
  },
});

// ── closeSession ───────────────────────────────────────────────────────────

export const closeSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.organizerId !== userId) throw new Error("Not your session");

    await ctx.db.patch(sessionId, { status: "closed" });
  },
});
