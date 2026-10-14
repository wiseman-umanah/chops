/**
 * Backfill script — two jobs in one:
 *
 * 1. GENERATE MISSING REFERRAL CODES
 *    Every user in the `users` table that doesn't have a row in `referralCodes`
 *    gets one generated now. Safe to run multiple times (idempotent).
 *
 * 2. LINK EXISTING USER TO A REFERRAL CODE  (optional — pass --ref=CODE --user=EMAIL)
 *    Manually record a referral for a user who signed up before the system existed.
 *    Guards: code must exist, user must not already have a referral row.
 *
 * Usage:
 *   npx convex run scripts/backfill-referrals:generateMissingCodes
 *   npx convex run scripts/backfill-referrals:linkUserToRef --ref=KNOX42 --user=someone@example.com
 *
 * Or run via the Convex dashboard → Functions → run.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

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
 * Run this once after deploying the referral system.
 */
export const generateMissingCodes = internalMutation({
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

      if (existing) {
        skipped++;
        continue;
      }

      // Retry up to 5 times on collision
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

      if (!inserted) {
        console.warn(`Could not generate unique code for user ${user._id} after 5 attempts`);
      }
    }

    console.log(`Done. Generated: ${generated}, Already had code: ${skipped}`);
    return { generated, skipped };
  },
});

/**
 * Manually link a user to a referral code.
 * Use this for users who signed up via a referral link before the system tracked it.
 *
 * Args:
 *   code  — the referral code (e.g. "KNOX42")
 *   email — the referred user's email address
 */
export const linkUserToRef = internalMutation({
  args: {
    code:  v.string(),
    email: v.string(),
  },
  handler: async (ctx, { code, email }) => {
    // Find the referred user by email
    const referredUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.toLowerCase()))
      .first();

    if (!referredUser) {
      console.error(`No user found with email: ${email}`);
      return { success: false, reason: "user_not_found" };
    }

    const referredId = referredUser._id;

    // Find the referral code
    const codeRow = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();

    if (!codeRow) {
      console.error(`Referral code not found: ${code}`);
      return { success: false, reason: "code_not_found" };
    }

    const referrerId = codeRow.userId;

    if (referrerId === referredId) {
      console.warn("Referrer and referred are the same user — skipping");
      return { success: false, reason: "self_referral" };
    }

    // Check if already recorded
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", referredId))
      .first();

    if (existing) {
      console.warn(`User ${email} already has a referral recorded (code: ${existing.code})`);
      return { success: false, reason: "already_referred" };
    }

    await ctx.db.insert("referrals", {
      referrerId,
      referredId,
      code: code.toUpperCase(),
    });

    console.log(`Linked ${email} → code ${code.toUpperCase()} (referrer: ${referrerId})`);
    return { success: true };
  },
});

/**
 * Read-only helper — check the current state before running the backfill.
 * Shows how many users lack referral codes.
 */
export const auditReferralCodes = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    const allCodes = await ctx.db.query("referralCodes").collect();
    const codeUserIds = new Set(allCodes.map((c) => c.userId));

    const missing = allUsers.filter((u) => !codeUserIds.has(u._id));

    console.log(`Total users: ${allUsers.length}`);
    console.log(`Users with codes: ${allCodes.length}`);
    console.log(`Users missing codes: ${missing.length}`);
    missing.forEach((u) => {
      const display = (u as { email?: string; firstName?: string }).email
        ?? (u as { firstName?: string }).firstName
        ?? u._id;
      console.log(`  - ${display}`);
    });

    return {
      totalUsers: allUsers.length,
      withCode: allCodes.length,
      missingCount: missing.length,
    };
  },
});
