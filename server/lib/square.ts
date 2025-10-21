// /httpdocs/server/lib/square.ts
import "../lib/load-env"; // keeps your existing env loader behavior

import { Client, Environment } from "square";

/**
 * Required env vars (set in Plesk → Node.js → Custom environment variables):
 * - SQUARE_ENV                  = "sandbox" | "production"
 * - SQUARE_ACCESS_TOKEN         = (your Square Access Token for that env)
 * - SQUARE_APPLICATION_ID       = (your Square Application ID for that env)
 * - SQUARE_LOCATION_ID          = (your Square Location ID)
 * - SQUARE_WEBHOOK_SIGNATURE_KEY= (for webhook verification; add when we wire webhooks)
 */

const SQUARE_ENV = (process.env.SQUARE_ENV || "sandbox").toLowerCase();
const isSandbox = SQUARE_ENV !== "production";

const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN?.trim();
const APPLICATION_ID = process.env.SQUARE_APPLICATION_ID?.trim();
const LOCATION_ID = process.env.SQUARE_LOCATION_ID?.trim();
const WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim(); // optional until we add webhooks

if (!ACCESS_TOKEN) {
  throw new Error(
    "Missing SQUARE_ACCESS_TOKEN. Set it in Plesk → Node.js → Custom environment variables."
  );
}
if (!APPLICATION_ID) {
  throw new Error(
    "Missing SQUARE_APPLICATION_ID. Set it in Plesk → Node.js → Custom environment variables."
  );
}
if (!LOCATION_ID) {
  throw new Error(
    "Missing SQUARE_LOCATION_ID. Set it in Plesk → Node.js → Custom environment variables."
  );
}

export const squareClient = new Client({
  environment: isSandbox ? Environment.Sandbox : Environment.Production,
  accessToken: ACCESS_TOKEN,
});

export const squareConfig = {
  isSandbox,
  applicationId: APPLICATION_ID,
  locationId: LOCATION_ID,
  webhookSignatureKey: WEBHOOK_SIGNATURE_KEY, // may be undefined until you add it
};

/**
 * Small helper so routes can assert we have the webhook key when needed.
 */
export function requireWebhookKey() {
  if (!squareConfig.webhookSignatureKey) {
    throw new Error(
      "Missing SQUARE_WEBHOOK_SIGNATURE_KEY. Add it before enabling webhooks."
    );
  }
  return squareConfig.webhookSignatureKey;
}
