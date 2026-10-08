import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { bachsWebhook } from "./http_actions";

const http = httpRouter();

// Convex Auth requires these routes
auth.addHttpRoutes(http);

// Bachs payment webhook
http.route({
  path: "/bachs-webhook",
  method: "POST",
  handler: bachsWebhook,
});

export default http;
