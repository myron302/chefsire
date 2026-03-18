import "../lib/load-env";

import { SquareClient, SquareEnvironment } from "square";

const SQUARE_ENV = (process.env.SQUARE_ENV || "sandbox").trim().toLowerCase();
const isSandbox = SQUARE_ENV !== "production";

function cleanedEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const squareConfig = {
  isSandbox,
  environment: isSandbox ? SquareEnvironment.Sandbox : SquareEnvironment.Production,
  accessToken: cleanedEnv("SQUARE_ACCESS_TOKEN"),
  applicationId: cleanedEnv("SQUARE_APPLICATION_ID"),
  locationId: cleanedEnv("SQUARE_LOCATION_ID"),
  webhookSignatureKey: cleanedEnv("SQUARE_WEBHOOK_SIGNATURE_KEY"),
  currency: cleanedEnv("SQUARE_CURRENCY") || "USD",
};

export function getSquareConfigError(): string | null {
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

  return new SquareClient({
    token: squareConfig.accessToken!,
    environment: squareConfig.environment,
  });
}

export function requireWebhookKey() {
  if (!squareConfig.webhookSignatureKey) {
    throw new Error("Missing SQUARE_WEBHOOK_SIGNATURE_KEY. Add it before enabling Square webhooks.");
  }
  return squareConfig.webhookSignatureKey;
}
