import "../lib/load-env";

import type { SquareClient } from "square";
import { createConnectedSquareClient, squareEnvironmentConfigured } from "./square-integration";

function cleanedEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const squareConfig = {
  accessToken: cleanedEnv("SQUARE_ACCESS_TOKEN"),
  applicationId: cleanedEnv("SQUARE_APPLICATION_ID"),
  locationId: cleanedEnv("SQUARE_LOCATION_ID"),
  webhookSignatureKey: cleanedEnv("SQUARE_WEBHOOK_SIGNATURE_KEY"),
  currency: cleanedEnv("SQUARE_CURRENCY") || "USD",
};

export function getSquareConfigError(): string | null {
  // The environment is resolved by the shared policy at USE time (never cached at import): missing, invalid or unsafe means not configured.
  if (!squareEnvironmentConfigured()) return "Square environment is not safely configured (see SQUARE_ENV).";
  if (!squareConfig.accessToken) return "Missing SQUARE_ACCESS_TOKEN.";
  if (!squareConfig.locationId) return "Missing SQUARE_LOCATION_ID.";
  return null;
}

export function isSquareConfigured(): boolean {
  return !getSquareConfigError();
}

export function getSquareClient(): SquareClient {
  const configError = getSquareConfigError();
  if (configError) {
    throw new Error(`${configError} Set the required Square environment variables before using premium drink collection checkout.`);
  }

  // The shared factory applies the one environment policy (and a request timeout); this module never picks an environment itself.
  return createConnectedSquareClient(squareConfig.accessToken!);
}

export function requireWebhookKey() {
  if (!squareEnvironmentConfigured()) throw new Error("Square environment is not safely configured (see SQUARE_ENV).");
  if (!squareConfig.webhookSignatureKey) {
    throw new Error("Missing SQUARE_WEBHOOK_SIGNATURE_KEY. Add it before enabling Square webhooks.");
  }
  return squareConfig.webhookSignatureKey;
}
