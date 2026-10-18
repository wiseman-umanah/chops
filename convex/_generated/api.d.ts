/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as backfill_referrals from "../backfill_referrals.js";
import type * as crons from "../crons.js";
import type * as emailVerification from "../emailVerification.js";
import type * as fees from "../fees.js";
import type * as http from "../http.js";
import type * as http_actions from "../http_actions.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as participants from "../participants.js";
import type * as payments from "../payments.js";
import type * as payouts from "../payouts.js";
import type * as referrals from "../referrals.js";
import type * as sessions from "../sessions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  backfill_referrals: typeof backfill_referrals;
  crons: typeof crons;
  emailVerification: typeof emailVerification;
  fees: typeof fees;
  http: typeof http;
  http_actions: typeof http_actions;
  migrations: typeof migrations;
  notifications: typeof notifications;
  participants: typeof participants;
  payments: typeof payments;
  payouts: typeof payouts;
  referrals: typeof referrals;
  sessions: typeof sessions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
