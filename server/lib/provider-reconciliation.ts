export class ProviderReconciliationRequiredError<T> extends Error {
  readonly code = "PAYMENT_RECONCILIATION_REQUIRED";

  constructor(
    readonly operation: "capture" | "refund",
    readonly providerEvidence: T,
    options: { cause: unknown },
  ) {
    super(`${operation} succeeded at the provider but local reconciliation is incomplete`, options);
  }
}

/**
 * The caller must durably persist `idempotencyKey` and an in-progress state
 * before invoking this helper. A failed local apply is then explicit and a
 * retry can safely recover the same provider operation with the same key.
 */
export async function executeRecoverableProviderOperation<TProvider, TResult>(options: {
  operation: "capture" | "refund";
  idempotencyKey: string;
  invokeProvider: (idempotencyKey: string) => Promise<TProvider>;
  persistProviderEvidence?: (providerEvidence: TProvider) => Promise<TProvider>;
  applyLocally: (providerEvidence: TProvider) => Promise<TResult>;
}) {
  const providerEvidence = await options.invokeProvider(options.idempotencyKey);
  try {
    const durableEvidence = options.persistProviderEvidence
      ? await options.persistProviderEvidence(providerEvidence)
      : providerEvidence;
    return await options.applyLocally(durableEvidence);
  } catch (cause) {
    throw new ProviderReconciliationRequiredError(
      options.operation,
      providerEvidence,
      { cause },
    );
  }
}
