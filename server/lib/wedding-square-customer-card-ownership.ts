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
      !authenticatedUserId?.trim() || !expectedSandboxMerchantId?.trim() ||
      !savedBinding || !providerCustomer || !providerCard ||
      savedBinding.squareEnvironment !== "sandbox" ||
      savedBinding.userId !== authenticatedUserId ||
      savedBinding.squareMerchantId !== expectedSandboxMerchantId ||
      providerCustomer.squareMerchantId !== expectedSandboxMerchantId ||
      !savedBinding.squareCustomerId?.trim() ||
      savedBinding.squareCustomerId !== providerCustomer.id ||
      providerCard.customerId !== providerCustomer.id ||
      !providerCard.id?.trim()) {
    throw new WeddingSquareOwnershipError();
  }
  return Object.freeze({
    verifiedSquareCustomerId: providerCustomer.id,
    verifiedSquareCardId: providerCard.id,
  });
}
