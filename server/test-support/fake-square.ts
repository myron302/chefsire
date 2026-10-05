/**
 * A local HTTP stand-in for Square's API, so tests can drive the REAL `square` v43 SDK end to end (its request building,
 * authentication headers, response parsing and error classes) without a network or a Square account.
 *
 * Every response is configurable and every request is recorded so tests can assert exactly what was sent and with which
 * credential. Bodies of recorded requests are available to tests only; production code never sees this module.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export type FakeLocation = {
  id: string;
  name?: string;
  status?: string;
  capabilities?: string[];
  merchant_id?: string;
  currency?: string;
  created_at?: string;
};

export type FakeSquareState = {
  merchantId: string;
  businessName: string;
  mainLocationId: string;
  scopes: string[];
  locations: FakeLocation[];
  /** What `POST /oauth2/token` returns for authorization_code and refresh_token grants, in order; the last repeats. */
  grants: Array<{ access_token: string; refresh_token?: string; expires_at: string; merchant_id?: string | null }>;
  /** When set, the named endpoint answers with this status and an errors body instead of succeeding. */
  failures: Partial<Record<"token" | "merchant" | "tokenStatus" | "locations" | "revoke", number>>;
  /** The raw JSON body the token endpoint answers with when `failures.token` is set (default: a generic auth error). */
  tokenFailureBody?: unknown;
  /** Likewise for `/v2/merchants/me` when `failures.merchant` is set. */
  merchantFailureBody?: unknown;
  /** Likewise for `/oauth2/revoke` when `failures.revoke` is set. */
  revokeFailureBody?: unknown;
  /** When set, `/oauth2/revoke` answers 200 with exactly this JSON instead of `{ success: true }` (and invalidates nothing). */
  revokeResponseBody?: unknown;
  /** When true (default) a revoke invalidates every access token issued so far, as Square does for a merchant. */
  revokeInvalidatesTokens: boolean;
  /** Added to the `/oauth2/revoke` response, to hold a merchant-wide revocation in flight. */
  revokeDelayMs: number;
  /** Added to every token-endpoint response, to make a concurrent refresh overlap observable. */
  tokenDelayMs: number;
  /** The merchant id `/v2/merchants/me` reports; defaults to `merchantId`. */
  profileMerchantId?: string;
  /** The merchant id `/oauth2/token/status` reports; defaults to `merchantId`. */
  statusMerchantId?: string;
};

export type RecordedRequest = { method: string; path: string; authorization: string | undefined; body: string };

export const REQUIRED_TEST_SCOPES = ["MERCHANT_PROFILE_READ", "PAYMENTS_WRITE", "PAYMENTS_READ", "ORDERS_WRITE", "ORDERS_READ"];

export function defaultFakeSquareState(overrides: Partial<FakeSquareState> = {}): FakeSquareState {
  return {
    merchantId: "MERCHANT_1",
    businessName: "Test Catering Co",
    mainLocationId: "LOC_1",
    scopes: [...REQUIRED_TEST_SCOPES],
    locations: [{ id: "LOC_1", name: "Main Kitchen", status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], merchant_id: "MERCHANT_1", currency: "USD", created_at: "2024-01-01T00:00:00Z" }],
    grants: [{ access_token: "access-token-initial", refresh_token: "refresh-token-initial", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_1" }],
    failures: {},
    tokenDelayMs: 0,
    revokeDelayMs: 0,
    revokeInvalidatesTokens: true,
    ...overrides,
  };
}

export async function startFakeSquare(initial: Partial<FakeSquareState> = {}) {
  const state = defaultFakeSquareState(initial);
  const requests: RecordedRequest[] = [];
  let grantIndex = 0;
  /** access token -> still valid? Tokens the fake never issued (tests passing arbitrary strings) count as valid. */
  const issued = new Map<string, boolean>();
  const issuedMerchant = new Map<string, string>();

  const bearerRevoked = (authorization: string | undefined) => {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    return token !== undefined && issued.get(token) === false;
  };
  const failureBody = JSON.stringify({ errors: [{ category: "AUTHENTICATION_ERROR", code: "UNAUTHORIZED", detail: "fake" }] });

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      const path = (req.url ?? "").split("?")[0];
      requests.push({ method: req.method ?? "", path, authorization: req.headers.authorization, body });
      res.setHeader("content-type", "application/json");
      const fail = (key: keyof FakeSquareState["failures"]) => {
        const status = state.failures[key];
        if (!status) return false;
        res.statusCode = status;
        const body = key === "token" ? state.tokenFailureBody : key === "revoke" ? state.revokeFailureBody : key === "merchant" ? state.merchantFailureBody : undefined;
        if (status < 500 && body !== undefined) res.end(JSON.stringify(body));
        else res.end(status >= 500 ? JSON.stringify({ errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] }) : failureBody);
        return true;
      };
      if (req.method === "POST" && path === "/oauth2/token") {
        if (state.tokenDelayMs) await new Promise((resolve) => setTimeout(resolve, state.tokenDelayMs));
        if (fail("token")) return;
        const grant = state.grants[Math.min(grantIndex, state.grants.length - 1)];
        grantIndex += 1;
        issued.set(grant.access_token, true);
        issuedMerchant.set(grant.access_token, grant.merchant_id ?? state.merchantId);
        res.end(JSON.stringify({ token_type: "bearer", ...grant }));
      } else if (path !== "/oauth2/token" && path !== "/oauth2/revoke" && bearerRevoked(req.headers.authorization)) {
        res.statusCode = 401;
        res.end(JSON.stringify({ errors: [{ category: "AUTHENTICATION_ERROR", code: "ACCESS_TOKEN_REVOKED", detail: "revoked" }] }));
      } else if (req.method === "GET" && path === "/v2/merchants/me") {
        if (fail("merchant")) return;
        res.end(JSON.stringify({ merchant: { id: state.profileMerchantId ?? state.merchantId, business_name: state.businessName, main_location_id: state.mainLocationId, country: "US" } }));
      } else if (req.method === "POST" && path === "/oauth2/token/status") {
        if (fail("tokenStatus")) return;
        res.end(JSON.stringify({ scopes: state.scopes, merchant_id: state.statusMerchantId ?? state.merchantId, expires_at: "2099-01-01T00:00:00Z" }));
      } else if (req.method === "GET" && path === "/v2/locations") {
        if (fail("locations")) return;
        res.end(JSON.stringify({ locations: state.locations }));
      } else if (req.method === "POST" && path === "/oauth2/revoke") {
        if (state.revokeDelayMs) await new Promise((resolve) => setTimeout(resolve, state.revokeDelayMs));
        if (fail("revoke")) return;
        if (state.revokeResponseBody !== undefined) {
          res.end(JSON.stringify(state.revokeResponseBody));
          return;
        }
        if (state.revokeInvalidatesTokens) {
          // Square revokes every token of the application for the MERCHANT that owns the one named.
          const merchant = issuedMerchant.get((JSON.parse(body || "{}") as { access_token?: string }).access_token ?? "");
          for (const [token, owner] of Array.from(issuedMerchant.entries())) if (owner === merchant) issued.set(token, false);
        }
        res.end(JSON.stringify({ success: true }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ errors: [{ category: "INVALID_REQUEST_ERROR", code: "NOT_FOUND" }] }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    state,
    requests,
    baseUrl,
    calls: (path: string) => requests.filter((request) => request.path === path).length,
    resetGrants() { grantIndex = 0; },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * Token-endpoint error bodies, in the shapes the real SDK delivers: the v2 `{ errors: [...] }` envelope, and the older
 * `{ type, message }` shape Square's OAuth endpoints can answer in (which the SDK surfaces as category V1_ERROR, code = type).
 * `notAuthorizedV1` is the body reported for a wrong/rotated application secret.
 */
export const FAKE_TOKEN_ERRORS = {
  invalidClient: { errors: [{ category: "AUTHENTICATION_ERROR", code: "INVALID_CLIENT", detail: "Client authentication failed" }] },
  clientDisabled: { errors: [{ category: "AUTHENTICATION_ERROR", code: "CLIENT_DISABLED", detail: "The application is disabled" }] },
  notAuthorizedV1: { message: "Not Authorized", type: "service.not_authorized" },
  invalidGrantV2: { errors: [{ category: "INVALID_REQUEST_ERROR", code: "INVALID_GRANT", detail: "The refresh token is invalid" }] },
  invalidGrantV1: { type: "invalid_grant", message: "The refresh token has been revoked" },
  unrecognized: { errors: [{ category: "INVALID_REQUEST_ERROR", code: "SOMETHING_NEW", detail: "an error nobody has seen before" }] },
  empty: {},
} as const;
