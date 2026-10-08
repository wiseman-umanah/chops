import { convexAuth, type GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { type GenericDataModel } from "convex/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password({
      profile(params, _ctx: GenericActionCtxWithAuthConfig<GenericDataModel>) {
        // Extra fields passed from the signup form are available in params
        return {
          email: params.email as string,
          // Store name fields directly on the users table row
          firstName: (params.firstName as string | undefined) ?? "",
          lastName: (params.lastName as string | undefined) ?? "",
          phone: (params.phone as string | undefined) ?? "",
        };
      },
    }),
  ],
});
