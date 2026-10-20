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

/**
 * Fixes food session participants whose amountOwed was inflated by the Everyone-item
 * bug: Everyone items were stored at full line price per participant instead of
 * price/n. Recomputes amountOwed from each participant's items list.
 *
 * Only patches pending (unpaid) participants — paid rows are history.
 * Safe to run multiple times (idempotent via items-based recomputation).
 */
export const fixFoodAmountOwed = mutation({
  args: {},
  handler: async (ctx) => {
    const allSessions = await ctx.db.query("sessions").collect();
    const foodSessions = allSessions.filter((s) => s.mode === "food");

    let patched = 0;
    let skipped = 0;

    for (const session of foodSessions) {
      const participants = await ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      const n = participants.length;
      if (n === 0) continue;

      // Detect Everyone items: same (name, price) on ALL participants
      const freq: Record<string, number> = {};
      for (const p of participants) {
        for (const item of p.items ?? []) {
          const key = `${item.name}::${item.price}`;
          freq[key] = (freq[key] ?? 0) + 1;
        }
      }

      const taxTip = (session.taxKobo ?? 0) + (session.tipKobo ?? 0);
      const itemsSubtotal = session.totalAmount - taxTip;
      const taxTipRatio = itemsSubtotal > 0 ? taxTip / itemsSubtotal : 0;

      for (const p of participants) {
        if (p.status !== "pending") { skipped++; continue; }
        if (!p.items || p.items.length === 0) { skipped++; continue; }

        // For Everyone items, each participant's share is price/n
        const itemsTotal = p.items.reduce((s, item) => {
          const key = `${item.name}::${item.price}`;
          const isEveryone = n > 1 && freq[key] === n;
          return s + (isEveryone ? Math.round(item.price / n) : item.price);
        }, 0);
        const correctAmountOwed = Math.round(itemsTotal * (1 + taxTipRatio));

        if (correctAmountOwed === p.amountOwed) { skipped++; continue; }

        await ctx.db.patch(p._id, { amountOwed: correctAmountOwed });
        console.log(`Patched ${p.name}: ${p.amountOwed} → ${correctAmountOwed}`);
        patched++;
      }
    }

    return { patched, skipped };
  },
});
