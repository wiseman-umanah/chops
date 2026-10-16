/**
 * Backfill scripts for referral codes.
 *
 * Run via CLI (dev):
 *   npx convex run convex/backfill_referrals:auditReferralCodes
 *   npx convex run convex/backfill_referrals:generateMissingCodes
 *   npx convex run convex/backfill_referrals:linkUserToRef '{"code":"KNOX42","email":"user@example.com"}'
 *   npx convex run convex/backfill_referrals:linkAllToRef '{"code":"EVFF24","excludeEmail":"wisemanumanah@gmail.com"}'
 *
 * Add --prod to target production:
 *   npx convex run convex/backfill_referrals:linkAllToRef '{"code":"EVFF24","excludeEmail":"wisemanumanah@gmail.com"}' --prod
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS  = "0123456789";

function makeCode(): string {
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  return (
    Array.from({ length: 4 }, () => pick(LETTERS)).join("") +
    Array.from({ length: 2 }, () => pick(DIGITS)).join("")
  );
}

/**
 * Generates a referral code for every user that doesn't have one.
 */
export const generateMissingCodes = mutation({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    let generated = 0;
    let skipped   = 0;

    for (const user of allUsers) {
      const existing = await ctx.db
        .query("referralCodes")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      if (existing) { skipped++; continue; }

      let inserted = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = makeCode();
        const collision = await ctx.db
          .query("referralCodes")
          .withIndex("by_code", (q) => q.eq("code", code))
          .first();
        if (!collision) {
          await ctx.db.insert("referralCodes", { userId: user._id, code });
          inserted = true;
          generated++;
          break;
        }
      }
      if (!inserted) console.warn(`Could not generate code for user ${user._id}`);
    }

    console.log(`Done. Generated: ${generated}, Already had code: ${skipped}`);
    return { generated, skipped };
  },
});

/**
 * Manually link one specific user (by email) to a referral code.
 */
export const linkUserToRef = mutation({
  args: {
    code:  v.string(),
    email: v.string(),
  },
  handler: async (ctx, { code, email }) => {
    const referredUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.toLowerCase()))
      .first();

    if (!referredUser) {
      console.error(`No user found with email: ${email}`);
      return { success: false, reason: "user_not_found" };
    }

    const codeRow = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();

    if (!codeRow) {
      console.error(`Referral code not found: ${code}`);
      return { success: false, reason: "code_not_found" };
    }

    const referrerId = codeRow.userId;
    const referredId = referredUser._id;

    if (referrerId === referredId) {
      console.warn("Referrer and referred are the same user — skipping");
      return { success: false, reason: "self_referral" };
    }

    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", referredId))
      .first();

    if (existing) {
      console.warn(`${email} already has a referral (code: ${existing.code})`);
      return { success: false, reason: "already_referred" };
    }

    await ctx.db.insert("referrals", { referrerId, referredId, code: code.toUpperCase() });
    console.log(`Linked ${email} → ${code.toUpperCase()}`);
    return { success: true };
  },
});

/**
 * Links ALL users to a referral code, skipping:
 *   - the code owner themselves (no self-referral)
 *   - any user already linked to any referral
 *   - the excluded email (e.g. the organizer's own account)
 *
 * Run:
 *   npx convex run convex/backfill_referrals:linkAllToRef '{"code":"EVFF24","excludeEmail":"wisemanumanah@gmail.com"}' --prod
 */
export const linkAllToRef = mutation({
  args: {
    code:         v.string(),
    excludeEmail: v.string(),
  },
  handler: async (ctx, { code, excludeEmail }) => {
    // Resolve the code to its owner
    const codeRow = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();

    if (!codeRow) {
      console.error(`Code "${code}" not found in referralCodes table`);
      return { linked: 0, skipped: 0, error: "code_not_found" };
    }

    const referrerId = codeRow.userId;
    console.log(`Code ${code.toUpperCase()} belongs to referrerId: ${referrerId}`);

    // Fetch all users and existing referrals
    const allUsers      = await ctx.db.query("users").collect();
    const allReferrals  = await ctx.db.query("referrals").collect();
    const alreadyLinked = new Set(allReferrals.map((r) => r.referredId));

    let linked  = 0;
    let skipped = 0;

    for (const user of allUsers) {
      const email = (user as { email?: string }).email ?? "";

      // Skip the excluded account
      if (email.toLowerCase() === excludeEmail.toLowerCase()) {
        console.log(`  Skipping excluded account: ${email}`);
        skipped++;
        continue;
      }

      // Skip the code owner (no self-referral)
      if (user._id === referrerId) {
        console.log(`  Skipping code owner: ${email || user._id}`);
        skipped++;
        continue;
      }

      // Skip anyone already linked to any referral
      if (alreadyLinked.has(user._id)) {
        console.log(`  Skipping already-linked: ${email || user._id}`);
        skipped++;
        continue;
      }

      await ctx.db.insert("referrals", {
        referrerId,
        referredId: user._id,
        code: code.toUpperCase(),
      });

      console.log(`  Linked: ${email || user._id}`);
      linked++;
    }

    console.log(`\nDone. Linked: ${linked}, Skipped: ${skipped}`);
    return { linked, skipped };
  },
});

/**
 * Read-only audit — shows how many users lack referral codes.
 */
export const auditReferralCodes = query({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    const allCodes = await ctx.db.query("referralCodes").collect();
    const allReferrals = await ctx.db.query("referrals").collect();
    const codeUserIds  = new Set(allCodes.map((c) => c.userId));
    const referredIds  = new Set(allReferrals.map((r) => r.referredId));

    const missingCodes    = allUsers.filter((u) => !codeUserIds.has(u._id));
    const missingReferral = allUsers.filter((u) => !referredIds.has(u._id));

    console.log(`Total users:              ${allUsers.length}`);
    console.log(`Users with referral codes: ${allCodes.length}`);
    console.log(`Users missing codes:       ${missingCodes.length}`);
    console.log(`Users with no referral:    ${missingReferral.length}`);

    allUsers.forEach((u) => {
      const email = (u as { email?: string }).email ?? (u as { name?: string }).name ?? u._id;
      const hasCode     = codeUserIds.has(u._id)  ? "✅ code"    : "❌ no code";
      const hasReferral = referredIds.has(u._id)   ? "✅ referred" : "—";
      console.log(`  ${email}  ${hasCode}  ${hasReferral}`);
    });

    return {
      totalUsers: allUsers.length,
      withCode: allCodes.length,
      missingCodeCount: missingCodes.length,
      missingReferralCount: missingReferral.length,
    };
  },
});
