import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWeddingSquareSandboxCardSetupTransport,
  WeddingSquareCardSetupTransportError,
} from "./wedding-square-sandbox-card-setup-transport";

async function sandbox(fn: () => Promise<void>) {
  const names = ["SQUARE_ENV", "SQUARE_ACCESS_TOKEN",
    "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
    "WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED"];
  const old = names.map(name => process.env[name]);
  Object.assign(process.env, {
    SQUARE_ENV: "sandbox",
    SQUARE_ACCESS_TOKEN: "sandbox-test-secret",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
    WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED: "true",
  });
  try { await fn(); }
  finally { names.forEach((name, i) => {
    if (old[i] === undefined) delete process.env[name];
    else process.env[name] = old[i];
  }); }
}
const customer = { idempotencyKey: "customer-1", referenceId: "owner-1", verifiedEmailAddress: "tester@example.com" };
const card = {
  idempotencyKey: "card-1", sourceId: "cnon:sandbox-opaque",
  customerId: "cust-1", referenceId: "owner-1", expectedMerchantId: "merch-1",
};
test("disabled gate rejects before any Square POST", async () => sandbox(async () => {
  let calls = 0;
  process.env.WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED = "false";
  const svc = createWeddingSquareSandboxCardSetupTransport(async () => { calls++; throw Error(); });
  await assert.rejects(svc.createCustomer(customer), WeddingSquareCardSetupTransportError);
  assert.equal(calls, 0);
}));
test("customer creation returns strict owner reference without exposing secrets", async () => sandbox(async () => {
  const svc = createWeddingSquareSandboxCardSetupTransport(async (url, init) => {
    assert.equal(url, "https://connect.squareupsandbox.com/v2/customers");
    assert.equal(init.method, "POST");
    const body = JSON.parse(String(init.body));
    assert.deepEqual(body, {
      idempotency_key: customer.idempotencyKey,
      reference_id: customer.referenceId,
      email_address: customer.verifiedEmailAddress,
    });
    return new Response(JSON.stringify({ customer: { id: "cust-1", reference_id: "owner-1" } }), { status: 200 });
  });
  assert.deepEqual(await svc.createCustomer(customer), { id: "cust-1", referenceId: "owner-1" });
}));
test("card write verifies customer, merchant and active card; never sends PAN", async () => sandbox(async () => {
  const svc = createWeddingSquareSandboxCardSetupTransport(async (url, init) => {
    assert.equal(url, "https://connect.squareupsandbox.com/v2/cards");
    const body = JSON.parse(String(init.body));
    assert.deepEqual(body, {
      idempotency_key: card.idempotencyKey,
      source_id: card.sourceId,
      card: { customer_id: card.customerId, reference_id: card.referenceId },
    });
    assert.doesNotMatch(JSON.stringify(body), /card_number|cvv|pan|expiration/i);
    return new Response(JSON.stringify({
      card: { id: "card-1", customer_id: "cust-1", merchant_id: "merch-1", enabled: true, reference_id: "owner-1" },
    }), { status: 200 });
  });
  assert.deepEqual(await svc.createCard(card), { id: "card-1", customerId: "cust-1", merchantId: "merch-1", enabled: true });
}));
test("mismatched provider merchant or customer fail closed", async () => sandbox(async () => {
  const svc = createWeddingSquareSandboxCardSetupTransport(async () =>
    new Response(JSON.stringify({
      card: { id: "card-1", customer_id: "other-owner", merchant_id: "merch-1", enabled: true },
    }), { status: 200 }));
  await assert.rejects(svc.createCard(card), WeddingSquareCardSetupTransportError);
}));
test("unknown provider outcome does not retry or expose provider payload", async () => sandbox(async () => {
  let calls = 0;
  const svc = createWeddingSquareSandboxCardSetupTransport(async () => {
    calls++;
    throw new Error("secret-provider-error");
  });
  await assert.rejects(svc.createCard(card), e =>
    e instanceof WeddingSquareCardSetupTransportError && !/secret-provider-error|sandbox-test-secret/.test(e.message));
  assert.equal(calls, 1);
}));
test("raw card details and non-Square tokens never make a network request", async () => sandbox(async () => {
  let calls = 0;
  const svc = createWeddingSquareSandboxCardSetupTransport(async () => { calls++; throw Error(); });
  await assert.rejects(svc.createCard({ ...card, sourceId: "4111111111111111" }), WeddingSquareCardSetupTransportError);
  await assert.rejects(svc.createCard({ ...card, sourceId: "cnon:card source with spaces" }), WeddingSquareCardSetupTransportError);
  assert.equal(calls, 0);
}));

test("oversized streamed response is rejected before decoding or parsing", async () => sandbox(async () => {
  let calls = 0;
  const svc = createWeddingSquareSandboxCardSetupTransport(async () => {
    calls++;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(60000));
        controller.enqueue(new Uint8Array(6000));
        controller.close();
      },
    });
    return new Response(body, { status: 200 });
  });
  await assert.rejects(svc.createCustomer(customer), WeddingSquareCardSetupTransportError);
  assert.equal(calls, 1);
}));
test("UTF-8 multibyte payload is counted in bytes, not JS characters", async () => sandbox(async () => {
  const svc = createWeddingSquareSandboxCardSetupTransport(async () =>
    new Response(JSON.stringify({ customer: {
      id: "cust-1", reference_id: "owner-1", note: "é".repeat(40000),
    } }), { status: 200 }));
  await assert.rejects(svc.createCustomer(customer), WeddingSquareCardSetupTransportError);
}));
