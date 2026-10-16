import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Returns the current user's profile including image URL. */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    // Resolve storageId → public URL if image is a Convex storage ID
    let imageUrl: string | null = null;
    if (user.image) {
      // If it already looks like a URL (Google OAuth), use as-is
      if (user.image.startsWith("http")) {
        imageUrl = user.image;
      } else {
        // It's a Convex storageId — get the serving URL
        imageUrl = await ctx.storage.getUrl(user.image as string) ?? null;
      }
    }

    // Google OAuth only sets `name` (full name), not firstName/lastName.
    // Derive them so the Settings form is pre-filled correctly.
    // A password signup always sets firstName explicitly, so this only kicks in
    // when firstName is genuinely absent.
    let firstName = user.firstName;
    let lastName  = user.lastName;
    if (!firstName && user.name) {
      const parts = user.name.trim().split(/\s+/);
      firstName = parts[0];
      lastName  = parts.slice(1).join(" ") || undefined;
    }

    return { ...user, firstName, lastName, imageUrl };
  },
});

/** Generates a short-lived upload URL for the client to PUT a file to Convex Storage. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.storage.generateUploadUrl();
  },
});

/** Updates the user's profile picture (storageId) and/or name fields. */
export const updateProfile = mutation({
  args: {
    firstName:    v.optional(v.string()),
    lastName:     v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const patch: Record<string, string | undefined> = {};
    if (args.firstName !== undefined) patch.firstName = args.firstName.trim() || undefined;
    if (args.lastName  !== undefined) patch.lastName  = args.lastName.trim()  || undefined;
    if (args.imageStorageId !== undefined) patch.image = args.imageStorageId;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
    }
  },
});
