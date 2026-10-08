import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  /** Extended users table — extra profile fields stored at sign-up time */
  users: defineTable({
    // Required by Convex Auth
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    // Extra fields from signup form
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  /**
   * A "chop" session.
   *
   * slug     — public identifier in URL, format: CH-XXXXXXXX (8 alphanum chars)
   * mode     — "food" | "chop-in" | "bill"
   * status   — "active" | "closed" (closed = all participants paid)
   *
   * MONEY FIELDS — all in kobo (integer, never float)
   *   totalAmount   — sum of all items (food/bill) or 0 (chop-in)
   *   goalAmount    — chop-in only: target fundraising amount
   *   taxKobo       — chop-food only: tax applied in kobo
   *   tipKobo       — chop-food only: tip applied in kobo
   *
   * FEE FIELDS — computed at creation, stored so they never drift
   *   feePerParticipant  — food/bill: flat fee added to each participant's amountOwed (kobo)
   *   feePercent         — chop-in: percentage fee charged on withdrawal (stored as integer 0-100, e.g. 10)
   *
   * BILL-SPECIFIC
   *   splitType — "equal" | "custom" | "percentage"
   */
  sessions: defineTable({
    slug: v.string(),
    mode: v.union(v.literal("food"), v.literal("chop-in"), v.literal("bill")),
    name: v.string(),
    totalAmount: v.number(),
    goalAmount: v.optional(v.number()),
    taxKobo: v.optional(v.number()),
    tipKobo: v.optional(v.number()),
    splitType: v.optional(
      v.union(v.literal("equal"), v.literal("custom"), v.literal("percentage"))
    ),
    organizerId: v.string(),
    status: v.union(v.literal("active"), v.literal("closed")),
    /** Flat fee in kobo added to each participant's owed amount (food/bill modes) */
    feePerParticipant: v.optional(v.number()),
    /** Percentage fee for chop-in, charged at withdrawal time (integer, e.g. 10 = 10%) */
    feePercent: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_organizer", ["organizerId"]),

  participants: defineTable({
    sessionId: v.id("sessions"),
    name: v.string(),
    /** Amount this participant owes in kobo (includes their share of the platform fee) */
    amountOwed: v.number(),
    status: v.union(v.literal("pending"), v.literal("sent")),
    /** Chop Food only — line items */
    items: v.optional(
      v.array(v.object({ name: v.string(), price: v.number() }))
    ),
    /** Chop Bill — percentage share (0–100). Used in "percentage" split type */
    sharePercent: v.optional(v.number()),
    /** Chop In only — voluntary contribution amount in kobo */
    contributionAmount: v.optional(v.number()),
    /** Set by Bachs webhook after successful payment */
    paymentRef: v.optional(v.string()),
  }).index("by_session", ["sessionId"]),
});
