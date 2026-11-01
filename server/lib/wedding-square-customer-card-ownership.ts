/**
 * Pure server-side ownership check for future Wedding Square sandbox enrollment.
 * No browser-supplied customer/card IDs, Square calls, DB writes or entitlements.
 * Future submitter MUST read these records independently from trusted storage
 * and Square sandbox before using them to build/submit a subscription.
 */
export class WeddingSquareOwnershipError extends Error {
  constructor() {
    super("Square customer and card ownership could not be verified.");
    this.name = "WeddingSquareOwnershipError";
  }
}
// Treat provider and persisted identities as opaque exact bytes. In particular,
// trim() alone does not reject embedded ASCII controls or whitespace.
function exactId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    value === value.trim() && !/[\\s\\x00-\\x1f\\x7f]/.test(value);
}

type UserBinding = Readonly<{
  userId: string;
  squareEnvironment: "sandbox" | "production";
  squareMerchantId: string;
  squareCustomerId: string;
}>;
type ProviderCustomer = Readonly<{
  id: string;
  squareMerchantId: string;
}>;
type ProviderCard = Readonly<{
  id: string;
  customerId: string;
}>;
export function verifyWeddingSquareCustomerCardOwnership(input: {
  authenticatedUserId: string;
  expectedSandboxMerchantId: string;
  savedBinding: UserBinding | null;
  providerCustomer: ProviderCustomer | null;
  providerCard: ProviderCard | null;
}) {
  const { authenticatedUserId, expectedSandboxMerchantId, savedBinding, providerCustomer, providerCard } = input;
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
      !exactId(authenticatedUserId) || !exactId(expectedSandboxMerchantId) ||
      !savedBinding || !providerCustomer || !providerCard ||
      savedBinding.squareEnvironment !== "sandbox" ||
      !exactId(savedBinding.userId) || savedBinding.userId !== authenticatedUserId ||
      !exactId(savedBinding.squareMerchantId) ||
      savedBinding.squareMerchantId !== expectedSandboxMerchantId ||
      !exactId(providerCustomer.squareMerchantId) ||
      providerCustomer.squareMerchantId !== expectedSandboxMerchantId ||
      !exactId(savedBinding.squareCustomerId) ||
      !exactId(providerCustomer.id) ||
      savedBinding.squareCustomerId !== providerCustomer.id ||
      !exactId(providerCard.customerId) ||
      providerCard.customerId !== providerCustomer.id ||
      !exactId(providerCard.id)) {
    throw new WeddingSquareOwnershipError();
  }
  return Object.freeze({
    verifiedSquareCustomerId: providerCustomer.id,
    verifiedSquareCardId: providerCard.id,
  });
}
