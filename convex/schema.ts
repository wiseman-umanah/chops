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

  sessions: defineTable({
    slug: v.string(),
    mode: v.union(v.literal("food"), v.literal("chop-in"), v.literal("bill")),
    name: v.string(),
    /** Total session amount in kobo (integer, never float) */
    totalAmount: v.number(),
    /** Chop In only — per-person contribution target in kobo */
    goalAmount: v.optional(v.number()),
    organizerId: v.string(),
    status: v.union(v.literal("active"), v.literal("closed")),
  }).index("by_slug", ["slug"])
    .index("by_organizer", ["organizerId"]),

  participants: defineTable({
    sessionId: v.id("sessions"),
    name: v.string(),
    /** Amount this participant owes in kobo */
    amountOwed: v.number(),
    status: v.union(v.literal("pending"), v.literal("sent")),
    /** Chop Food only — line items */
    items: v.optional(v.array(v.object({ name: v.string(), price: v.number() }))),
    /** Chop Bill only — percentage share (0–100) */
    sharePercent: v.optional(v.number()),
    /** Chop In only — voluntary contribution amount in kobo */
    contributionAmount: v.optional(v.number()),
    /** Set by Bachs webhook after successful payment */
    paymentRef: v.optional(v.string()),
  }).index("by_session", ["sessionId"]),
});
