export const VERIFIED_MARKETPLACE_PAYMENT_STATUS = "captured" as const;

export type SquarePaymentEvidence = {
  id?: string | null;
  status?: string | null;
  totalMoney?: { amount?: bigint | number | null; currency?: string | null } | null;
  createdAt?: string | null;
};

export type SquareRefundEvidence = {
  id?: string | null;
  status?: string | null;
  amountMoney?: { amount?: bigint | number | null; currency?: string | null } | null;
};

/**
 * Accept only evidence returned by Square for this exact order amount/currency.
 * A client token, local order flag, or fulfillment state is never evidence.
 */
export function requireCompletedSquarePayment(
  payment: SquarePaymentEvidence | undefined,
  expectedAmount: bigint,
  expectedCurrency = "USD",
) {
  const amount = payment?.totalMoney?.amount;
  const capturedAt = payment?.createdAt ? new Date(payment.createdAt) : null;
  if (
    !payment?.id ||
    payment.status !== "COMPLETED" ||
    amount === undefined ||
    amount === null ||
    BigInt(amount) !== expectedAmount ||
    payment.totalMoney?.currency !== expectedCurrency ||
    !capturedAt ||
    Number.isNaN(capturedAt.getTime())
  ) {
    const error = new Error("Square did not return verifiable completed payment evidence");
    (error as Error & { code: string }).code = "PAYMENT_CAPTURE_UNVERIFIED";
    throw error;
  }

  return {
    squarePaymentId: payment.id,
    paymentStatus: VERIFIED_MARKETPLACE_PAYMENT_STATUS,
    paymentProvider: "square" as const,
    providerPaymentStatus: payment.status,
    paymentCapturedAt: capturedAt,
  };
}

export function requireSquareRefundEvidence(
  refund: SquareRefundEvidence | undefined,
  expectedAmount: bigint,
  expectedCurrency = "USD",
) {
  const amount = refund?.amountMoney?.amount;
  if (
    !refund?.id ||
    !["PENDING", "COMPLETED"].includes(refund.status ?? "") ||
    amount === undefined ||
    amount === null ||
    BigInt(amount) !== expectedAmount ||
    refund.amountMoney?.currency !== expectedCurrency
  ) {
    const error = new Error("Square did not return verifiable refund evidence");
    (error as Error & { code: string }).code = "REFUND_UNVERIFIED";
    throw error;
  }
  return {
    squareRefundId: refund.id,
    providerRefundStatus: refund.status as "PENDING" | "COMPLETED",
  };
}

export function isVerifiedMarketplaceEarning(order: {
  paymentStatus?: string | null;
  paymentProvider?: string | null;
  squarePaymentId?: string | null;
  providerPaymentStatus?: string | null;
  paymentCapturedAt?: Date | null;
}) {
  return order.paymentStatus === VERIFIED_MARKETPLACE_PAYMENT_STATUS
    && order.paymentProvider === "square"
    && Boolean(order.squarePaymentId?.trim())
    && order.providerPaymentStatus === "COMPLETED"
    && order.paymentCapturedAt instanceof Date;
}
