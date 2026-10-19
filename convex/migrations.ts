/**
 * One-time data migrations.
 *
 * Run via Convex dashboard or CLI:
 *   npx convex run convex/migrations:auditLegacySessions
 *   npx convex run convex/migrations:migrateUnpaidParticipants
 *
 * All mutations here are idempotent — safe to run multiple times.
 */

import { mutation, query } from "./_generated/server";

/**
 * Strips the old baked-in feePerParticipant from every PENDING participant
 * on food/bill sessions that were created before the fee overhaul.
 *
 * Before the overhaul, amountOwed = pureShare + feePerParticipant.
 * After the overhaul, amountOwed = pureShare (fee is added at checkout time).
 *
 * This must be run BEFORE deploying the new initiateCheckout logic to production,
 * otherwise those participants would be charged the old flat fee + the new 2% fee.
 *
 * Idempotency: participants whose session has no feePerParticipant are skipped.
 * Already-paid participants (status "sent") are untouched.
 */
export const migrateUnpaidParticipants = mutation({
  args: {},
  handler: async (ctx) => {
    // Find all sessions that have the old feePerParticipant field set
    const allSessions = await ctx.db.query("sessions").collect();
    const legacySessions = allSessions.filter(
      (s) => s.feePerParticipant != null && s.feePerParticipant > 0
    );

    let patched = 0;
    let skipped = 0;

    for (const session of legacySessions) {
      const fee = session.feePerParticipant!;

      const participants = await ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const p of participants) {
        // Only patch pending (unpaid) participants — paid ones are history
        if (p.status !== "pending") {
          skipped++;
          continue;
        }

        // Already migrated guard: if amountOwed would go negative or is already
        // less than the fee, something is off — skip and log
        if (p.amountOwed <= fee) {
          console.warn(
            `Skipping participant ${p._id}: amountOwed (${p.amountOwed}) <= fee (${fee})`
          );
          skipped++;
          continue;
        }

        await ctx.db.patch(p._id, {
          amountOwed: p.amountOwed - fee,
        });
        patched++;
      }
    }

    console.log(
      `Migration complete. Patched: ${patched} participants. Skipped: ${skipped}.`
    );
    return { patched, skipped, legacySessionCount: legacySessions.length };
  },
});

/**
 * Read-only audit — run this BEFORE migrateUnpaidParticipants to see
 * what will be changed.
 */
export const auditLegacySessions = query({
  args: {},
  handler: async (ctx) => {
    const allSessions = await ctx.db.query("sessions").collect();
    const legacySessions = allSessions.filter(
      (s) => s.feePerParticipant != null && s.feePerParticipant > 0
    );

    let pendingCount = 0;
    let paidCount = 0;

    for (const session of legacySessions) {
      const participants = await ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      pendingCount += participants.filter((p) => p.status === "pending").length;
      paidCount   += participants.filter((p) => p.status === "sent").length;
    }

    console.log(`Legacy sessions (with feePerParticipant): ${legacySessions.length}`);
    console.log(`  Pending (unpaid) participants to migrate: ${pendingCount}`);
    console.log(`  Already paid (untouched): ${paidCount}`);

    return { legacySessionCount: legacySessions.length, pendingCount, paidCount };
  },
});

/**
 * Deletes authAccounts rows whose linked users document no longer exists.
 * These orphans crash @convex-dev/auth when password reset or sign-in is
 * attempted for the affected email — the library finds the account row but
 * then tries to patch a non-existent users doc.
 *
 * Safe to run multiple times (idempotent).
 */
export const cleanupOrphanedAuthAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("authAccounts").collect();
    let deleted = 0;

    for (const acc of accounts) {
      const user = await ctx.db.get(acc.userId);
      if (!user) {
        await ctx.db.delete(acc._id);
        deleted++;
        console.log(`Deleted orphaned authAccount ${acc._id} (provider: ${acc.provider}, providerAccountId: ${acc.providerAccountId})`);
      }
    }

    console.log(`cleanupOrphanedAuthAccounts: deleted ${deleted} orphaned rows.`);
    return { deleted };
  },
});
