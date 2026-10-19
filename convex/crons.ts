import { cronJobs } from "convex/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Finds abandoned chop-in pending participant rows older than `cutoff` ms.
 *
 * IMPORTANT: Only chop-in participants are eligible for cleanup.
 * Food/bill participants are created by the organizer and must never be
 * auto-deleted — a person who hasn't paid after 24 hours is still expected
 * to pay via the same link.
 * Chop-in participants are pre-inserted right before a Bachs redirect, so
 * a pending row with no paymentRef after 24 hours means the payer abandoned.
 */
export const _findAbandonedPending = internalQuery({
  args: { cutoff: v.number() },
  handler: async (ctx, { cutoff }) => {
    const all = await ctx.db
      .query("participants")
      .withIndex("by_session")
      .collect();

    // Filter to pending, no paymentRef, older than cutoff
    const candidates = all.filter(
      (p) =>
        p.status === "pending" &&
        !p.paymentRef &&
        p._creationTime < cutoff
    );

    // Only keep chop-in participants — must look up each session
    const results = [];
    for (const p of candidates) {
      const session = await ctx.db.get(p.sessionId);
      if (session?.mode === "chop-in") {
        results.push(p);
      }
    }
    return results;
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

// ── Orphaned authAccounts cleanup ─────────────────────────────────────────────

/**
 * Finds authAccounts rows whose linked users document no longer exists.
 * These orphans crash @convex-dev/auth on password reset / sign-in.
 */
export const _findOrphanedAuthAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("authAccounts").collect();
    const orphans: Id<"authAccounts">[] = [];
    for (const acc of accounts) {
      const user = await ctx.db.get(acc.userId);
      if (!user) orphans.push(acc._id);
    }
    return orphans;
  },
});

/** Deletes a single authAccounts row by ID */
export const _deleteAuthAccount = internalMutation({
  args: { id: v.id("authAccounts") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

/**
 * Deletes any authAccounts rows whose users document no longer exists.
 * Runs nightly so orphans from manual admin deletions never accumulate.
 */
export const cleanupOrphanedAuthAccounts = internalAction({
  args: {},
  handler: async (ctx) => {
    const orphans = await ctx.runQuery(
      internal.crons._findOrphanedAuthAccounts,
      {}
    );

    console.log(
      `[cron] cleanupOrphanedAuthAccounts: found ${orphans.length} orphaned rows`
    );

    for (const id of orphans) {
      await ctx.runMutation(internal.crons._deleteAuthAccount, { id });
    }

    console.log(`[cron] cleanupOrphanedAuthAccounts: done`);
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

// Every night at 2:05 AM UTC
crons.daily(
  "cleanup orphaned auth accounts",
  { hourUTC: 2, minuteUTC: 5 },
  internal.crons.cleanupOrphanedAuthAccounts,
  {}
);

export default crons;
