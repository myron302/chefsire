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
  /** Phase 2Q: when set, `POST /v2/online-checkout/payment-links` answers with this status (an errors body for 4xx, a 5xx envelope otherwise). */
  checkoutCreateFailure?: number;
  /** Phase 2Q: when true the payment link IS created (and remembered under its idempotency key) but the response is a 500, as an uncertain network result would be. */
  checkoutCreateLosesResponse?: boolean;
  /** Phase 2Q: hold the create response, to make concurrent creates overlap. */
  checkoutCreateDelayMs?: number;
  /** Phase 2Q: when set, `GET /v2/orders/:id` and `GET /v2/payments/:id` answer with this status. */
  evidenceFailure?: number;
  /** Phase 2Q: when set, `DELETE /v2/online-checkout/payment-links/:id` answers with this status instead of deleting. */
  linkDeleteFailure?: number;
};

/** Phase 2Q: the fake's checkout/order/payment world. Every field is plain JSON in Square's own snake_case shape. */
export type FakeOrder = { id: string; location_id: string; reference_id?: string; state: string; total_money: { amount: number; currency: string }; tenders: { id: string; payment_id: string }[]; line_items?: unknown[] };
export type FakePayment = { id: string; order_id?: string; location_id?: string; status: string; amount_money: { amount: number; currency: string }; total_money: { amount: number; currency: string }; tip_money?: { amount: number; currency: string }; created_at?: string; updated_at?: string; refund_ids?: string[] };

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

  const orders = new Map<string, FakeOrder>();
  const payments = new Map<string, FakePayment>();
  const links = new Map<string, { id: string; order_id: string; url: string; deleted: boolean }>();
  const linkByKey = new Map<string, string>();
  let sequence = 0;

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
      } else if (req.method === "POST" && path === "/v2/online-checkout/payment-links") {
        if (state.checkoutCreateDelayMs) await new Promise((resolve) => setTimeout(resolve, state.checkoutCreateDelayMs));
        if (state.checkoutCreateFailure) {
          res.statusCode = state.checkoutCreateFailure;
          res.end(state.checkoutCreateFailure >= 500
            ? JSON.stringify({ errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] })
            : JSON.stringify({ errors: [{ category: "INVALID_REQUEST_ERROR", code: "INVALID_VALUE", detail: "fake refusal" }] }));
          return;
        }
        const request = JSON.parse(body || "{}") as { idempotency_key?: string; order?: { location_id: string; reference_id?: string; line_items?: { base_price_money: { amount: number; currency: string }; quantity: string }[] } };
        // Square's idempotency: the same key returns the SAME link and order, never a second one.
        const existingId = request.idempotency_key ? linkByKey.get(request.idempotency_key) : undefined;
        let link = existingId ? links.get(existingId)! : undefined;
        if (!link) {
          sequence += 1;
          const orderId = `ORDER_${sequence}`;
          const line = request.order?.line_items?.[0];
          orders.set(orderId, {
            id: orderId, location_id: request.order?.location_id ?? "", reference_id: request.order?.reference_id, state: "OPEN",
            total_money: { amount: Number(line?.base_price_money.amount ?? 0), currency: line?.base_price_money.currency ?? "USD" }, tenders: [], line_items: request.order?.line_items,
          });
          link = { id: `LINK_${sequence}`, order_id: orderId, url: `https://sandbox.fake.square/checkout/LINK_${sequence}`, deleted: false };
          links.set(link.id, link);
          if (request.idempotency_key) linkByKey.set(request.idempotency_key, link.id);
        }
        if (state.checkoutCreateLosesResponse) {
          res.statusCode = 500;
          res.end(JSON.stringify({ errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] }));
          return;
        }
        res.end(JSON.stringify({ payment_link: { id: link.id, version: 1, order_id: link.order_id, url: link.url, long_url: link.url } }));
      } else if (req.method === "DELETE" && path.startsWith("/v2/online-checkout/payment-links/")) {
        if (state.linkDeleteFailure) { res.statusCode = state.linkDeleteFailure; res.end(state.linkDeleteFailure >= 500 ? JSON.stringify({ errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] }) : JSON.stringify({ errors: [{ category: "INVALID_REQUEST_ERROR", code: "NOT_FOUND" }] })); return; }
        const link = links.get(path.split("/").pop()!);
        if (!link) { res.statusCode = 404; res.end(JSON.stringify({ errors: [{ category: "INVALID_REQUEST_ERROR", code: "NOT_FOUND" }] })); return; }
        link.deleted = true;
        res.end(JSON.stringify({ id: link.id, cancelled_order_id: link.order_id }));
      } else if (req.method === "GET" && path.startsWith("/v2/orders/")) {
        if (state.evidenceFailure) { res.statusCode = state.evidenceFailure; res.end(state.evidenceFailure >= 500 ? JSON.stringify({ errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] }) : failureBody); return; }
        const order = orders.get(path.split("/").pop()!);
        if (!order) { res.statusCode = 404; res.end(JSON.stringify({ errors: [{ category: "INVALID_REQUEST_ERROR", code: "NOT_FOUND" }] })); return; }
        res.end(JSON.stringify({ order }));
      } else if (req.method === "GET" && path.startsWith("/v2/payments/")) {
        if (state.evidenceFailure) { res.statusCode = state.evidenceFailure; res.end(state.evidenceFailure >= 500 ? JSON.stringify({ errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] }) : failureBody); return; }
        const payment = payments.get(path.split("/").pop()!);
        if (!payment) { res.statusCode = 404; res.end(JSON.stringify({ errors: [{ category: "INVALID_REQUEST_ERROR", code: "NOT_FOUND" }] })); return; }
        res.end(JSON.stringify({ payment }));
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
    /** Phase 2Q: the world Square would hold. Tests drive it directly, exactly as a real customer paying would. */
    orders,
    payments,
    links,
    /** The most recent order created through a payment link. */
    lastOrder: () => Array.from(orders.values()).pop(),
    /** A customer completes a payment on `orderId`: a payment exists, the order has its tender and is COMPLETED. Overrides model wrong facts. */
    payOrder(orderId: string, overrides: Partial<FakePayment> & { orderState?: string } = {}) {
      const order = orders.get(orderId)!;
      sequence += 1;
      const paymentId = overrides.id ?? `PAYMENT_${sequence}`;
      const { orderState, ...rest } = overrides;
      const payment: FakePayment = {
        id: paymentId, order_id: orderId, location_id: order.location_id, status: "COMPLETED",
        amount_money: { ...order.total_money }, total_money: { ...order.total_money },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...rest,
      };
      payments.set(paymentId, payment);
      order.tenders.push({ id: `TENDER_${sequence}`, payment_id: paymentId });
      order.state = orderState ?? (payment.status === "COMPLETED" ? "COMPLETED" : order.state);
      return payment;
    },
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
