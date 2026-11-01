import assert from "node:assert/strict";
import { test } from "node:test";
import { SquareClient, SquareEnvironment } from "square";
import {
  inspectWeddingSquareInvoicePaymentLinkage,
  WeddingSquareInvoicePaymentLinkageError,
} from "./wedding-square-invoice-payment-linkage";

const expected = {
  subscriptionId: "sub-wedding-1",
  customerId: "customer-wedding-1",
  locationId: "location-wedding-1",
  planVariationId: "wedding-premium-variation",
};
const subscription = {
  id: expected.subscriptionId,
  customer_id: expected.customerId,
  location_id: expected.locationId,
  plan_variation_id: expected.planVariationId,
  invoice_ids: ["invoice-1"],
  status: "ACTIVE",
};
const invoice = {
  id: "invoice-1",
  subscription_id: expected.subscriptionId,
  order_id: "order-1",
  location_id: expected.locationId,
  primary_recipient: { customer_id: expected.customerId },
  status: "PAID",
};
const payment = {
  id: "payment-1",
  order_id: "order-1",
  location_id: expected.locationId,
  customer_id: expected.customerId,
  status: "COMPLETED",
  amount_money: { amount: 2499, currency: "USD" },
  total_money: { amount: 2499, currency: "USD" },
  refunded_money: { amount: 0, currency: "USD" },
  refund_ids: [],
};

async function offline<T>(
  fetcher: typeof fetch,
  run: (client: SquareClient) => Promise<T>,
): Promise<T> {
  const oldFetch = globalThis.fetch;
  const keys = ["SQUARE_ENV", "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "SQUARE_CURRENCY"] as const;
  const oldEnv = keys.map((key) => process.env[key]);
  process.env.SQUARE_ENV = "sandbox";
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  process.env.SQUARE_CURRENCY = "USD";
  globalThis.fetch = fetcher;
  try {
    const client = new SquareClient({
      token: "offline-sdk-contract-only",
      environment: SquareEnvironment.Sandbox,
    });
    return await run(client);
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((key, i) => {
      if (oldEnv[i] === undefined) delete process.env[key];
      else process.env[key] = oldEnv[i];
    });
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

test("real Square SDK v43 GET deserializes invoice and payment into the offline guard", async () => {
  const paths: string[] = [];
  await offline(async (input) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    paths.push(path);
    if (path.endsWith("/v2/subscriptions/sub-wedding-1")) return jsonResponse({ subscription });
    if (path.endsWith("/v2/invoices/invoice-1")) return jsonResponse({ invoice });
    if (path.endsWith("/v2/payments/payment-1")) return jsonResponse({ payment });
    throw new Error("Unexpected SDK request");
  }, async (client) => {
    assert.equal(typeof client.subscriptions.get, "function");
    assert.equal(typeof client.invoices.get, "function");
    assert.equal(typeof client.payments.get, "function");
    const s = await client.subscriptions.get({ subscriptionId: "sub-wedding-1" }, { maxRetries: 0 });
    const i = await client.invoices.get({ invoiceId: "invoice-1" }, { maxRetries: 0 });
    const p = await client.payments.get({ paymentId: "payment-1" }, { maxRetries: 0 });
    assert.deepEqual(s.subscription?.invoiceIds, ["invoice-1"]);
    assert.equal(i.invoice?.subscriptionId, expected.subscriptionId);
    assert.equal(p.payment?.amountMoney?.amount, 2499n);
    assert.equal(p.payment?.refundedMoney?.amount, 0n);
    const candidate = inspectWeddingSquareInvoicePaymentLinkage(expected, s, i, p);
    assert.equal(candidate.invoiceId, "invoice-1");
    assert.equal(candidate.paymentId, "payment-1");
    assert.equal(candidate.requiresOperatorReconciliation, true);
    assert.equal(candidate.requiresAmountAndCoverageVerification, true);
    assert.equal(candidate.grantsEntitlement, false);
    assert.equal(candidate.safeToResubmit, false);
  });
  assert.deepEqual(paths, ["/v2/subscriptions/sub-wedding-1", "/v2/invoices/invoice-1", "/v2/payments/payment-1"]);
});

test("real SDK 2xx mixed-success invoice and payment bodies cannot become evidence", async () => {
  for (const failedEndpoint of ["subscription", "invoice", "payment"] as const) {
    let requests = 0;
    await offline(async (input) => {
      requests++;
      const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
      const endpoint = path.includes("/subscriptions/") ? "subscription"
        : path.includes("/invoices/") ? "invoice" : "payment";
      return jsonResponse({
        ...(endpoint === "subscription" ? { subscription } : endpoint === "invoice" ? { invoice } : { payment }),
        ...(failedEndpoint === endpoint
          ? { errors: [{ code: "INVALID_REQUEST_ERROR", detail: "offline secret" }] }
          : {}),
      });
    }, async (client) => {
      const s = await client.subscriptions.get({ subscriptionId: "sub-wedding-1" }, { maxRetries: 0 });
    const i = await client.invoices.get({ invoiceId: "invoice-1" }, { maxRetries: 0 });
      const p = await client.payments.get({ paymentId: "payment-1" }, { maxRetries: 0 });
      assert.throws(
        () => inspectWeddingSquareInvoicePaymentLinkage(expected, s, i, p),
        (error: unknown) => {
          assert.ok(error instanceof WeddingSquareInvoicePaymentLinkageError);
          assert.doesNotMatch(error.message, /offline secret|invoice-1|payment-1/);
          return true;
        },
      );
    });
    assert.equal(requests, 3);
  }
});

test("SDK invoice/payment HTTP failures do not retry and cannot be treated as evidence", async () => {
  for (const status of [429, 503]) {
    for (const endpoint of ["subscription", "invoice", "payment"] as const) {
      let requests = 0;
      await offline(async () => {
        requests++;
        return jsonResponse({ errors: [{ code: "SERVICE_UNAVAILABLE", detail: "offline secret" }] }, status);
      }, async (client) => {
        if (endpoint === "subscription") {
          await assert.rejects(client.subscriptions.get({ subscriptionId: "sub-wedding-1" }, { maxRetries: 0 }));
        } else if (endpoint === "invoice") {
          await assert.rejects(client.invoices.get({ invoiceId: "invoice-1" }, { maxRetries: 0 }));
        } else {
          await assert.rejects(client.payments.get({ paymentId: "payment-1" }, { maxRetries: 0 }));
        }
      });
      assert.equal(requests, 1);
    }
  }
});
