import "./load-env";

import { SquareClient, SquareEnvironment, SquareError, type BaseClientOptions } from "square";

/**
 * The one place ChefSire builds Square clients for provider-connected accounts.
 *
 * It uses ONLY the API that the installed `square` package (v43) really exports: `SquareClient`,
 * `SquareEnvironment` and `SquareError`, with resource clients named `oAuth`, `merchants`, `locations`, `payments`
 * and `refunds`. The legacy `Client` / `Environment` root exports and the `*Api` accessors no longer exist in v43,
 * which is why nothing in this module reaches for them. `server/lib/square-integration.contract.test.ts` imports the
 * real package and fails if that ever stops being true.
 *
 * Access tokens enter this module as arguments and are never logged, never put in an error message and never
 * returned to a caller outside the server.
 */

/** Which Square environment ChefSire is configured for. Mirrors `SQUARE_ENV` in `server/lib/square.ts`. */
export function squareEnvironmentName(): "production" | "sandbox" {
  return (process.env.SQUARE_ENV || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox";
}

export function squareApiEnvironment() {
  return squareEnvironmentName() === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
}

/** The OAuth authorize host is environment specific; the production host must never be used for a sandbox app. */
export function squareOauthAuthorizeUrl(): string {
  const host = squareEnvironmentName() === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  return `${host}/oauth2/authorize`;
}

/**
 * The scopes requested when a provider connects Square, and why each is there.
 *
 * Gate 0 itself needs only MERCHANT_PROFILE_READ (retrieve the merchant and list its locations). The future
 * Square-hosted checkout is created UNDER THE PROVIDER'S account with `checkout.paymentLinks.create`, which
 * creates an order and a payment link: ORDERS_WRITE and PAYMENTS_WRITE. Confirming a payment before crediting it
 * means reading it back with `payments.get` / `orders.get`: PAYMENTS_READ and ORDERS_READ. Requesting them now
 * means a provider connects once instead of being sent back through authorization when Catering payments land.
 *
 * Nothing else is requested: no customer, invoice, payout, bank-account, item or team scopes.
 */
export const SQUARE_CONNECTION_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "PAYMENTS_WRITE",
  "PAYMENTS_READ",
  "ORDERS_WRITE",
  "ORDERS_READ",
] as const;

export function squareOauthApplication(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.SQUARE_APPLICATION_ID?.trim();
  const clientSecret = process.env.SQUARE_APPLICATION_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Test seam only: lets a contract test point the REAL SDK at a local server to drive its request building and parsing. */
export type SquareSdkOptions = { fetcher?: BaseClientOptions["fetcher"]; baseUrl?: string };

const REQUEST_TIMEOUT_SECONDS = 15;

/** The platform's own Square client, authenticated with the platform access token. */
export function createPlatformSquareClient(options: SquareSdkOptions = {}): SquareClient {
  const token = process.env.SQUARE_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN not configured");
  return new SquareClient({ token, environment: squareApiEnvironment(), timeoutInSeconds: REQUEST_TIMEOUT_SECONDS, ...options });
}

/** A client that acts AS a connected provider. `accessToken` is the decrypted OAuth token; keep it server-side. */
export function createConnectedSquareClient(accessToken: string, options: SquareSdkOptions = {}): SquareClient {
  if (typeof accessToken !== "string" || accessToken.length === 0) throw new Error("A Square access token is required");
  return new SquareClient({ token: accessToken, environment: squareApiEnvironment(), timeoutInSeconds: REQUEST_TIMEOUT_SECONDS, ...options });
}

/** A client with no bearer token, for the OAuth endpoints that authenticate with the application secret instead. */
function createUnauthenticatedSquareClient(options: SquareSdkOptions = {}): SquareClient {
  return new SquareClient({ environment: squareApiEnvironment(), timeoutInSeconds: REQUEST_TIMEOUT_SECONDS, ...options });
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Failure classification
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * What a failed Square call MEANS for a stored provider connection. Only one of these may ever destroy credentials.
 *
 *  - `provider_credential_invalid`  Square answered, and the PROVIDER's own credential is no good: a revoked/expired/unknown
 *                                   access token, a refresh or authorization grant Square says is invalid, or a token that
 *                                   lacks scopes. This alone permits taking a connection out of service (and, in the service,
 *                                   only against the exact credential snapshot that failed).
 *  - `application_auth`             Square rejected CHEFSIRE'S OWN application credentials (wrong, stale or rotating
 *                                   application secret, unknown or disabled client). That says nothing about the provider's
 *                                   grant: stored credentials must be left exactly as they are and the fault reported as
 *                                   configuration.
 *  - `transient`                    A timeout, a network fault, a 5xx, a 408 or a rate limit. Nothing may change.
 *  - `unrecognized`                 Square answered with an error this classifier does not positively recognise. Fails closed:
 *                                   the call is treated as failed and nothing may change.
 *
 * HTTP status alone is never enough. The token endpoint answers 400/401/403 both for a bad application secret and for a
 * bad grant, so the error BODY decides, and anything that is not positively identified as a provider-grant failure is not
 * destructive. The signals below come from the SDK's real error structure: `SquareError.errors[]` entries carry
 * `category`/`code`/`detail`, and a body without an `errors` array (Square's OAuth endpoints can answer in the older
 * `{ type, message }` shape) is surfaced by the SDK as category `V1_ERROR` with `code` = the body's `type` and `detail` = its
 * `message`.
 */
export type SquareFailureClass = "provider_credential_invalid" | "application_auth" | "transient" | "unrecognized";

/** Which kind of call failed, because the same words mean different things on different surfaces. */
export type SquareFailureSurface =
  /** `oAuth.obtainToken`: authorization-code exchange or refresh. Authenticated by the APPLICATION secret. */
  | "token_grant"
  /** Any call made with a provider's bearer access token (merchant, token status, locations, payments). */
  | "bearer"
  /** `oAuth.revokeToken`. Authenticated by the APPLICATION secret. */
  | "revoke";

const APPLICATION_AUTH_CODES = new Set(["INVALID_CLIENT", "CLIENT_DISABLED"]);
const APPLICATION_AUTH_TEXT = /invalid[_ ]client|client[_ ]disabled|unauthorized[_ ]client|service[._]not[_]?authorized|not authorized|client authentication|client[_ ]secret|invalid (?:application|client)/i;
const PROVIDER_GRANT_CODES = new Set(["INVALID_GRANT", "ACCESS_TOKEN_REVOKED", "ACCESS_TOKEN_EXPIRED"]);
const PROVIDER_GRANT_TEXT = /invalid[_ ]grant|(?:invalid|revoked|expired|unknown)[_ ](?:refresh[_ ])?token|refresh[_ ]token[^.]*(?:invalid|revoked|expired)|authorization[_ ]code[^.]*(?:invalid|expired|used)/i;
const BEARER_INVALID_CODES = new Set(["UNAUTHORIZED", "ACCESS_TOKEN_EXPIRED", "ACCESS_TOKEN_REVOKED", "INSUFFICIENT_SCOPES"]);

export function classifySquareFailure(error: unknown, options: { surface?: SquareFailureSurface } = {}): SquareFailureClass {
  if (!(error instanceof SquareError)) return "transient";
  const surface = options.surface ?? "bearer";
  const status = error.statusCode;
  if (status === undefined || status >= 500 || status === 408 || status === 429) return "transient";
  const errors = Array.isArray(error.errors) ? error.errors : [];
  const codes = errors.map((item) => String(item.code ?? "").toUpperCase());
  const text = errors.map((item) => `${item.code ?? ""} ${item.detail ?? ""}`).join(" ");

  // Application authentication is decided FIRST: if ChefSire could not authenticate itself, Square said nothing about the grant.
  if (codes.some((code) => APPLICATION_AUTH_CODES.has(code)) || APPLICATION_AUTH_TEXT.test(text)) return "application_auth";

  if (surface === "bearer") {
    const authCategory = errors.some((item) => item.category === "AUTHENTICATION_ERROR");
    return status === 401 || authCategory || codes.some((code) => BEARER_INVALID_CODES.has(code)) ? "provider_credential_invalid" : "unrecognized";
  }
  // token_grant / revoke: only a body that positively says the grant/token is bad counts, and only on an auth-shaped status.
  if ((status === 400 || status === 401 || status === 403) && (codes.some((code) => PROVIDER_GRANT_CODES.has(code)) || PROVIDER_GRANT_TEXT.test(text))) {
    return "provider_credential_invalid";
  }
  return "unrecognized";
}

/** The HTTP status of a failure, for logging. Never the message or body, which can echo credentials. */
export function squareFailureStatus(error: unknown): number | null {
  return error instanceof SquareError && typeof error.statusCode === "number" ? error.statusCode : null;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * The provider API surface the connection service depends on
 * ------------------------------------------------------------------------------------------------------------- */

export type SquareTokenGrant = { accessToken: string; refreshToken: string | null; expiresAt: Date; merchantId: string | null };
export type SquareMerchantProfile = { id: string; businessName: string | null; mainLocationId: string | null };
export type SquareLocationFacts = {
  id: string;
  name: string | null;
  status: string | null;
  capabilities: string[];
  merchantId: string | null;
  currency: string | null;
  createdAt: string | null;
};
export type SquareTokenStatus = { scopes: string[]; merchantId: string | null; expiresAt: Date | null };

export interface SquareProviderApi {
  exchangeAuthorizationCode(code: string): Promise<SquareTokenGrant>;
  refreshAccessToken(refreshToken: string): Promise<SquareTokenGrant>;
  /** Revokes every token the application holds for the merchant that owns `accessToken`. */
  revokeAccessToken(accessToken: string): Promise<void>;
  retrieveTokenStatus(accessToken: string): Promise<SquareTokenStatus>;
  retrieveMerchant(accessToken: string): Promise<SquareMerchantProfile>;
  listLocations(accessToken: string): Promise<SquareLocationFacts[]>;
}

function grantFrom(response: { accessToken?: string; refreshToken?: string; expiresAt?: string; merchantId?: string }): SquareTokenGrant {
  const expiresAt = response.expiresAt ? new Date(response.expiresAt) : null;
  if (!response.accessToken || !expiresAt || Number.isNaN(expiresAt.getTime())) {
    throw new SquareProviderResponseError("Square returned an incomplete token grant.");
  }
  return { accessToken: response.accessToken, refreshToken: response.refreshToken || null, expiresAt, merchantId: response.merchantId || null };
}

/** Square answered a revoke call 2xx, but not with an explicit `success: true`. The revocation is UNCONFIRMED. */
export class SquareRevocationUnconfirmedError extends Error {
  constructor() {
    super("Square did not confirm the revocation.");
    this.name = "SquareRevocationUnconfirmedError";
  }
}

/** Square answered 2xx but with something this integration cannot rely on. Always treated as a failed attempt. */
export class SquareProviderResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SquareProviderResponseError";
  }
}

function requireApplication() {
  const application = squareOauthApplication();
  if (!application) throw new Error("Square OAuth application credentials are not configured");
  return application;
}

export function createSquareProviderApi(options: SquareSdkOptions = {}): SquareProviderApi {
  return {
    async exchangeAuthorizationCode(code) {
      const { clientId, clientSecret } = requireApplication();
      const response = await createUnauthenticatedSquareClient(options).oAuth.obtainToken({
        clientId, clientSecret, code, grantType: "authorization_code",
      }, { maxRetries: 0 });
      return grantFrom(response);
    },
    async refreshAccessToken(refreshToken) {
      const { clientId, clientSecret } = requireApplication();
      const response = await createUnauthenticatedSquareClient(options).oAuth.obtainToken({
        clientId, clientSecret, refreshToken, grantType: "refresh_token",
      }, { maxRetries: 0 });
      return grantFrom(response);
    },
    async revokeAccessToken(accessToken) {
      const { clientId, clientSecret } = requireApplication();
      // RevokeToken authenticates with the application secret, not with a bearer token.
      const response = await createUnauthenticatedSquareClient(options).oAuth.revokeToken(
        { clientId, accessToken },
        { maxRetries: 0, headers: { Authorization: `Client ${clientSecret}` } },
      );
      // A 2xx is not proof of revocation. Only an explicit `success: true` with no response-level errors confirms it; a missing or
      // false `success`, or any `errors`, is UNCONFIRMED and must be reported as such.
      if (response.success !== true || (Array.isArray(response.errors) && response.errors.length > 0)) throw new SquareRevocationUnconfirmedError();
    },
    async retrieveTokenStatus(accessToken) {
      const response = await createConnectedSquareClient(accessToken, options).oAuth.retrieveTokenStatus();
      const expiresAt = response.expiresAt ? new Date(response.expiresAt) : null;
      return {
        scopes: Array.isArray(response.scopes) ? response.scopes.map(String) : [],
        merchantId: response.merchantId || null,
        expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      };
    },
    async retrieveMerchant(accessToken) {
      const response = await createConnectedSquareClient(accessToken, options).merchants.get({ merchantId: "me" });
      const merchant = response.merchant;
      if (!merchant?.id) throw new SquareProviderResponseError("Square returned no merchant profile.");
      return { id: merchant.id, businessName: merchant.businessName ?? null, mainLocationId: merchant.mainLocationId ?? null };
    },
    async listLocations(accessToken) {
      const response = await createConnectedSquareClient(accessToken, options).locations.list();
      return (response.locations ?? []).filter((location) => Boolean(location.id)).map((location) => ({
        id: location.id!,
        name: location.name ?? location.businessName ?? null,
        status: location.status ?? null,
        capabilities: (location.capabilities ?? []).map(String),
        merchantId: location.merchantId ?? null,
        currency: location.currency ?? null,
        createdAt: location.createdAt ?? null,
      }));
    },
  };
}

export const squareProviderApi: SquareProviderApi = createSquareProviderApi();

/* ------------------------------------------------------------------------------------------------------------- *
 * Location eligibility
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * A location can take card payments only if Square says it is ACTIVE, advertises CREDIT_CARD_PROCESSING, and
 * belongs to the merchant that was authorized. Nothing about a location is assumed from the merchant profile.
 */
export function isPaymentEligibleLocation(location: SquareLocationFacts, merchantId: string): boolean {
  return location.status === "ACTIVE"
    && location.capabilities.includes("CREDIT_CARD_PROCESSING")
    && (location.merchantId === null || location.merchantId === merchantId)
    && Boolean(location.currency);
}

/**
 * Chooses the location a later checkout would use, deterministically: the one already selected if it is still
 * eligible, else the merchant's main location if eligible, else the oldest eligible location (then by id).
 * Returns null when no location is eligible, which is what makes the connection "not payment ready".
 */
export function selectPaymentLocation(
  locations: readonly SquareLocationFacts[],
  merchantId: string,
  preference: { currentLocationId?: string | null; mainLocationId?: string | null } = {},
): SquareLocationFacts | null {
  const eligible = locations.filter((location) => isPaymentEligibleLocation(location, merchantId));
  if (eligible.length === 0) return null;
  for (const preferredId of [preference.currentLocationId, preference.mainLocationId]) {
    const match = preferredId ? eligible.find((location) => location.id === preferredId) : undefined;
    if (match) return match;
  }
  return [...eligible].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id))[0];
}

/** Whether every scope a Catering checkout needs was actually granted. */
export function hasRequiredSquareScopes(granted: readonly string[]): boolean {
  return SQUARE_CONNECTION_SCOPES.every((scope) => granted.includes(scope));
}
