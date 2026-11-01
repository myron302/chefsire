import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyWeddingSquareCustomerCardOwnership, WeddingSquareOwnershipError } from "./wedding-square-customer-card-ownership";
const input = {
  authenticatedUserId: "chef-1",
  expectedSandboxMerchantId: "sandbox-merchant",
  savedBinding: { userId: "chef-1", squareEnvironment: "sandbox" as const, squareMerchantId: "sandbox-merchant", squareCustomerId: "customer-1" },
  providerCustomer: { id: "customer-1", squareMerchantId: "sandbox-merchant" },
  providerCard: { id: "card-1", customerId: "customer-1" },
};
async function sandbox(run: () => void) {
  const old = [process.env.SQUARE_ENV, process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED];
  process.env.SQUARE_ENV = "sandbox";
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  try { run(); } finally {
    if (old[0] === undefined) delete process.env.SQUARE_ENV; else process.env.SQUARE_ENV = old[0];
    if (old[1] === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED; else process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = old[1];
  }
}
test("matches trusted owner, sandbox merchant, customer and card", () => sandbox(() => {
  assert.deepEqual(verifyWeddingSquareCustomerCardOwnership(input), {
    verifiedSquareCustomerId: "customer-1", verifiedSquareCardId: "card-1",
  });
}));
test("rejects impersonation, production binding, merchant and card reassignment", () => sandbox(() => {
  const candidates = [
    { authenticatedUserId: "other" },
    { savedBinding: { ...input.savedBinding, squareEnvironment: "production" as const } },
    { savedBinding: { ...input.savedBinding, squareMerchantId: "other" } },
    { savedBinding: { ...input.savedBinding, squareCustomerId: "other" } },
    { providerCustomer: { ...input.providerCustomer, squareMerchantId: "other" } },
    { providerCard: { ...input.providerCard, customerId: "other" } },
    { providerCard: { ...input.providerCard, id: "" } },
    { savedBinding: null },
    { providerCustomer: null },
    { providerCard: null },
  ];
  for (const change of candidates) assert.throws(
    () => verifyWeddingSquareCustomerCardOwnership({ ...input, ...change }),
    WeddingSquareOwnershipError,
  );
}));
test("disabled sandbox rejects even a matching binding", () => {
  const previous = process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  try {
    assert.throws(() => verifyWeddingSquareCustomerCardOwnership(input), WeddingSquareOwnershipError);
  } finally {
    if (previous !== undefined) process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = previous;
  }
});

test("rejects noncanonical matching identities even when every equality check would pass", () => sandbox(() => {
  // A forged/poisoned saved binding and provider evidence can agree byte-for-byte.
  // Equality alone is insufficient if those bytes are not valid opaque IDs.
  for (const bad of [" padded ", "embedded\\nnewline", "embedded\\ttab", "embedded\\u0000nul", "embedded\\u007fdel"]) {
    const cases = [
      {
        authenticatedUserId: bad,
        savedBinding: { ...input.savedBinding, userId: bad },
      },
      {
        expectedSandboxMerchantId: bad,
        savedBinding: { ...input.savedBinding, squareMerchantId: bad },
        providerCustomer: { ...input.providerCustomer, squareMerchantId: bad },
      },
      {
        savedBinding: { ...input.savedBinding, squareCustomerId: bad },
        providerCustomer: { ...input.providerCustomer, id: bad },
        providerCard: { ...input.providerCard, customerId: bad },
      },
      { providerCard: { ...input.providerCard, id: bad } },
    ];
    for (const changed of cases) {
      assert.throws(
        () => verifyWeddingSquareCustomerCardOwnership({ ...input, ...changed }),
        WeddingSquareOwnershipError,
      );
    }
  }
}));

test("rejects malformed identity types without exposing provider values", () => sandbox(() => {
  for (const changed of [
    { authenticatedUserId: null },
    { expectedSandboxMerchantId: 42 },
    { savedBinding: { ...input.savedBinding, userId: null } },
    { savedBinding: { ...input.savedBinding, squareMerchantId: 42 } },
    { savedBinding: { ...input.savedBinding, squareCustomerId: null } },
    { providerCustomer: { ...input.providerCustomer, id: 42 } },
    { providerCustomer: { ...input.providerCustomer, squareMerchantId: null } },
    { providerCard: { ...input.providerCard, customerId: 42 } },
    { providerCard: { ...input.providerCard, id: null } },
  ]) {
    assert.throws(
      () => verifyWeddingSquareCustomerCardOwnership({ ...input, ...changed } as typeof input),
      (error: unknown) => {
        assert.ok(error instanceof WeddingSquareOwnershipError);
        assert.equal(error.message, "Square customer and card ownership could not be verified.");
        return true;
      },
    );
  }
}));
