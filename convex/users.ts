import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Returns the current organizer's user record including profile fields. */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db.get(userId);
  },
});
