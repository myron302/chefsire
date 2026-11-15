import { sql } from "drizzle-orm";

/**
 * Part 3b: provider-backed closure evidence. READ-ONLY, and it CANNOT REACH SQUARE.
 *
 * This module writes nothing and performs no network call of its own. Every provider readback goes
 * through the injected {@link SquareReadbackPort}; the only implementation shipped here is
 * {@link REFUSING_SQUARE_READBACK}, which refuses every call. No adapter is wired to it, so nothing
 * in this file can contact Square, in any environment, however it is called. That is the point of
 * landing the decision model before the adapter: the hard part is the ruleset, and it can be
 * reviewed and tested without a single live request.
 *
 * An adapter, when it is written, belongs on the readbacks this repo already has -- see
 * `wedding-square-refund-readback.ts`, `wedding-square-dispute-readback.ts` and their siblings,
 * whose status enums these tables deliberately match. Note what those do: they refuse unless
 * `SQUARE_ENV` is sandbox with live payments off. An adapter here must keep that discipline, and
 * extending it from Wedding to every ledger family is its own reviewed change, not a detail of
 * this one.
 *
 * Why it exists, from GPT's reconciliation design (issue #1486): a quiet local ledger does NOT
 * establish that a member's money is settled. Square's payment and refund listings are eventually
 * consistent, a subscription in a terminal state can still have an unpaid invoice behind it, and a
 * dispute can arrive long after the last payment. So local silence is necessary and never
 * sufficient, and the absence of a provider id is a BLOCKER rather than evidence of no payment.
 *
 * Permanent closure remains hard-disabled (`PERMANENT_CLOSURE_AVAILABLE = false`). Nothing here
 * authorizes closing an account or erasing anything. It answers one question -- may we even
 * consider it -- and its only clear answer still means "necessary, not sufficient".
 *
 * ## The three phases, and why they are three
 *
 * Database row locks must NOT be held across provider network calls: a Square timeout would then
 * hold a member's users row for as long as the request took. So the work is staged, and callers
 * must keep it staged:
 *
 *   1. {@link collectLocalProviderReferences} -- inside a transaction, under the member's lock.
 *      Reads only. Produces the local half of the evidence.
 *   2. {@link reconcileProviderEvidence} -- OUTSIDE any transaction, holding no locks. Talks to the
 *      port, compares, and produces a timestamped manifest.
 *   3. {@link assertProviderEvidenceUsable} -- back inside the final transaction, under locks
 *      again, before anything irreversible. Refuses stale or non-clear evidence.
 */

/** Ledger families that must be covered before any evidence can be called complete. */
export const REQUIRED_PROVIDER_FAMILIES = [
  "MARKETPLACE_ORDERS",
  "WEDDING_SUBSCRIPTIONS",
  "WEDDING_INVOICES",
  "CATERING_PAYMENTS",
  "DRINK_COLLECTION_CHECKOUTS",
  "CREATOR_MEMBERSHIPS",
  "CREATOR_MEMBERSHIP_CHECKOUTS",
] as const;
export type ProviderFamily = (typeof REQUIRED_PROVIDER_FAMILIES)[number];

export type ProviderObjectKind =
  | "payment"
  | "refund"
  | "subscription"
  | "invoice"
  | "dispute"
  | "payout"
  | "payout_entry"
  | "order";

/** One local row's claim about one provider object. */
export type ProviderReference = {
  family: ProviderFamily;
  kind: ProviderObjectKind;
  table: string;
  localRowId: string;
  /** Null where the ledger does not record one; see UNKNOWN_ENVIRONMENT below. */
  environment: string | null;
  merchantId: string | null;
  /** Null means the local row claims a provider object but names none. Always a blocker. */
  providerId: string | null;
  localStatus: string | null;
};

export type ProviderEvidenceVerdict =
  /** A known unsettled obligation. Closure is refused. */
  | "BLOCKED"
  /** Verification is missing, incomplete or unreliable. Also refuses -- never treated as clear. */
  | "UNAVAILABLE"
  /** Local and provider agree that everything found is settled. NECESSARY, NOT SUFFICIENT. */
  | "RECONCILED_LOCAL_AND_PROVIDER";

export type ProviderEvidenceExceptionCode =
  | "UNMAPPED_PROVIDER_REFERENCE"
  | "UNKNOWN_ENVIRONMENT"
  | "UNKNOWN_PROVIDER_STATUS"
  | "PROVIDER_STATUS_NOT_TERMINAL"
  | "PENDING_REFUND"
  | "OPEN_DISPUTE"
  | "SCHEDULED_RENEWAL"
  | "UNSETTLED_PAYOUT"
  | "PROVISIONAL_SETTLEMENT"
  | "AMOUNT_MISMATCH"
  | "PROVIDER_OBJECT_MISSING"
  | "PAGINATION_INCOMPLETE"
  | "READBACK_FAILED"
  | "FAMILY_NOT_COVERED";

export type ProviderEvidenceException = {
  code: ProviderEvidenceExceptionCode;
  family: ProviderFamily | null;
  table: string | null;
  localRowId: string | null;
  providerId: string | null;
  detail: string;
};

export type ProviderEvidenceManifest = {
  verdict: ProviderEvidenceVerdict;
  userId: string;
  /** When the provider was actually read. Evidence is only ever true as of this moment. */
  readbackAt: number;
  expiresAt: number;
  references: ProviderReference[];
  exceptions: ProviderEvidenceException[];
};

/**
 * How long a manifest may be trusted. Short on purpose: a refund, a dispute or a renewal can arrive
 * at any time, so evidence is a snapshot with a shelf life, not a certificate.
 */
export const PROVIDER_EVIDENCE_FRESHNESS_MS = 5 * 60 * 1000;

export class ClosureProviderEvidenceUnavailableError extends Error {
  readonly code = "CLOSURE_PROVIDER_EVIDENCE_UNAVAILABLE";
  constructor(readonly family: ProviderFamily | null, detail: string, cause?: unknown) {
    super(`Cannot verify provider closure evidence${family ? ` (${family})` : ""}: ${detail}`, { cause });
  }
}

/** Thrown by a port that cannot answer. Never caught into a clear verdict. */
export class ProviderReadbackUnavailableError extends Error {
  readonly code = "PROVIDER_READBACK_UNAVAILABLE";
  constructor(detail: string) {
    super(`Square readback unavailable: ${detail}`);
  }
}

/**
 * One page of provider objects. `complete` is the caller's assertion that the cursor was exhausted
 * AND the query window covered the member's whole history -- Square's payout listing defaults to a
 * one-year window, and its list endpoints page, so an adapter that does neither must report false.
 * A false here is an UNAVAILABLE, not a shorter list.
 */
export type ProviderPage<T> = { objects: T[]; complete: boolean };

export type ProviderObjectState = {
  providerId: string;
  /** Raw provider status string. An unrecognized value is an exception, never a pass. */
  status: string;
  amountCents: number | null;
  currency: string | null;
  /** Any refund, dispute, renewal or payout not yet finished, as the provider reports it. */
  hasPendingRefund?: boolean;
  hasOpenDispute?: boolean;
  hasScheduledRenewal?: boolean;
  hasUnsettledPayout?: boolean;
  /**
   * Set by the adapter when the provider may still reverse a status that otherwise looks final --
   * a payout marked PAID whose bank-failure window has not closed. Terminal statuses of
   * {@link PROVISIONALLY_SETTLED_KINDS} are only accepted when this is explicitly false, so an
   * adapter that cannot tell gets a refusal rather than a clear answer.
   */
  settlementProvisional?: boolean;
};

export type SquareReadbackPort = {
  /** Must cover the member's complete history for each kind, with the cursor exhausted. */
  readObjects(
    kind: ProviderObjectKind,
    environment: string,
    merchantId: string,
    providerIds: readonly string[],
  ): Promise<ProviderPage<ProviderObjectState>>;
};

/**
 * The only port in the tree. Every call refuses, so this module cannot reach Square. A production
 * adapter is a later, separately reviewed change; until it exists, callers get UNAVAILABLE, which
 * is the correct answer when nothing can verify the money.
 */
export const REFUSING_SQUARE_READBACK: SquareReadbackPort = {
  async readObjects() {
    throw new ProviderReadbackUnavailableError("no Square adapter is configured in this build");
  },
};

/**
 * Provider statuses that count as finished, per kind. Anything else blocks or is unknown.
 *
 * These were checked against Square's current enum reference rather than written from memory,
 * because a status in the wrong column here is the one error in this file that produces a false
 * CLEAR instead of a false refusal. Three of them are not what they look like:
 *
 * - `payout: PAID` is NOT final on its own. Square's Payouts overview states that a payout
 *   initially marked PAID can transition to FAILED if the seller's bank answers later than Square
 *   expects. So PAID is accepted only when the adapter also reports that the reversal window has
 *   closed -- see `settlementProvisional` on {@link ProviderObjectState}.
 * - `refund: APPROVED` is deliberately NOT terminal. Square has two refund enums: RefundStatus
 *   (PENDING, APPROVED, REJECTED, FAILED) and PaymentRefund.status (PENDING, COMPLETED, REJECTED,
 *   FAILED). Whether APPROVED equals COMPLETED is asked on Square's own forum and not answered, so
 *   it blocks rather than clears until an adapter can show otherwise.
 * - `invoice: PAID` is terminal for the INVOICE and says nothing about its payment. A sandbox
 *   report has an invoice sitting at PAID with both PaymentRefund objects COMPLETED and the full
 *   amount refunded. That is why the invoice source also collects the payment behind it as a
 *   separate object: the invoice's own status cannot be trusted to reflect its refunds.
 */
const TERMINAL_STATUSES: Record<ProviderObjectKind, readonly string[]> = {
  payment: ["COMPLETED", "CANCELED", "FAILED"],
  refund: ["COMPLETED", "REJECTED", "FAILED"],
  subscription: ["CANCELED", "DEACTIVATED"],
  // Square: an invoice cannot be canceled in a terminal state -- PAID, REFUNDED, CANCELED, FAILED.
  invoice: ["PAID", "REFUNDED", "CANCELED", "FAILED"],
  dispute: ["WON", "LOST", "ACCEPTED", "INQUIRY_CLOSED"],
  payout: ["PAID", "FAILED"],
  payout_entry: ["PAID", "FAILED"],
  order: ["COMPLETED", "CANCELED"],
};

/** Every status this module recognizes at all. An unlisted value is UNKNOWN_PROVIDER_STATUS. */
const KNOWN_STATUSES: Record<ProviderObjectKind, readonly string[]> = {
  payment: ["APPROVED", "PENDING", "COMPLETED", "CANCELED", "FAILED"],
  refund: ["PENDING", "APPROVED", "COMPLETED", "REJECTED", "FAILED"],
  subscription: ["ACTIVE", "PAUSED", "PENDING", "CANCELED", "DEACTIVATED"],
  invoice: ["DRAFT", "UNPAID", "SCHEDULED", "PARTIALLY_PAID", "PAID", "PAYMENT_PENDING",
    "PARTIALLY_REFUNDED", "REFUNDED", "CANCELED", "FAILED"],
  dispute: ["INQUIRY_EVIDENCE_REQUIRED", "INQUIRY_PROCESSING", "INQUIRY_CLOSED",
    "EVIDENCE_REQUIRED", "PROCESSING", "WON", "LOST", "ACCEPTED"],
  // Square's PayoutStatus is exactly these three. There is no PENDING.
  payout: ["SENT", "PAID", "FAILED"],
  payout_entry: ["SENT", "PAID", "FAILED"],
  order: ["DRAFT", "OPEN", "COMPLETED", "CANCELED"],
};

/** Kinds whose terminal statuses can still be reversed by the provider after the fact. */
const PROVISIONALLY_SETTLED_KINDS: ReadonlySet<ProviderObjectKind> = new Set<ProviderObjectKind>([
  "payout",
  "payout_entry",
]);

type ReferenceSource = {
  family: ProviderFamily;
  kind: ProviderObjectKind;
  table: string;
  /** SQL selecting id, environment, merchant_id, provider_id, local_status for this member. */
  query: (userId: string) => ReturnType<typeof sql>;
};

/**
 * Where provider references live. Declarative on purpose: coverage is then checkable (see
 * {@link assertProviderFamilyCoverage}) rather than a matter of trusting that every family was
 * remembered. Ledgers that record no environment or merchant yield null for those, which becomes
 * an UNKNOWN_ENVIRONMENT exception rather than a guess at the merchant.
 */
export const PROVIDER_REFERENCE_SOURCES: readonly ReferenceSource[] = [
  {
    family: "MARKETPLACE_ORDERS",
    kind: "payment",
    table: "orders",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             square_payment_id AS provider_id, payment_status AS local_status
        FROM orders
       WHERE (buyer_id = ${userId} OR seller_id = ${userId})
         AND (square_payment_id IS NOT NULL OR payment_status IN ('captured', 'refunded'))`,
  },
  {
    family: "MARKETPLACE_ORDERS",
    kind: "refund",
    table: "orders",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             square_refund_id AS provider_id, payment_status AS local_status
        FROM orders
       WHERE (buyer_id = ${userId} OR seller_id = ${userId})
         AND (square_refund_id IS NOT NULL OR refund_idempotency_key IS NOT NULL)`,
  },
  {
    family: "WEDDING_SUBSCRIPTIONS",
    kind: "subscription",
    table: "wedding_square_subscriptions",
    query: (userId) => sql`
      SELECT id::text AS id, square_environment AS environment, square_merchant_id AS merchant_id,
             square_subscription_id AS provider_id, provider_status AS local_status
        FROM wedding_square_subscriptions
       WHERE user_id = ${userId}`,
  },
  {
    family: "WEDDING_INVOICES",
    kind: "invoice",
    table: "wedding_square_invoice_evidence",
    // The evidence row carries no user_id of its own: it belongs to a member through its
    // subscription. Joining is not an optimization here, it is the only link that exists.
    query: (userId) => sql`
      SELECT e.id::text AS id, e.square_environment AS environment, e.square_merchant_id AS merchant_id,
             e.square_invoice_id AS provider_id,
             CASE WHEN e.payment_revoked_at IS NULL THEN 'paid' ELSE 'revoked' END AS local_status
        FROM wedding_square_invoice_evidence e
        JOIN wedding_square_subscriptions s ON s.id = e.wedding_subscription_id
       WHERE s.user_id = ${userId}`,
  },
  {
    family: "WEDDING_INVOICES",
    kind: "payment",
    table: "wedding_square_invoice_evidence",
    // The payment behind the invoice is its own provider object, with its own refunds and disputes,
    // so a paid invoice is not evidence that its payment is settled.
    query: (userId) => sql`
      SELECT e.id::text AS id, e.square_environment AS environment, e.square_merchant_id AS merchant_id,
             e.square_payment_id AS provider_id,
             CASE WHEN e.payment_revoked_at IS NULL THEN 'paid' ELSE 'revoked' END AS local_status
        FROM wedding_square_invoice_evidence e
        JOIN wedding_square_subscriptions s ON s.id = e.wedding_subscription_id
       WHERE s.user_id = ${userId}`,
  },
  {
    family: "CATERING_PAYMENTS",
    kind: "payment",
    table: "catering_booking_payment_attempts",
    query: (userId) => sql`
      SELECT a.id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             a.square_payment_id AS provider_id, a.state AS local_status
        FROM catering_booking_payment_attempts a
        LEFT JOIN catering_bookings b ON b.id = a.booking_id
       WHERE (a.provider_id = ${userId} OR b.customer_id = ${userId} OR b.provider_id = ${userId})
         AND (a.square_payment_id IS NOT NULL
              OR a.state IN ('pending', 'completed', 'reconciliation_required'))`,
  },
  {
    family: "DRINK_COLLECTION_CHECKOUTS",
    kind: "payment",
    table: "drink_collection_checkout_sessions",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             square_payment_id AS provider_id, status AS local_status
        FROM drink_collection_checkout_sessions
       WHERE user_id = ${userId}
         AND (square_payment_id IS NOT NULL OR square_order_id IS NOT NULL)`,
  },
  {
    family: "CREATOR_MEMBERSHIPS",
    kind: "subscription",
    table: "creator_memberships",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             square_subscription_id AS provider_id, status AS local_status
        FROM creator_memberships
       WHERE (user_id = ${userId} OR creator_user_id = ${userId})
         AND square_subscription_id IS NOT NULL`,
  },
  {
    family: "CREATOR_MEMBERSHIP_CHECKOUTS",
    kind: "payment",
    table: "creator_membership_checkout_sessions",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             square_payment_id AS provider_id, status AS local_status
        FROM creator_membership_checkout_sessions
       WHERE (user_id = ${userId} OR creator_user_id = ${userId})
         AND (square_payment_id IS NOT NULL OR square_order_id IS NOT NULL)`,
  },
];

/**
 * Every required family must have at least one source. Without this, forgetting a ledger would
 * quietly improve the verdict: no references found for a family reads exactly like a settled one.
 */
export function assertProviderFamilyCoverage(): void {
  const covered = new Set(PROVIDER_REFERENCE_SOURCES.map((source) => source.family));
  const missing = REQUIRED_PROVIDER_FAMILIES.filter((family) => !covered.has(family));
  if (missing.length > 0) {
    throw new ClosureProviderEvidenceUnavailableError(
      missing[0],
      `no provider reference source is declared for ${missing.join(", ")}`,
    );
  }
}

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

/**
 * Phase 1. Inside the member's transaction, under their users-row lock. Reads only.
 *
 * A failing or missing ledger throws. A missing table must NEVER read as "this member has no
 * payments there" -- that is the single most dangerous way to get a clear verdict wrong.
 */
export async function collectLocalProviderReferences(tx: any, userId: string): Promise<ProviderReference[]> {
  assertProviderFamilyCoverage();
  const references: ProviderReference[] = [];
  for (const source of PROVIDER_REFERENCE_SOURCES) {
    let rows: any[];
    try {
      rows = rowsOf(await tx.execute(source.query(userId)));
    } catch (cause) {
      throw new ClosureProviderEvidenceUnavailableError(
        source.family,
        `could not read ${source.table}`,
        cause,
      );
    }
    for (const row of rows) {
      const providerId = row.provider_id == null ? null : String(row.provider_id).trim();
      references.push({
        family: source.family,
        kind: source.kind,
        table: source.table,
        localRowId: String(row.id),
        environment: row.environment == null ? null : String(row.environment),
        merchantId: row.merchant_id == null ? null : String(row.merchant_id),
        providerId: providerId ? providerId : null,
        localStatus: row.local_status == null ? null : String(row.local_status),
      });
    }
  }
  return references;
}

function exception(
  code: ProviderEvidenceExceptionCode,
  reference: ProviderReference | null,
  detail: string,
  providerId: string | null = reference?.providerId ?? null,
): ProviderEvidenceException {
  return {
    code,
    family: reference?.family ?? null,
    table: reference?.table ?? null,
    localRowId: reference?.localRowId ?? null,
    providerId,
    detail,
  };
}

/** Which exception codes mean "we could not verify" rather than "we verified something unsettled". */
const UNAVAILABLE_CODES: ReadonlySet<ProviderEvidenceExceptionCode> = new Set<ProviderEvidenceExceptionCode>([
  "UNKNOWN_ENVIRONMENT",
  "UNKNOWN_PROVIDER_STATUS",
  "PROVIDER_OBJECT_MISSING",
  "PAGINATION_INCOMPLETE",
  "READBACK_FAILED",
  "FAMILY_NOT_COVERED",
]);

/**
 * Phase 2. OUTSIDE any transaction, holding no locks, because this calls the provider.
 *
 * Verdict rules, in order of severity: anything we could not verify is UNAVAILABLE; anything we
 * verified as unsettled is BLOCKED; only a complete, fully terminal readback reconciles. Both
 * refusing verdicts are returned rather than thrown, so a caller gets the exception list -- but
 * neither may ever be read as permission.
 */
export async function reconcileProviderEvidence(
  userId: string,
  references: readonly ProviderReference[],
  port: SquareReadbackPort = REFUSING_SQUARE_READBACK,
  now: number = Date.now(),
): Promise<ProviderEvidenceManifest> {
  const exceptions: ProviderEvidenceException[] = [];
  const manifest = (verdict: ProviderEvidenceVerdict): ProviderEvidenceManifest => ({
    verdict,
    userId,
    readbackAt: now,
    expiresAt: now + PROVIDER_EVIDENCE_FRESHNESS_MS,
    references: [...references],
    exceptions,
  });

  try {
    assertProviderFamilyCoverage();
  } catch (error) {
    exceptions.push(exception("FAMILY_NOT_COVERED", null, (error as Error).message));
    return manifest("UNAVAILABLE");
  }

  // Group by what a single readback can answer: one kind, one environment, one merchant.
  type Group = { kind: ProviderObjectKind; environment: string; merchantId: string; refs: ProviderReference[] };
  const groups = new Map<string, Group>();
  for (const reference of references) {
    if (!reference.providerId) {
      // A local row that claims a provider object but names none. Not "no payment" -- unknown.
      exceptions.push(exception("UNMAPPED_PROVIDER_REFERENCE", reference,
        `${reference.table} row ${reference.localRowId} records no provider id (local status ${reference.localStatus ?? "null"})`));
      continue;
    }
    if (!reference.environment || !reference.merchantId) {
      // Without an environment and merchant we cannot even address the right Square account, and
      // guessing one risks reading a different merchant's objects and calling the member settled.
      exceptions.push(exception("UNKNOWN_ENVIRONMENT", reference,
        `${reference.table} row ${reference.localRowId} records no Square environment or merchant, so its ${reference.kind} cannot be addressed`));
      continue;
    }
    const key = `${reference.kind}\u0000${reference.environment}\u0000${reference.merchantId}`;
    const group = groups.get(key);
    if (group) group.refs.push(reference);
    else groups.set(key, { kind: reference.kind, environment: reference.environment, merchantId: reference.merchantId, refs: [reference] });
  }

  for (const group of Array.from(groups.values())) {
    const wanted = group.refs.map((reference: ProviderReference) => reference.providerId as string);
    let page: ProviderPage<ProviderObjectState>;
    try {
      page = await port.readObjects(group.kind, group.environment, group.merchantId, wanted);
    } catch (error) {
      exceptions.push(exception("READBACK_FAILED", group.refs[0],
        `reading ${group.kind} objects from ${group.merchantId} (${group.environment}) failed: ${(error as Error).message}`, null));
      continue;
    }
    if (!page.complete) {
      // A truncated cursor or a default query window means we read part of the history. Part of the
      // history cannot establish settlement.
      exceptions.push(exception("PAGINATION_INCOMPLETE", group.refs[0],
        `the ${group.kind} readback for ${group.merchantId} (${group.environment}) was not exhaustive`, null));
      continue;
    }

    const byId = new Map(page.objects.map((object) => [object.providerId, object]));
    for (const reference of group.refs as ProviderReference[]) {
      const object = byId.get(reference.providerId as string);
      if (!object) {
        exceptions.push(exception("PROVIDER_OBJECT_MISSING", reference,
          `the provider has no ${reference.kind} ${reference.providerId}, so the local row cannot be reconciled`));
        continue;
      }
      const known = KNOWN_STATUSES[reference.kind];
      if (!known.includes(object.status)) {
        exceptions.push(exception("UNKNOWN_PROVIDER_STATUS", reference,
          `${reference.kind} ${reference.providerId} reports an unrecognized status ${object.status}`));
        continue;
      }
      if (!TERMINAL_STATUSES[reference.kind].includes(object.status)) {
        exceptions.push(exception("PROVIDER_STATUS_NOT_TERMINAL", reference,
          `${reference.kind} ${reference.providerId} is ${object.status}`));
      }
      if (
        PROVISIONALLY_SETTLED_KINDS.has(reference.kind) &&
        TERMINAL_STATUSES[reference.kind].includes(object.status) &&
        object.settlementProvisional !== false
      ) {
        // A payout that reads PAID can still come back FAILED, so "looks final" is not final until
        // the adapter says the reversal window has closed. Unknown counts as open.
        exceptions.push(exception("PROVISIONAL_SETTLEMENT", reference,
          `${reference.kind} ${reference.providerId} is ${object.status}, but the provider may still reverse it`));
      }
      if (object.hasPendingRefund) {
        exceptions.push(exception("PENDING_REFUND", reference, `${reference.providerId} has a refund still in flight`));
      }
      if (object.hasOpenDispute) {
        exceptions.push(exception("OPEN_DISPUTE", reference, `${reference.providerId} has an open dispute`));
      }
      if (object.hasScheduledRenewal) {
        exceptions.push(exception("SCHEDULED_RENEWAL", reference, `${reference.providerId} has a renewal still scheduled`));
      }
      if (object.hasUnsettledPayout) {
        exceptions.push(exception("UNSETTLED_PAYOUT", reference, `${reference.providerId} has an unsettled payout`));
      }
    }
  }

  if (exceptions.some((item) => UNAVAILABLE_CODES.has(item.code))) return manifest("UNAVAILABLE");
  if (exceptions.length > 0) return manifest("BLOCKED");
  return manifest("RECONCILED_LOCAL_AND_PROVIDER");
}

export function isProviderEvidenceStale(manifest: ProviderEvidenceManifest, now: number = Date.now()): boolean {
  return now >= manifest.expiresAt;
}

/**
 * Phase 3. Back inside the final transaction, under the member's lock, before anything
 * irreversible. Refuses unless the evidence is this member's, still fresh, clear, and still matches
 * what the ledgers say right now -- new commerce activity since the readback invalidates it.
 */
export async function assertProviderEvidenceUsable(
  tx: any,
  userId: string,
  manifest: ProviderEvidenceManifest,
  now: number = Date.now(),
): Promise<void> {
  if (manifest.userId !== userId) {
    throw new ClosureProviderEvidenceUnavailableError(null, "the evidence was gathered for a different member");
  }
  if (manifest.verdict !== "RECONCILED_LOCAL_AND_PROVIDER") {
    throw new ClosureProviderEvidenceUnavailableError(null, `the evidence verdict is ${manifest.verdict}`);
  }
  if (isProviderEvidenceStale(manifest, now)) {
    throw new ClosureProviderEvidenceUnavailableError(null, "the evidence has expired and must be gathered again");
  }

  // Re-read the ledgers under the lock. Anything added, removed or renamed since the readback means
  // the member transacted while we were deciding, and the decision is void.
  const current = await collectLocalProviderReferences(tx, userId);
  const fingerprint = (references: readonly ProviderReference[]) =>
    references
      .map((reference) => `${reference.table}:${reference.localRowId}:${reference.kind}:${reference.providerId ?? ""}`)
      .sort()
      .join("\n");
  if (fingerprint(current) !== fingerprint(manifest.references)) {
    throw new ClosureProviderEvidenceUnavailableError(
      null,
      "the member's provider-linked records changed after the readback, so the evidence is void",
    );
  }
}
