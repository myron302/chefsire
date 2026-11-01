import assert from "node:assert/strict";
import { test } from "node:test";
import { SquareClient, SquareEnvironment } from "square";
import {
  createWeddingSquareProviderPaymentReadback,
  WeddingSquareProviderPaymentReadbackError,
} from "./wedding-square-provider-payment-readback";

const saved = {
  attemptId: "attempt-1", providerSubscriptionId: "sub-1",
  customerId: "customer-1", locationId: "location-1", planVariationId: "plan-1",
};
const verified = {
  attemptId: "attempt-1", providerSubscriptionId: "sub-1",
  existingIdMatches: true, requiresOperatorReconciliation: true,
  grantsEntitlement: false, safeToResubmit: false,
};
const subscription = {
  subscription: {
    id: "sub-1", customerId: "customer-1", locationId: "location-1",
    planVariationId: "plan-1", invoiceIds: ["invoice-new", "invoice-older"],
  },
};
const invoice = {
  invoice: {
    id: "invoice-new", subscriptionId: "sub-1", orderId: "order-1",
    locationId: "location-1", status: "PAID",
    primaryRecipient: { customerId: "customer-1" },
  },
};
const order = {
  order: {
    id: "order-1", locationId: "location-1", customerId: "customer-1",
    tenders: [{
      type: "CARD", id: "payment-1", paymentId: "payment-1",
      customerId: "customer-1", locationId: "location-1",
    }],
  },
};
const payment = {
  payment: {
    id: "payment-1", orderId: "order-1", locationId: "location-1",
    customerId: "customer-1", status: "COMPLETED",
    amountMoney: { amount: 2499n, currency: "USD" },
    totalMoney: { amount: 2499n, currency: "USD" },
  },
};
const err = WeddingSquareProviderPaymentReadbackError;

async function sandbox<T>(run: () => Promise<T>): Promise<T> {
  const names = ["SQUARE_ENV", "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "SQUARE_CURRENCY"] as const;
  const previous = names.map((name) => process.env[name]);
  process.env.SQUARE_ENV = "sandbox";
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  process.env.SQUARE_CURRENCY = "USD";
  try { return await run(); }
  finally {
    names.forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    });
  }
}

function mock(options: {
  verified?: unknown, saved?: unknown, subscription?: unknown,
  invoice?: unknown, order?: unknown, payment?: unknown,
  failure?: string,
} = {}) {
  const calls: string[] = [];
  const step = async (name: string, value: unknown) => {
    calls.push(name);
    if (options.failure === name) throw new Error("secret provider error token-123");
    return value;
  };
  const service = createWeddingSquareProviderPaymentReadback(
    { inspect: async (id: string, userId: string) => {
      assert.equal(id, "attempt-1");
      assert.equal(userId, "owner-1");
      return step("verified", options.verified === undefined ? verified : options.verified);
    } } as any,
    { inspect: async (id: string, userId: string) => {
      assert.equal(id, "attempt-1");
      assert.equal(userId, "owner-1");
      return step("saved", options.saved === undefined ? saved : options.saved);
    } } as any,
    (id) => {
      assert.equal(id, "sub-1");
      return step("subscription", options.subscription === undefined ? subscription : options.subscription);
    },
    (id) => {
      assert.equal(id, "invoice-new");
      return step("invoice", options.invoice === undefined ? invoice : options.invoice);
    },
    (id) => {
      assert.equal(id, "order-1");
      return step("order", options.order === undefined ? order : options.order);
    },
    (id) => step(id === "payment-1" ? "payment" : "payment-other",
      options.payment === undefined ? payment : options.payment),
  );
  return { service, calls };
}

test("Square SDK v43 exposes GET subscription/invoice/order/payment; no API calls", () => {
  const client = new SquareClient({ token: "test-only", environment: SquareEnvironment.Sandbox });
  assert.equal(typeof client.subscriptions.get, "function");
  assert.equal(typeof client.invoices.get, "function");
  assert.equal(typeof client.orders.get, "function");
  assert.equal(typeof client.payments.get, "function");
});

test("trusted owner-bound chain reads only provider-issued IDs and NEVER grants access", () =>
  sandbox(async () => {
    const { service, calls } = mock();
    const result = await service.inspect("attempt-1", "owner-1");
    assert.deepEqual(calls, ["verified", "saved", "subscription", "invoice", "order", "payment"]);
    assert.deepEqual(result, {
      invoiceId: "invoice-new", paymentId: "payment-1", subscriptionId: "sub-1",
      requiresOperatorReconciliation: true,
      requiresAmountAndCoverageVerification: true,
      grantsEntitlement: false, safeToResubmit: false,
    });
    assert.equal(Object.isFrozen(result), true);
    assert.equal("paidThrough" in result, false);
  }));

test("real Square invoice CARD tender.id works without the optional paymentId alias", () =>
  sandbox(async () => {
    const { paymentId: _optionalAlias, ...idOnlyTender } = order.order.tenders[0];
    const { service, calls } = mock({
      order: { order: { ...order.order, tenders: [idOnlyTender] } },
    });
    const candidate = await service.inspect("attempt-1", "owner-1");
    assert.equal(candidate.paymentId, "payment-1");
    assert.equal(candidate.grantsEntitlement, false);
    assert.deepEqual(calls, ["verified", "saved", "subscription", "invoice", "order", "payment"]);
  }));

test("Square tender ID must be canonical, and a present paymentId alias must agree", () =>
  sandbox(async () => {
    for (const change of [
      { id: undefined }, { id: " other-payment " },
      { paymentId: "another-payment" },
      { paymentId: null },
    ]) {
      const { service, calls } = mock({
        order: { order: { ...order.order, tenders: [{ ...order.order.tenders[0], ...change }] } },
      });
      await assert.rejects(service.inspect("attempt-1", "owner-1"), err);
      assert.deepEqual(calls, ["verified", "saved", "subscription", "invoice", "order"]);
    }
  }));

test("a distinct provider tender ID triggers a fresh GET but mismatched payment identity fails closed", () =>
  sandbox(async () => {
    const { paymentId: _alias, ...otherTender } = order.order.tenders[0];
    const { service, calls } = mock({
      order: { order: { ...order.order, tenders: [{ ...otherTender, id: "payment-other" }] } },
    });
    await assert.rejects(service.inspect("attempt-1", "owner-1"), err);
    // The Square order itself supplies the payment ID; a valid ID not known
    // beforehand is safe to fetch but cannot be treated as matching evidence.
    assert.deepEqual(calls, ["verified", "saved", "subscription", "invoice", "order", "payment-other"]);
  }));

test("Square may omit optional order/tender owner fields but the fetched payment still proves identity", () =>
  sandbox(async () => {
    const { service, calls } = mock({
      order: { order: {
        ...order.order,
        customerId: undefined,
        tenders: [{
          ...order.order.tenders[0], customerId: null, locationId: undefined,
        }],
      } },
    });
    const candidate = await service.inspect("attempt-1", "owner-1");
    assert.equal(candidate.grantsEntitlement, false);
    assert.deepEqual(calls, ["verified", "saved", "subscription", "invoice", "order", "payment"]);

    const wrong = mock({
      order: { order: {
        ...order.order, customerId: null,
        tenders: [{ ...order.order.tenders[0], customerId: undefined, locationId: null }],
      } },
      payment: { payment: { ...payment.payment, customerId: "another-customer" } },
    });
    await assert.rejects(wrong.service.inspect("attempt-1", "owner-1"), err);
    assert.deepEqual(wrong.calls, ["verified", "saved", "subscription", "invoice", "order", "payment"]);
  }));

test("only newest invoice from trusted subscription list can be fetched", () =>
  sandbox(async () => {
    for (const bad of [
      { ...subscription.subscription, invoiceIds: [] },
      { ...subscription.subscription, invoiceIds: ["invoice-new", "invoice-new"] },
      { ...subscription.subscription, invoiceIds: [" bad invoice "] },
      { ...subscription.subscription, invoiceIds: ["invoice-new"], id: "sub-other" },
      { ...subscription.subscription, customerId: "wrong-user" },
      { ...subscription.subscription, locationId: "another-location" },
      { ...subscription.subscription, planVariationId: "another-plan" },
    ]) {
      const { service, calls } = mock({ subscription: { subscription: bad } });
      await assert.rejects(service.inspect("attempt-1", "owner-1"), err);
      assert.deepEqual(calls, ["verified", "saved", "subscription"]);
    }
  }));

test("untrusted or incomplete attested/saved identity blocks all Square GETs", () =>
  sandbox(async () => {
    for (const change of [
      { providerSubscriptionId: "wrong-sub" },
      { existingIdMatches: false },
      { grantsEntitlement: true },
      { safeToResubmit: true },
      { requiresOperatorReconciliation: false },
      { attemptId: "another-attempt" },
    ]) {
      const { service, calls } = mock({ verified: { ...verified, ...change } });
      await assert.rejects(service.inspect("attempt-1", "owner-1"), err);
      // A changed provider ID is canonical until the owner-scoped Neon row
      // independently shows the mismatch. That extra DB SELECT is expected;
      // NO Square provider GET may occur.
      assert.deepEqual(calls,
        "providerSubscriptionId" in change ? ["verified", "saved"] : ["verified"]);
    }
    for (const change of [
      { providerSubscriptionId: "wrong-sub" },
      { customerId: " bad id " },
      { locationId: null },
      { planVariationId: "" },
      { attemptId: "another-attempt" },
    ]) {
      const { service, calls } = mock({ saved: { ...saved, ...change } });
      await assert.rejects(service.inspect("attempt-1", "owner-1"), err);
      assert.deepEqual(calls, ["verified", "saved"]);
    }
  }));

test("invoice must be PAID, correct owner/location/order and listed by subscription", () =>
  sandbox(async () => {
    const changes = [
      { id: "wrong-invoice" }, { subscriptionId: "wrong-sub" },
      { orderId: "" }, { locationId: "wrong-location" },
      { primaryRecipient: { customerId: "wrong-customer" } },
      { status: "UNPAID" }, { status: "PARTIALLY_PAID" },
    ];
    for (const change of changes) {
      const { service, calls } = mock({ invoice: { invoice: { ...invoice.invoice, ...change } } });
      await assert.rejects(service.inspect("attempt-1", "owner-1"), err);
      assert.deepEqual(calls, ["verified", "saved", "subscription", "invoice"]);
    }
  }));

test("order tender must be exactly one correct customer card payment", () =>
  sandbox(async () => {
    for (const change of [
      { id: "other-order" }, { customerId: "wrong-customer" },
      { locationId: "wrong-location" }, { tenders: [] },
      { tenders: [order.order.tenders[0], order.order.tenders[0]] },
      { tenders: [{ ...order.order.tenders[0], paymentId: null }] },
      { tenders: [{ ...order.order.tenders[0], type: "CASH" }] },
      { tenders: [{ ...order.order.tenders[0], customerId: "other" }] },
      { tenders: [{ ...order.order.tenders[0], locationId: "other" }] },
    ]) {
      const { service, calls } = mock({ order: { order: { ...order.order, ...change } } });
      await assert.rejects(service.inspect("attempt-1", "owner-1"), err);
      assert.deepEqual(calls, ["verified", "saved", "subscription", "invoice", "order"]);
    }
  }));

test("a completed payment must independently match the provider order and customer", () =>
  sandbox(async () => {
    for (const change of [
      { id: "other-payment" }, { orderId: "other-order" },
      { locationId: "other-location" }, { customerId: "other-customer" },
      { status: "PENDING" }, { status: "FAILED" },
      { refundedMoney: { amount: 1n, currency: "USD" } },
      { refundIds: ["refund-1"] },
      { totalMoney: { amount: 2500n, currency: "USD" } },
    ]) {
      const { service, calls } = mock({ payment: { payment: { ...payment.payment, ...change } } });
      await assert.rejects(service.inspect("attempt-1", "owner-1"), err);
      assert.deepEqual(calls, ["verified", "saved", "subscription", "invoice", "order", "payment"]);
    }
  }));

test("SDK 2xx mixed-success errors and malformed envelopes never count as evidence", () =>
  sandbox(async () => {
    for (const key of ["subscription", "invoice", "order", "payment"] as const) {
      const base = { subscription, invoice, order, payment }[key];
      for (const errors of [[{ code: "INTERNAL_SERVER_ERROR" }], null, "invalid"]) {
        const { service } = mock({ [key]: { ...base, errors } });
        await assert.rejects(service.inspect("attempt-1", "owner-1"), err);
      }
      const { service } = mock({ [key]: { ...base, errors: [] } });
      assert.equal((await service.inspect("attempt-1", "owner-1")).grantsEntitlement, false);
    }
  }));

test("every provider exception fails closed without exposing IDs or secrets", () =>
  sandbox(async () => {
    for (const failure of ["verified", "saved", "subscription", "invoice", "order", "payment"]) {
      const { service } = mock({ failure });
      await assert.rejects(service.inspect("attempt-1", "owner-1"), (error: unknown) => {
        assert.ok(error instanceof WeddingSquareProviderPaymentReadbackError);
        assert.doesNotMatch(error.message, /secret|token-123|invoice-new|payment-1/);
        return true;
      });
    }
  }));

test("production and disabled sandbox make zero provider or DB calls", () =>
  sandbox(async () => {
    for (const [key, value] of [
      ["SQUARE_ENV", "production"],
      ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "false"],
    ] as const) {
      const old = process.env[key];
      process.env[key] = value;
      try {
        const { service, calls } = mock();
        await assert.rejects(service.inspect("attempt-1", "owner-1"), err);
        assert.deepEqual(calls, []);
      } finally {
        if (old === undefined) delete process.env[key]; else process.env[key] = old;
      }
    }
    const { service, calls } = mock();
    await assert.rejects(service.inspect("bad id", "owner-1"), err);
    assert.deepEqual(calls, []);
  }));
