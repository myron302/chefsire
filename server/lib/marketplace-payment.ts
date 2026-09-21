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

type SquareApiError = { category?: string; code?: string };

const DEFINITIVE_PAYMENT_FAILURE_CODES = new Set([
  "ADDRESS_VERIFICATION_FAILURE", "BAD_EXPIRATION", "BUYER_REFUSED_PAYMENT",
  "CARD_DECLINED", "CARD_DECLINED_CALL_ISSUER", "CARD_EXPIRED",
  "CARD_TOKEN_EXPIRED", "CARD_TOKEN_USED", "CVV_FAILURE", "GENERIC_DECLINE",
  "INSUFFICIENT_FUNDS", "INVALID_ACCOUNT", "INVALID_CARD",
  "INVALID_EXPIRATION", "INVALID_EXPIRATION_DATE", "INVALID_EXPIRATION_YEAR",
  "INVALID_PIN", "INVALID_POSTAL_CODE", "SOURCE_EXPIRED", "SOURCE_USED",
  "VERIFY_AVS_FAILURE", "VERIFY_CVV_FAILURE",
]);

export function getDefinitiveSquarePaymentFailure(error: unknown) {
  const errors = (error as { errors?: SquareApiError[] } | undefined)?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const definitive = errors.every((item) =>
    item.category === "PAYMENT_METHOD_ERROR"
    && Boolean(item.code)
    && DEFINITIVE_PAYMENT_FAILURE_CODES.has(item.code!),
  );
  return definitive ? errors[0]?.code ?? "PAYMENT_METHOD_ERROR" : null;
}

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
    amount === undefined ||
    amount === null ||
    BigInt(amount) !== expectedAmount ||
    refund.amountMoney?.currency !== expectedCurrency
  ) {
    const error = new Error("Square did not return verifiable refund evidence");
    (error as Error & { code: string }).code = "REFUND_UNVERIFIED";
    throw error;
  }
  if (!["PENDING", "COMPLETED", "FAILED", "REJECTED"].includes(refund.status ?? "")) {
    const error = new Error("Square refund outcome is ambiguous");
    (error as Error & { code: string }).code = "REFUND_OUTCOME_AMBIGUOUS";
    throw error;
  }
  return {
    squareRefundId: refund.id,
    providerRefundStatus: refund.status as "PENDING" | "COMPLETED" | "FAILED" | "REJECTED",
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
