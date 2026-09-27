import { createHash, randomBytes } from "node:crypto";

export const SQUARE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createSquareOauthState(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSquareOauthState(state: string): string | null {
  if (!STATE_PATTERN.test(state)) return null;
  return createHash("sha256").update(state, "utf8").digest("hex");
}

export function createSquareOauthClaimId(): string {
  return randomBytes(32).toString("hex");
}

