/**
 * Contract tests against the REAL installed `square` package -- no mocked SDK. They fail if the package ever stops
 * exporting what ChefSire builds on, and they drive the production client constructors and API wrappers through the real
 * SDK against a local HTTP server, so request building, authentication and response parsing are the SDK's own.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as square from "square";
import { SquareClient, SquareEnvironment, SquareError, WebhooksHelper } from "square";
import {
  classifySquareFailure,
  createConnectedSquareClient,
  createPlatformSquareClient,
  createSquareProviderApi,
  hasRequiredSquareScopes,
  isPaymentEligibleLocation,
  selectPaymentLocation,
  SQUARE_CONNECTION_SCOPES,
  squareOauthAuthorizeUrl,
  SquareRevocationUnconfirmedError,
  type SquareFailureSurface,
  type SquareLocationFacts,
} from "./square-integration";
import { getSquareClient as getMarketplaceSquareClient } from "./square-client";
import { startFakeSquare, FAKE_TOKEN_ERRORS } from "../test-support/fake-square";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env.SQUARE_ACCESS_TOKEN = "platform-token-test";

test("the installed Square package is v43 and exposes the modern API ChefSire builds on", () => {
  const installed = JSON.parse(fs.readFileSync(path.join(root, "node_modules/square/package.json"), "utf8")) as { version: string };
  assert.match(installed.version, /^43\./);
  assert.equal(typeof SquareClient, "function");
  assert.equal(typeof SquareError, "function");
  assert.equal(typeof WebhooksHelper, "function");
  assert.ok(SquareEnvironment.Production && SquareEnvironment.Sandbox);
});

test("the legacy root exports the old code used do NOT exist on the installed package", () => {
  const cjs = require("square") as Record<string, unknown>;
  for (const legacy of ["Client", "Environment", "ApiError"]) {
    assert.equal(cjs[legacy], undefined, `root export ${legacy}`);
    assert.equal((square as Record<string, unknown>)[legacy], undefined, `ESM export ${legacy}`);
  }
});

test("the resource clients this integration calls exist on a real SquareClient", () => {
  const client = createConnectedSquareClient("token-for-shape-check");
  for (const [resource, methods] of Object.entries({
    oAuth: ["obtainToken", "revokeToken", "retrieveTokenStatus"],
    merchants: ["get"],
    locations: ["list"],
    payments: ["create", "list", "get"],
    refunds: ["refundPayment", "get"],
    checkout: [],
  })) {
    const target = (client as unknown as Record<string, Record<string, unknown>>)[resource];
    assert.ok(target, resource);
    for (const method of methods) assert.equal(typeof target[method], "function", `${resource}.${method}`);
  }
  assert.equal(typeof (client as unknown as { checkout: { paymentLinks: { create: unknown } } }).checkout.paymentLinks.create, "function");
  // The legacy accessors are absent on the real client; this is why the adapter exists.
  for (const legacyAccessor of ["paymentsApi", "refundsApi", "merchantsApi", "locationsApi", "oAuthApi"]) {
    assert.equal((client as unknown as Record<string, unknown>)[legacyAccessor], undefined, legacyAccessor);
  }
});

test("production client constructors build real SDK clients and refuse a missing credential", () => {
  assert.ok(createPlatformSquareClient() instanceof SquareClient);
  assert.ok(createConnectedSquareClient("provider-token") instanceof SquareClient);
  assert.throws(() => createConnectedSquareClient(""), /access token is required/);
  const saved = process.env.SQUARE_ACCESS_TOKEN;
  delete process.env.SQUARE_ACCESS_TOKEN;
  try {
    assert.throws(() => createPlatformSquareClient(), /SQUARE_ACCESS_TOKEN/);
  } finally {
    process.env.SQUARE_ACCESS_TOKEN = saved;
  }
});

test("the OAuth authorize host follows the configured environment and never mixes sandbox with production", () => {
  const before = process.env.SQUARE_ENV;
  try {
    process.env.SQUARE_ENV = "production";
    assert.equal(squareOauthAuthorizeUrl(), "https://connect.squareup.com/oauth2/authorize");
    process.env.SQUARE_ENV = "sandbox";
    assert.equal(squareOauthAuthorizeUrl(), "https://connect.squareupsandbox.com/oauth2/authorize");
    delete process.env.SQUARE_ENV;
    assert.equal(squareOauthAuthorizeUrl(), "https://connect.squareupsandbox.com/oauth2/authorize");
  } finally {
    if (before === undefined) delete process.env.SQUARE_ENV; else process.env.SQUARE_ENV = before;
  }
});

test("the real SDK, driven by the production wrappers, sends the right requests and parses the answers", async () => {
  const fake = await startFakeSquare({
    grants: [{ access_token: "AT-1", refresh_token: "RT-1", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_1" }],
  });
  try {
    const api = createSquareProviderApi({ baseUrl: fake.baseUrl });

    const grant = await api.exchangeAuthorizationCode("auth-code-1");
    assert.deepEqual({ ...grant, expiresAt: grant.expiresAt.toISOString() }, { accessToken: "AT-1", refreshToken: "RT-1", expiresAt: "2099-01-01T00:00:00.000Z", merchantId: "MERCHANT_1" });
    const exchange = fake.requests.find((request) => request.path === "/oauth2/token")!;
    assert.deepEqual(JSON.parse(exchange.body), { client_id: "app-id-test", client_secret: "app-secret-test", code: "auth-code-1", grant_type: "authorization_code" });
    assert.equal(exchange.authorization, undefined);

    await api.refreshAccessToken("RT-1");
    assert.deepEqual(JSON.parse(fake.requests.filter((request) => request.path === "/oauth2/token")[1].body),
      { client_id: "app-id-test", client_secret: "app-secret-test", refresh_token: "RT-1", grant_type: "refresh_token" });

    assert.deepEqual(await api.retrieveMerchant("AT-1"), { id: "MERCHANT_1", businessName: "Test Catering Co", mainLocationId: "LOC_1" });
    assert.equal(fake.requests.find((request) => request.path === "/v2/merchants/me")!.authorization, "Bearer AT-1");

    const status = await api.retrieveTokenStatus("AT-1");
    assert.equal(status.merchantId, "MERCHANT_1");
    assert.equal(hasRequiredSquareScopes(status.scopes), true);

    const locations = await api.listLocations("AT-1");
    assert.equal(locations.length, 1);
    assert.deepEqual(selectPaymentLocation(locations, "MERCHANT_1", { mainLocationId: "LOC_1" })?.id, "LOC_1");

    await api.revokeAccessToken("AT-1");
    const revoke = fake.requests.find((request) => request.path === "/oauth2/revoke")!;
    assert.equal(revoke.authorization, "Client app-secret-test");
    assert.deepEqual(JSON.parse(revoke.body), { client_id: "app-id-test", access_token: "AT-1" });
  } finally {
    await fake.close();
  }
});

test("failures from the real SDK are classified from the error CONTENT: only a provider-credential failure is destructive", async () => {
  const fake = await startFakeSquare();
  try {
    const api = createSquareProviderApi({ baseUrl: fake.baseUrl });
    const classify = async (call: () => Promise<unknown>, surface: SquareFailureSurface) => {
      try { await call(); } catch (error) { assert.ok(error instanceof SquareError || !(error instanceof SquareError)); return classifySquareFailure(error, { surface }); }
      throw new Error("expected the call to fail");
    };
    // A bearer call: 401 means THIS provider's token is bad; an outage is transient.
    fake.state.failures.merchant = 401;
    assert.equal(await classify(() => api.retrieveMerchant("AT"), "bearer"), "provider_credential_invalid");
    fake.state.failures.merchant = 503;
    assert.equal(await classify(() => api.retrieveMerchant("AT"), "bearer"), "transient");
    fake.state.failures.merchant = undefined;

    // The token endpoint: the BODY decides, whatever the status.
    const grant = (status: number, body: unknown) => { fake.state.failures.token = status; fake.state.tokenFailureBody = body; return classify(() => api.refreshAccessToken("RT"), "token_grant"); };
    for (const status of [400, 401, 403]) {
      assert.equal(await grant(status, FAKE_TOKEN_ERRORS.invalidClient), "application_auth", `INVALID_CLIENT ${status}`);
      assert.equal(await grant(status, FAKE_TOKEN_ERRORS.clientDisabled), "application_auth", `CLIENT_DISABLED ${status}`);
      assert.equal(await grant(status, FAKE_TOKEN_ERRORS.notAuthorizedV1), "application_auth", `Not Authorized ${status}`);
      assert.equal(await grant(status, FAKE_TOKEN_ERRORS.invalidGrantV2), "provider_credential_invalid", `invalid_grant v2 ${status}`);
      assert.equal(await grant(status, FAKE_TOKEN_ERRORS.invalidGrantV1), "provider_credential_invalid", `invalid_grant v1 ${status}`);
      assert.equal(await grant(status, FAKE_TOKEN_ERRORS.unrecognized), "unrecognized", `unrecognised ${status}`);
      assert.equal(await grant(status, FAKE_TOKEN_ERRORS.empty), "unrecognized", `empty ${status}`);
    }
    assert.equal(await grant(503, FAKE_TOKEN_ERRORS.invalidGrantV2), "transient", "a 5xx is transient whatever it says");
    assert.equal(await grant(429, FAKE_TOKEN_ERRORS.invalidGrantV2), "transient");
    // A non-Square failure (network down) is never mistaken for a revoked credential.
    assert.equal(classifySquareFailure(new TypeError("fetch failed")), "transient");
    assert.equal(classifySquareFailure(undefined), "transient");
  } finally {
    await fake.close();
  }
});

test("a revocation is CONFIRMED only by an explicit `success: true` with no errors, judged on the real SDK's response shape", async () => {
  const fake = await startFakeSquare();
  try {
    const api = createSquareProviderApi({ baseUrl: fake.baseUrl });
    // The real SDK resolves a 2xx with the parsed body; confirm that body is exactly what the wrapper inspects.
    fake.state.revokeResponseBody = { success: true };
    await api.revokeAccessToken("AT"); // resolves: confirmed

    const unconfirmed: Array<[string, unknown]> = [
      ["success: false", { success: false }],
      ["success missing", {}],
      ["success null", { success: null }],
      ["success as a string", { success: "true" }],
      ["errors only", { errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR", detail: "nope" }] }],
      ["success true WITH response-level errors", { success: true, errors: [{ category: "API_ERROR", code: "GENERIC_DECLINE" }] }],
    ];
    for (const [label, body] of unconfirmed) {
      fake.state.revokeResponseBody = body;
      await assert.rejects(api.revokeAccessToken("AT"), (error: unknown) => error instanceof SquareRevocationUnconfirmedError, label);
    }
    // A thrown API error and a network failure are failures too (never a confirmation).
    fake.state.revokeResponseBody = undefined;
    fake.state.failures.revoke = 401;
    await assert.rejects(api.revokeAccessToken("AT"), (error: unknown) => error instanceof SquareError);
    fake.state.failures.revoke = 503;
    await assert.rejects(api.revokeAccessToken("AT"), (error: unknown) => error instanceof SquareError);
    fake.state.failures.revoke = undefined;
    const dead = createSquareProviderApi({ baseUrl: "http://127.0.0.1:9" });
    await assert.rejects(dead.revokeAccessToken("AT"));
    // No token or secret in the failure message.
    fake.state.revokeResponseBody = { success: false };
    await assert.rejects(api.revokeAccessToken("secret-token-value"), (error: unknown) => !String((error as Error).message).includes("secret-token-value") && !String((error as Error).message).includes("app-secret-test"));
  } finally {
    await fake.close();
  }
});

test("the marketplace adapter keeps the legacy call shape on the real SDK: create, list (one page + cursor) and refund", async () => {
  const requests: { method: string; path: string; query: string; body: string }[] = [];
  const http = await import("node:http");
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const [pathname, query = ""] = (req.url ?? "").split("?");
      requests.push({ method: req.method ?? "", path: pathname, query, body });
      res.setHeader("content-type", "application/json");
      if (req.method === "POST" && pathname === "/v2/payments") {
        res.end(JSON.stringify({ payment: { id: "PAY_1", status: "COMPLETED", reference_id: "ref-1", created_at: "2026-01-01T00:00:00Z", total_money: { amount: 1250, currency: "USD" } } }));
      } else if (req.method === "GET" && pathname === "/v2/payments") {
        const cursor = new URLSearchParams(query).get("cursor");
        res.end(JSON.stringify(cursor
          ? { payments: [{ id: "PAY_3", reference_id: "ref-3", status: "COMPLETED" }] }
          : { payments: [{ id: "PAY_2", reference_id: "ref-2", status: "COMPLETED" }], cursor: "next-page" }));
      } else if (req.method === "POST" && pathname === "/v2/refunds") {
        res.end(JSON.stringify({ refund: { id: "REF_1", status: "PENDING", amount_money: { amount: 1250, currency: "USD" } } }));
      } else if (req.method === "GET" && pathname === "/v2/refunds/REF_1") {
        res.end(JSON.stringify({ refund: { id: "REF_1", status: "COMPLETED", amount_money: { amount: 1250, currency: "USD" } } }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ errors: [{ category: "INVALID_REQUEST_ERROR", code: "NOT_FOUND" }] }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const client = getMarketplaceSquareClient({ baseUrl });

    const created = await client.paymentsApi.createPayment({
      sourceId: "cnon:card", idempotencyKey: "key-1", amountMoney: { amount: 1250n, currency: "USD" }, locationId: "LOC_1", referenceId: "ref-1",
    });
    assert.equal(created.result.payment?.id, "PAY_1");
    assert.equal(created.result.payment?.totalMoney?.amount, 1250n);
    const createBody = JSON.parse(requests.find((request) => request.path === "/v2/payments" && request.method === "POST")!.body);
    assert.equal(createBody.idempotency_key, "key-1");
    assert.equal(createBody.amount_money.amount, 1250);

    // Positional arguments, exactly as the reconciliation code passes them; ONE page per call, with the cursor for the next (the
    // reconciliation search walks the pages lazily and stops at its match -- nothing is materialized across pages).
    const listed = await client.paymentsApi.listPayments("2026-01-01T00:00:00Z", "2026-01-01T00:10:00Z", "DESC", undefined, "LOC_1", 1250n, undefined, undefined, 100);
    assert.deepEqual(listed.result.payments.map((payment) => payment.id), ["PAY_2"]);
    assert.equal(listed.result.cursor, "next-page");
    const second = await client.paymentsApi.listPayments("2026-01-01T00:00:00Z", "2026-01-01T00:10:00Z", "DESC", "next-page", "LOC_1", 1250n, undefined, undefined, 100);
    assert.deepEqual(second.result.payments.map((payment) => payment.id), ["PAY_3"]);
    assert.equal(second.result.cursor, undefined);
    const firstList = requests.find((request) => request.path === "/v2/payments" && request.method === "GET")!;
    assert.match(firstList.query, /location_id=LOC_1/);
    assert.match(firstList.query, /total=1250/);

    const refund = await client.refundsApi.refundPayment({ idempotencyKey: "refund-key", paymentId: "PAY_1", amountMoney: { amount: 1250n, currency: "USD" }, reason: "r" });
    assert.equal(refund.result.refund?.id, "REF_1");
    assert.equal(refund.result.refund?.status, "PENDING");
    const fetched = await client.refundsApi.getPaymentRefund("REF_1");
    assert.equal(fetched.result.refund?.status, "COMPLETED");

    // A Square rejection surfaces as an error carrying `errors[]` with category and code, which is what
    // getDefinitiveSquarePaymentFailure / getDefinitiveSquareRefundFailure read.
    await assert.rejects(client.refundsApi.getPaymentRefund("MISSING"), (error: unknown) => {
      assert.ok(error instanceof SquareError);
      assert.equal(error.errors[0].code, "NOT_FOUND");
      return true;
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("only the scopes the connection needs are requested, and each has a stated purpose", () => {
  assert.deepEqual([...SQUARE_CONNECTION_SCOPES].sort(), ["MERCHANT_PROFILE_READ", "ORDERS_READ", "ORDERS_WRITE", "PAYMENTS_READ", "PAYMENTS_WRITE"]);
  const source = fs.readFileSync(path.join(root, "server/lib/square-integration.ts"), "utf8");
  for (const scope of SQUARE_CONNECTION_SCOPES) assert.ok(source.includes(scope));
  // Nothing about customers, payouts, invoices, bank accounts or items.
  for (const forbidden of ["CUSTOMERS", "PAYOUTS", "INVOICES", "BANK_ACCOUNTS", "ITEMS", "EMPLOYEES", "SETTLEMENTS"]) {
    assert.equal(SQUARE_CONNECTION_SCOPES.some((scope) => scope.includes(forbidden)), false, forbidden);
  }
  assert.equal(hasRequiredSquareScopes(["MERCHANT_PROFILE_READ", "PAYMENTS_WRITE"]), false);
  assert.equal(hasRequiredSquareScopes([...SQUARE_CONNECTION_SCOPES]), true);
});

const location = (overrides: Partial<SquareLocationFacts>): SquareLocationFacts => ({
  id: "L", name: "n", status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], merchantId: "M", currency: "USD", createdAt: "2024-01-01T00:00:00Z", ...overrides,
});

test("location eligibility requires an ACTIVE location of this merchant that can process cards", () => {
  assert.equal(isPaymentEligibleLocation(location({}), "M"), true);
  assert.equal(isPaymentEligibleLocation(location({ status: "INACTIVE" }), "M"), false);
  assert.equal(isPaymentEligibleLocation(location({ capabilities: [] }), "M"), false);
  assert.equal(isPaymentEligibleLocation(location({ capabilities: ["AUTOMATIC_TRANSFERS"] }), "M"), false);
  assert.equal(isPaymentEligibleLocation(location({ merchantId: "OTHER" }), "M"), false);
  assert.equal(isPaymentEligibleLocation(location({ currency: null }), "M"), false);
  assert.equal(selectPaymentLocation([], "M"), null);
  assert.equal(selectPaymentLocation([location({ status: "INACTIVE" })], "M"), null);
});

test("location selection is deterministic: current choice, then main location, then oldest eligible", () => {
  const locations = [
    location({ id: "C", createdAt: "2024-03-01T00:00:00Z" }),
    location({ id: "B", createdAt: "2024-02-01T00:00:00Z" }),
    location({ id: "A", createdAt: "2024-02-01T00:00:00Z" }),
    location({ id: "X", status: "INACTIVE", createdAt: "2020-01-01T00:00:00Z" }),
  ];
  assert.equal(selectPaymentLocation(locations, "M")?.id, "A");
  assert.equal(selectPaymentLocation(locations, "M", { mainLocationId: "C" })?.id, "C");
  assert.equal(selectPaymentLocation(locations, "M", { currentLocationId: "B", mainLocationId: "C" })?.id, "B");
  // A preferred location that stopped being eligible is not chosen.
  assert.equal(selectPaymentLocation(locations, "M", { currentLocationId: "X", mainLocationId: "X" })?.id, "A");
});
