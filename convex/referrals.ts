import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Code generation ────────────────────────────────────────────────────────────

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O to avoid confusion
const DIGITS  = "0123456789";

/**
 * Generates a memorable 6-char referral code: 4 letters + 2 digits.
 * e.g. "KNOX42", "AMKA07"
 */
function makeCode(): string {
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)]
  const letters = Array.from({ length: 4 }, () => pick(LETTERS)).join('')
  const digits  = Array.from({ length: 2 }, () => pick(DIGITS)).join('')
  return letters + digits
}

// ── Public queries ─────────────────────────────────────────────────────────────

/**
 * Returns the current user's referral code row, or null if not yet generated.
 * The frontend calls this to display the code — it triggers generation if missing.
 */
export const getMyReferralCode = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db
      .query("referralCodes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Validates a referral code without requiring auth.
 * Used by the signup page to check a code from the URL param before locking the field.
 * Returns { valid: true, referrerName } or { valid: false }.
 */
export const validateReferralCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    if (!code || code.length !== 6) return { valid: false };

    const row = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();

    if (!row) return { valid: false };

    const user = await ctx.db.get(row.userId as never);
    const referrerName = (user as { firstName?: string; name?: string } | null)
      ?.firstName ?? (user as { name?: string } | null)?.name ?? "Someone";

    return { valid: true, referrerName };
  },
});

/**
 * Returns the current user's referral stats:
 * - count of people they referred
 * - list of referred users (name + _creationTime) for display
 */
export const getMyReferralStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { count: 0, referred: [] };

    const rows = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", userId))
      .order("desc")
      .collect();

    const referred = await Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db.get(r.referredId as never) as {
          firstName?: string;
          name?: string;
          _creationTime: number;
        } | null;
        return {
          name: user?.firstName ?? user?.name ?? "Anonymous",
          joinedAt: user?._creationTime ?? 0,
        };
      })
    );

    return { count: rows.length, referred };
  },
});

// ── Mutations ──────────────────────────────────────────────────────────────────

/**
 * Lazily generates a referral code for the current user if they don't have one.
 * Idempotent — returns existing code if already generated.
 * Retries up to 5 times on collision (astronomically unlikely with 6-char codes).
 */
export const generateReferralCode = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Return existing code if already generated
    const existing = await ctx.db
      .query("referralCodes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing.code;

    // Generate a unique code (retry on collision)
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      const collision = await ctx.db
        .query("referralCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!collision) {
        await ctx.db.insert("referralCodes", { userId, code });
        return code;
      }
    }

    throw new Error("Could not generate a unique referral code. Please try again.");
  },
});

/**
 * Records a referral when a new user signs up using a referral code.
 * Called from the AuthPage after successful account creation.
 *
 * Guards:
 *  - code must exist in referralCodes
 *  - referred user must not have been referred before (no double-counting)
 *  - user cannot refer themselves
 */
export const recordReferral = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const referredId = await getAuthUserId(ctx);
    if (!referredId) throw new Error("Not authenticated");

    const codeRow = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();

    if (!codeRow) return; // invalid code — silently ignore

    const referrerId = codeRow.userId;
    if (referrerId === referredId) return; // cannot refer yourself

    // Idempotency — don't record the same referral twice
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", referredId))
      .first();
    if (existing) return;

    await ctx.db.insert("referrals", {
      referrerId,
      referredId,
      code: code.toUpperCase(),
    });
  },
});

/**
 * Internal version of recordReferral — used when we need to call it from
 * inside another mutation/action without auth context (e.g. post-signup hook).
 */
export const internalRecordReferral = internalMutation({
  args: { referredId: v.string(), code: v.string() },
  handler: async (ctx, { referredId, code }) => {
    const codeRow = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();

    if (!codeRow) return;

    const referrerId = codeRow.userId;
    if (referrerId === referredId) return;

    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", referredId))
      .first();
    if (existing) return;

    await ctx.db.insert("referrals", {
      referrerId,
      referredId,
      code: code.toUpperCase(),
    });
  },
});
