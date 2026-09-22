export const VERIFIED_MARKETPLACE_PAYMENT_STATUS = "captured" as const;

// Square timestamps and application-host timestamps are not guaranteed to be
// perfectly synchronized. Capture is synchronous, so a fixed five-minute
// window on either side is ample clock-skew tolerance without an unbounded
// provider search.
export const CAPTURE_RECONCILIATION_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function getCaptureReconciliationWindow(captureAttemptedAt: Date) {
  const attemptedAt = captureAttemptedAt.getTime();
  if (Number.isNaN(attemptedAt)) throw new Error("Invalid capture attempt timestamp");
  return {
    beginTime: new Date(attemptedAt - CAPTURE_RECONCILIATION_CLOCK_SKEW_MS).toISOString(),
    endTime: new Date(attemptedAt + CAPTURE_RECONCILIATION_CLOCK_SKEW_MS).toISOString(),
  };
}

export type SquarePaymentEvidence = {
  id?: string | null;
  referenceId?: string | null;
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

export const DEFAULT_MARKETPLACE_REFUND_REASON = "Customer requested refund";
export const MAX_MARKETPLACE_REFUND_REASON_LENGTH = 192;

export function canonicalizeMarketplaceRefundReason(reason?: string | null) {
  const canonical = reason?.trim() || DEFAULT_MARKETPLACE_REFUND_REASON;
  if (canonical.length > MAX_MARKETPLACE_REFUND_REASON_LENGTH) {
    throw new Error(`Refund reason must be at most ${MAX_MARKETPLACE_REFUND_REASON_LENGTH} characters`);
  }
  return canonical;
}

/** Rebuild a retry exclusively from the durable, immutable attempt snapshot. */
export function buildSquareRefundRequest(attempt: {
  refundIdempotencyKey?: string | null;
  refundAttemptPaymentId?: string | null;
  refundAttemptAmountCents?: number | null;
  refundAttemptCurrency?: string | null;
  refundAttemptReason?: string | null;
}) {
  if (
    !attempt.refundIdempotencyKey ||
    !attempt.refundAttemptPaymentId ||
    !Number.isSafeInteger(attempt.refundAttemptAmountCents) ||
    attempt.refundAttemptAmountCents! <= 0 ||
    attempt.refundAttemptCurrency !== "USD" ||
    !attempt.refundAttemptReason
  ) {
    const error = new Error("Refund attempt lacks an immutable provider request snapshot");
    (error as Error & { code: string }).code = "PAYMENT_RECONCILIATION_REQUIRED";
    throw error;
  }
  return {
    idempotencyKey: attempt.refundIdempotencyKey,
    paymentId: attempt.refundAttemptPaymentId,
    amountMoney: { amount: BigInt(attempt.refundAttemptAmountCents!), currency: "USD" as const },
    reason: attempt.refundAttemptReason,
  };
}

/**
 * Historical `paid` fulfillment or a pre-P1-03 Square ID signals possible
 * payment activity, but is not modern provider verification. Callers must
 * reconcile rather than treating such an `unverified` order as unpaid.
 */
export function hasLegacyPaymentIndicators(order: {
  status?: string | null;
  squarePaymentId?: string | null;
}) {
  return order.status === "paid" || Boolean(order.squarePaymentId);
}

const DEFINITIVE_REFUND_FAILURE_CODES = new Set([
  "INSUFFICIENT_PERMISSIONS_FOR_REFUND",
  "PAYMENT_NOT_REFUNDABLE",
  "PAYMENT_NOT_REFUNDABLE_DUE_TO_DISPUTE",
  "REFUND_AMOUNT_INVALID",
  "REFUND_DECLINED",
  "REFUND_ERROR_PAYMENT_NEEDS_COMPLETION",
]);

export function getDefinitiveSquarePaymentFailure(error: unknown) {
  const errors = (error as { errors?: SquareApiError[] } | undefined)?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  // Square's PAYMENT_METHOD_ERROR category is the provider-supported signal
  // that the submitted instrument/verification was rejected. Requiring every
  // returned error to have this category keeps mixed/unknown responses
  // ambiguous while avoiding a permanently incomplete hand-maintained list.
  const definitive = errors.every((item) => item.category === "PAYMENT_METHOD_ERROR" && Boolean(item.code));
  return definitive ? errors[0]?.code ?? "PAYMENT_METHOD_ERROR" : null;
}

export function getDefinitiveSquareRefundFailure(error: unknown) {
  const errors = (error as { errors?: SquareApiError[] } | undefined)?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const definitive = errors.every((item) =>
    Boolean(item.code) && DEFINITIVE_REFUND_FAILURE_CODES.has(item.code!),
  );
  return definitive ? errors[0]?.code ?? "REFUND_REJECTED" : null;
}

export type SquarePaymentPage = {
  payments?: SquarePaymentEvidence[] | null;
  cursor?: string | null;
};

export async function findSquarePaymentByReference(options: {
  referenceId: string;
  listPage: (cursor?: string) => Promise<SquarePaymentPage>;
}) {
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  do {
    const page = await options.listPage(cursor);
    const matches = (page.payments ?? []).filter((payment) => payment.referenceId === options.referenceId);
    if (matches.length > 1) throw new Error("Square returned duplicate payment references");
    if (matches.length === 1) return matches[0];
    const nextCursor = page.cursor || undefined;
    if (nextCursor && seenCursors.has(nextCursor)) throw new Error("Square payment pagination repeated a cursor");
    if (nextCursor) seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor);
  return null;
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
