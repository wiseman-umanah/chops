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
   *
   * STATUS LIFECYCLE
   *   active    — accepting payments
   *   closed    — all participants paid (food/bill) or goal reached (chop-in); pending payout
   *   inactive  — payout has been sent to the organizer's bank account
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
    /**
     * active   — live, accepting payments
     * closed   — fully paid, awaiting organizer payout (shown as "Completed" in UI)
     * inactive — payout sent (shown as "Inactive" in UI)
     */
    status: v.union(v.literal("active"), v.literal("closed"), v.literal("inactive")),
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

  /**
   * In-app notifications for session organizers.
   *
   * type:
   *   "payment"  — a participant paid their share
   *   "session_closed" — all participants in a session have paid
   *
   * read — false until the user opens/clicks the notification
   */
  notifications: defineTable({
    /** The user who should receive this notification */
    userId: v.string(),
    type: v.union(v.literal("payment"), v.literal("session_closed")),
    /** Human-readable title, e.g. "Tolu paid ₦2,500" */
    title: v.string(),
    /** Optional body copy */
    body: v.optional(v.string()),
    /** The session this notification relates to */
    sessionId: v.optional(v.id("sessions")),
    /** The participant row this notification relates to (payment type) */
    participantId: v.optional(v.id("participants")),
    read: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"]),

  /**
   * Payout requests — when an organizer finalizes a completed chop.
   *
   * status:
   *   pending   — submitted, not yet processed
   *   processed — payment sent (demo: immediately on creation)
   */
  payouts: defineTable({
    sessionId: v.id("sessions"),
    organizerId: v.string(),
    /** Total amount to be paid out in kobo */
    amountKobo: v.number(),
    recipientName: v.string(),
    accountNumber: v.string(),
    bankName: v.string(),
    status: v.union(v.literal("pending"), v.literal("processed")),
    /** Demo reference */
    reference: v.string(),
  })
    .index("by_organizer", ["organizerId"])
    .index("by_session", ["sessionId"]),
});
