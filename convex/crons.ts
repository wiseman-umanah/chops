import { cronJobs } from "convex/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ── Internal helpers ───────────────────────────────────────────────────────────

/** Finds pending participant rows older than `cutoff` ms with no paymentRef */
export const _findAbandonedPending = internalQuery({
  args: { cutoff: v.number() },
  handler: async (ctx, { cutoff }) => {
    // Collect all pending participants — no index on status, scan is acceptable
    // for a nightly cron with low frequency
    const all = await ctx.db
      .query("participants")
      .withIndex("by_session")
      .collect();
    return all.filter(
      (p) =>
        p.status === "pending" &&
        !p.paymentRef &&
        p._creationTime < cutoff
    );
  },
});

/** Deletes a single participant row by ID */
export const _deleteParticipant = internalMutation({
  args: { id: v.id("participants") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// ── Cleanup action ─────────────────────────────────────────────────────────────

/**
 * Deletes abandoned chop-in pending participant rows.
 *
 * Background: for chop-in sessions we insert a "pending" row before the user
 * is redirected to the Bachs checkout. If they abandon the payment, that row
 * stays in the DB forever. This cron runs nightly and removes any pending row
 * older than 24 hours that never received a paymentRef from the webhook.
 */
export const cleanupAbandonedParticipants = internalAction({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    const abandoned = await ctx.runQuery(
      internal.crons._findAbandonedPending,
      { cutoff }
    );

    console.log(
      `[cron] cleanupAbandonedParticipants: found ${abandoned.length} rows to delete`
    );

    for (const p of abandoned) {
      await ctx.runMutation(internal.crons._deleteParticipant, { id: p._id });
    }

    console.log(`[cron] cleanupAbandonedParticipants: done`);
  },
});

// ── Schedule ──────────────────────────────────────────────────────────────────

const crons = cronJobs();

// Every night at 2:00 AM UTC
crons.daily(
  "cleanup abandoned chop-in participants",
  { hourUTC: 2, minuteUTC: 0 },
  internal.crons.cleanupAbandonedParticipants,
  {}
);

export default crons;
