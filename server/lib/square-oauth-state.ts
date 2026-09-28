import { createHash, randomBytes } from "node:crypto";

export const SQUARE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Cookie carrying the raw browser-binding secret. Only its SHA-256 digest is
 * ever persisted server-side; the cookie is scoped to the callback path only,
 * with no Domain attribute, so it cannot be read or forwarded by another host.
 */
export const SQUARE_OAUTH_BROWSER_BINDING_COOKIE = "square_oauth_binding";
export const SQUARE_OAUTH_BROWSER_BINDING_COOKIE_PATH = "/api/payouts/square-callback";

function createRandomToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string | null {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** 256-bit CSPRNG OAuth state nonce. Independent of the browser-binding secret. */
export function createSquareOauthState(): string {
  return createRandomToken();
}

export function hashSquareOauthState(state: string): string | null {
  return hashToken(state);
}

/**
 * 256-bit CSPRNG secret that binds the OAuth transaction to the browser/session
 * that initiated it. It carries no user identity — it is only ever compared,
 * as a digest, against the record created at initiation.
 */
export function createSquareOauthBrowserBinding(): string {
  return createRandomToken();
}

export function hashSquareOauthBrowserBinding(binding: string): string | null {
  return hashToken(binding);
}

export function squareOauthBrowserBindingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: SQUARE_OAUTH_BROWSER_BINDING_COOKIE_PATH,
    maxAge: SQUARE_OAUTH_STATE_TTL_MS,
  };
}

export function createSquareOauthClaimId(): string {
  return randomBytes(32).toString("hex");
}
