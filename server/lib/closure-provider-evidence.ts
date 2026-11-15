import { sql } from "drizzle-orm";
import { CLOSURE_BLOCKER_CODES, type ClosureBlockerCode } from "./closure-obligations";

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
  "DRINK_GIFTS",
  "DRINK_COLLECTION_SALES",
  "CREATOR_MEMBERSHIPS",
  "CREATOR_MEMBERSHIP_CHECKOUTS",
  "CREATOR_MEMBERSHIP_SALES",
  "MEAL_PLAN_PURCHASES",
  "SELLER_COMMISSIONS",
  "SELLER_PAYOUTS",
  "SQUARE_MERCHANT_PAYOUTS",
] as const;
export type ProviderFamily = (typeof REQUIRED_PROVIDER_FAMILIES)[number];

/**
 * How a family's obligations can be established at all.
 *
 * - SQUARE_BACKED: the ledger names Square objects, and those must be read back.
 * - INTERNAL_LEDGER: ChefSire's own accounting, with no Square object of its own. It still has to
 *   be inspected -- an unpaid balance blocks closure just as a pending refund does -- but that
 *   inspection belongs to inspectLocalClosureObligations, not here, and inventing a Square object
 *   for it would be worse than admitting it has none.
 * - HYBRID: internal accounting that also references a Square object (a seller payout row naming
 *   the provider payout it was funded from). Both halves are required.
 */
export type EvidenceStrategy = "SQUARE_BACKED" | "INTERNAL_LEDGER" | "HYBRID";

export type FamilyRequirement = {
  strategy: EvidenceStrategy;
  /** Provider object kinds that MUST each have a declared source. Empty for INTERNAL_LEDGER. */
  providerKinds: readonly ProviderObjectKind[];
  /** Local obligation checks that must exist in closure-obligations.ts for this family. */
  localBlockers: readonly ClosureBlockerCode[];
  /** Why this family cannot be fully evidenced yet, if it cannot. Coverage refuses while set. */
  unresolved?: string;
};

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
  /**
   * What the local ledger says the provider object should be worth, and whether it is supposed to
   * say anything at all.
   *
   * `amountExpectation` is DECLARED per source rather than inferred from a null, because those two
   * cases must not be confused: "this ledger records the exact amount and it is missing" is a
   * defect that refuses, while "this object's value is not a single ledger figure" -- an aggregate
   * payout, a partial refund the ledger does not itemize -- is a reviewed decision. Inferring it
   * from a null would silently turn the first into the second the day a column went empty.
   */
  amountExpectation: AmountExpectation;
  expectedAmountCents: number | null;
  expectedCurrency: string | null;
};

/**
 * - required: the ledger records this object's exact value, so it must match the provider's.
 * - not_applicable: the object's value is not a single ledger figure. Each source that claims this
 *   says why, and the claim is reviewable in one place.
 */
export type AmountExpectation = "required" | "not_applicable";

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
  | "PROVISIONAL_SETTLEMENT"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "AMOUNT_UNVERIFIABLE"
  | "LOCAL_PROVIDER_DISAGREEMENT"
  | "CHECK_NOT_PERFORMED"
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
  /**
   * The result of each provider-side check, where PRESENCE of the key is the claim that the check
   * ran and the VALUE is what it found. There is deliberately no separate "which checks I ran"
   * list and no optional boolean flags: with those, `{ checksPerformed: ["refunds"] }` and no
   * result read as "a refund check ran and found nothing", because an absent boolean is falsy.
   * That is the same omission that made a PAID payout look settled, and it is now impossible to
   * express -- a missing key cannot be mistaken for `false`.
   *
   * - refunds: true if a refund is still in flight
   * - disputes: true if a dispute is open
   * - renewals: true if a renewal is still scheduled
   * - settlement: true if the provider may STILL REVERSE this object (a payout marked PAID whose
   *   bank-failure window has not closed), false once it cannot
   */
  checkResults: ProviderCheckResults;
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
 *   expects. So PAID is accepted only when the adapter also reports, through the required
 *   `settlement` check, that the reversal window has closed.
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

/**
 * The provider-side questions an adapter can answer. A terminal status answers only "did this
 * object finish", never "is there anything else attached to it" -- a COMPLETED payment can still
 * have a refund in flight or a dispute opened against it a month later.
 */
export const PROVIDER_CHECKS = ["refunds", "disputes", "renewals", "settlement"] as const;
export type ProviderCheck = (typeof PROVIDER_CHECKS)[number];
/** A key present means the check ran; its value is the finding. See {@link ProviderObjectState}. */
export type ProviderCheckResults = { [K in ProviderCheck]?: boolean };

/** What a true result means, per check. */
const CHECK_FINDINGS: Record<ProviderCheck, { code: ProviderEvidenceExceptionCode; detail: string }> = {
  refunds: { code: "PENDING_REFUND", detail: "has a refund still in flight" },
  disputes: { code: "OPEN_DISPUTE", detail: "has an open dispute" },
  renewals: { code: "SCHEDULED_RENEWAL", detail: "has a renewal still scheduled" },
  settlement: { code: "PROVISIONAL_SETTLEMENT", detail: "may still be reversed by the provider" },
};

/**
 * Which checks must have been performed before a given kind can reconcile. An adapter that omits
 * one gets CHECK_NOT_PERFORMED, which is UNAVAILABLE -- the absence of a finding is not a finding.
 */
const REQUIRED_CHECKS: Record<ProviderObjectKind, readonly ProviderCheck[]> = {
  payment: ["refunds", "disputes"],
  // A refund is itself the object under inspection; its own status is the answer.
  refund: [],
  subscription: ["renewals"],
  invoice: ["refunds"],
  // A dispute's state IS the dispute check.
  dispute: [],
  payout: ["settlement"],
  payout_entry: ["settlement"],
  order: ["refunds", "disputes"],
};

type ReferenceSource = {
  family: ProviderFamily;
  kind: ProviderObjectKind;
  table: string;
  /** Whether this ledger is expected to pin the object's amount. See {@link AmountExpectation}. */
  amountExpectation: AmountExpectation;
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
    amountExpectation: "required",
    table: "orders",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             square_payment_id AS provider_id, payment_status AS local_status,
             ROUND(total_amount::numeric * 100)::int AS expected_amount_cents, 'USD' AS expected_currency
        FROM orders
       WHERE (buyer_id = ${userId} OR seller_id = ${userId})
         AND (square_payment_id IS NOT NULL OR payment_status IN ('captured', 'refunded'))`,
  },
  {
    family: "MARKETPLACE_ORDERS",
    kind: "refund",
    // a partial refund's value is not recorded on the order
    amountExpectation: "not_applicable",
    table: "orders",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             square_refund_id AS provider_id, payment_status AS local_status,
             NULL::int AS expected_amount_cents, NULL::text AS expected_currency
        FROM orders
       WHERE (buyer_id = ${userId} OR seller_id = ${userId})
         AND (square_refund_id IS NOT NULL OR refund_idempotency_key IS NOT NULL)`,
  },
  {
    family: "WEDDING_SUBSCRIPTIONS",
    kind: "subscription",
    // a subscription has no single amount; its invoices carry the money
    amountExpectation: "not_applicable",
    table: "wedding_square_subscriptions",
    query: (userId) => sql`
      SELECT id::text AS id, square_environment AS environment, square_merchant_id AS merchant_id,
             square_subscription_id AS provider_id, provider_status AS local_status,
             NULL::int AS expected_amount_cents, NULL::text AS expected_currency
        FROM wedding_square_subscriptions
       WHERE user_id = ${userId}`,
  },
  {
    family: "WEDDING_INVOICES",
    kind: "invoice",
    amountExpectation: "required",
    table: "wedding_square_invoice_evidence",
    // The evidence row carries no user_id of its own: it belongs to a member through its
    // subscription. Joining is not an optimization here, it is the only link that exists.
    query: (userId) => sql`
      SELECT e.id::text AS id, e.square_environment AS environment, e.square_merchant_id AS merchant_id,
             e.square_invoice_id AS provider_id,
             CASE WHEN e.payment_revoked_at IS NULL THEN 'paid' ELSE 'revoked' END AS local_status,
             e.verified_amount_cents AS expected_amount_cents, e.verified_currency AS expected_currency
        FROM wedding_square_invoice_evidence e
        JOIN wedding_square_subscriptions s ON s.id = e.wedding_subscription_id
       WHERE s.user_id = ${userId}`,
  },
  {
    family: "WEDDING_INVOICES",
    kind: "payment",
    amountExpectation: "required",
    table: "wedding_square_invoice_evidence",
    // The payment behind the invoice is its own provider object, with its own refunds and disputes,
    // so a paid invoice is not evidence that its payment is settled.
    query: (userId) => sql`
      SELECT e.id::text AS id, e.square_environment AS environment, e.square_merchant_id AS merchant_id,
             e.square_payment_id AS provider_id,
             CASE WHEN e.payment_revoked_at IS NULL THEN 'paid' ELSE 'revoked' END AS local_status,
             e.verified_amount_cents AS expected_amount_cents, e.verified_currency AS expected_currency
        FROM wedding_square_invoice_evidence e
        JOIN wedding_square_subscriptions s ON s.id = e.wedding_subscription_id
       WHERE s.user_id = ${userId}`,
  },
  {
    family: "CATERING_PAYMENTS",
    kind: "payment",
    amountExpectation: "required",
    table: "catering_booking_payment_attempts",
    query: (userId) => sql`
      SELECT a.id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             a.square_payment_id AS provider_id, a.state AS local_status,
             a.processor_amount_cents AS expected_amount_cents, a.processor_currency AS expected_currency
        FROM catering_booking_payment_attempts a
        LEFT JOIN catering_bookings b ON b.id = a.booking_id
       WHERE (a.provider_id = ${userId} OR b.customer_id = ${userId} OR b.provider_id = ${userId})
         AND (a.square_payment_id IS NOT NULL
              OR a.state IN ('pending', 'completed', 'reconciliation_required'))`,
  },
  {
    family: "DRINK_COLLECTION_CHECKOUTS",
    kind: "payment",
    // the checkout session does not record the captured amount
    amountExpectation: "not_applicable",
    table: "drink_collection_checkout_sessions",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             square_payment_id AS provider_id, status AS local_status,
             NULL::int AS expected_amount_cents, NULL::text AS expected_currency
        FROM drink_collection_checkout_sessions
       WHERE user_id = ${userId}
         AND (square_payment_id IS NOT NULL OR square_order_id IS NOT NULL)`,
  },
  {
    family: "CREATOR_MEMBERSHIPS",
    kind: "subscription",
    // a subscription has no single amount
    amountExpectation: "not_applicable",
    table: "creator_memberships",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             square_subscription_id AS provider_id, status AS local_status,
             NULL::int AS expected_amount_cents, NULL::text AS expected_currency
        FROM creator_memberships
       WHERE (user_id = ${userId} OR creator_user_id = ${userId})
         AND square_subscription_id IS NOT NULL`,
  },
  {
    family: "CREATOR_MEMBERSHIP_CHECKOUTS",
    kind: "payment",
    // the checkout session does not record the captured amount
    amountExpectation: "not_applicable",
    table: "creator_membership_checkout_sessions",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             square_payment_id AS provider_id, status AS local_status,
             NULL::int AS expected_amount_cents, NULL::text AS expected_currency
        FROM creator_membership_checkout_sessions
       WHERE (user_id = ${userId} OR creator_user_id = ${userId})
         AND (square_payment_id IS NOT NULL OR square_order_id IS NOT NULL)`,
  },
  {
    family: "MEAL_PLAN_PURCHASES",
    kind: "payment",
    amountExpectation: "required",
    table: "meal_plan_purchases",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             provider_payment_id AS provider_id, payment_status AS local_status,
             price_paid_cents AS expected_amount_cents, 'USD' AS expected_currency
        FROM meal_plan_purchases
       WHERE user_id = ${userId}
         AND (provider_payment_id IS NOT NULL OR payment_status IS NOT NULL)`,
  },
  {
    family: "SELLER_PAYOUTS",
    kind: "payout",
    // a provider payout aggregates many seller payouts
    amountExpectation: "not_applicable",
    table: "payouts",
    query: (userId) => sql`
      SELECT id::text AS id, NULL::text AS environment, NULL::text AS merchant_id,
             provider_payout_id AS provider_id, status AS local_status,
             NULL::int AS expected_amount_cents, NULL::text AS expected_currency
        FROM payouts
       WHERE seller_id = ${userId} AND provider_payout_id IS NOT NULL`,
  },
];

/**
 * What each family needs before its obligations can be called established.
 *
 * Checking only "does this family have at least one source" was too weak: a family with a payment
 * source but no refund source would have passed while its refunds went unread. So the requirement
 * is per KIND, and an internal-only family must name the local obligation checks that stand in for
 * a Square object rather than being silently exempt.
 */
export const FAMILY_REQUIREMENTS: Record<ProviderFamily, FamilyRequirement> = {
  MARKETPLACE_ORDERS: {
    strategy: "SQUARE_BACKED",
    providerKinds: ["payment", "refund"],
    localBlockers: ["MARKETPLACE_ORDERS", "MARKETPLACE_PAYMENTS"],
  },
  WEDDING_SUBSCRIPTIONS: {
    strategy: "SQUARE_BACKED",
    providerKinds: ["subscription"],
    localBlockers: ["WEDDING_SUBSCRIPTIONS", "WEDDING_ENROLLMENTS", "WEDDING_CARD_OPERATIONS"],
  },
  WEDDING_INVOICES: {
    strategy: "SQUARE_BACKED",
    // The invoice AND the payment behind it: a PAID invoice has been observed sitting unchanged
    // after its payment was fully refunded.
    providerKinds: ["invoice", "payment"],
    localBlockers: ["WEDDING_SUBSCRIPTIONS"],
  },
  CATERING_PAYMENTS: {
    strategy: "SQUARE_BACKED",
    providerKinds: ["payment"],
    localBlockers: ["CATERING_BOOKINGS", "CATERING_INVOICES", "CATERING_PAYMENT_ATTEMPTS"],
  },
  DRINK_COLLECTION_CHECKOUTS: {
    strategy: "SQUARE_BACKED",
    providerKinds: ["payment"],
    localBlockers: ["DRINK_BUNDLE_CHECKOUTS", "DRINK_COLLECTION_PAYMENTS", "DRINK_COLLECTION_PURCHASES"],
  },
  DRINK_GIFTS: {
    // A gift row names no Square object of its own: it is funded through a checkout session, which
    // DRINK_COLLECTION_CHECKOUTS already reads back. What is left is the gift obligation itself --
    // an unredeemed gift someone paid for is a debt to the recipient, not to the provider.
    strategy: "INTERNAL_LEDGER",
    providerKinds: [],
    localBlockers: ["DRINK_GIFTS"],
  },
  DRINK_COLLECTION_SALES: {
    strategy: "INTERNAL_LEDGER",
    providerKinds: [],
    localBlockers: ["DRINK_COLLECTION_PURCHASES", "CREATOR_PAID_DIGITAL_ACCESS"],
  },
  CREATOR_MEMBERSHIPS: {
    strategy: "SQUARE_BACKED",
    providerKinds: ["subscription"],
    localBlockers: ["CREATOR_MEMBERSHIPS"],
  },
  CREATOR_MEMBERSHIP_CHECKOUTS: {
    strategy: "SQUARE_BACKED",
    providerKinds: ["payment"],
    localBlockers: ["CREATOR_MEMBERSHIP_CHECKOUTS"],
  },
  CREATOR_MEMBERSHIP_SALES: {
    strategy: "INTERNAL_LEDGER",
    providerKinds: [],
    localBlockers: ["CREATOR_MEMBERSHIP_SALES"],
  },
  MEAL_PLAN_PURCHASES: {
    strategy: "SQUARE_BACKED",
    providerKinds: ["payment"],
    localBlockers: ["MEAL_PLAN_PAYMENT_EVIDENCE"],
  },
  SELLER_COMMISSIONS: {
    // Checked against the real table rather than assumed: `commissions` has no Square id at all.
    // It carries payout_id, an internal FK to `payouts`, and that row is where the provider payout
    // is named -- so SELLER_PAYOUTS reads the provider half and this family is internal-only.
    // Inventing a provider source here would mean querying a column that does not exist.
    strategy: "INTERNAL_LEDGER",
    providerKinds: [],
    localBlockers: ["SELLER_COMMISSIONS"],
  },
  SELLER_PAYOUTS: {
    strategy: "HYBRID",
    providerKinds: ["payout"],
    localBlockers: ["SELLER_PAYOUTS"],
  },
  SQUARE_MERCHANT_PAYOUTS: {
    // Money from Square to ChefSire's own bank account, which is NOT the same obligation as money
    // ChefSire owes a seller. Settling one settles nothing about the other.
    strategy: "SQUARE_BACKED",
    providerKinds: ["payout", "payout_entry"],
    localBlockers: [],
    // A merchant payout aggregates many members' transactions, so its existence proves nothing
    // about one member. Tying it to a member needs payout-entry evidence, and ChefSire keeps no
    // payout-entry ledger yet. Until it does, this family cannot be evidenced and coverage
    // refuses -- which is the honest outcome, not a gap to paper over.
    unresolved: "no local payout-entry ledger exists, so a merchant payout cannot be attributed to one member",
  },
};

/**
 * Every required family must be evidenced: each required provider kind needs its own declared
 * source, each named local obligation check must actually exist in closure-obligations.ts, and a
 * family flagged unresolved refuses outright. Without this, forgetting a ledger -- or forgetting
 * one KIND of a ledger -- would quietly improve the verdict, because no references found for a
 * family reads exactly like a settled one.
 */
export function assertProviderFamilyCoverage(): void {
  const declared = new Set(PROVIDER_REFERENCE_SOURCES.map((source) => `${source.family}:${source.kind}`));
  const knownBlockers = new Set<string>(CLOSURE_BLOCKER_CODES);
  for (const family of REQUIRED_PROVIDER_FAMILIES) {
    const requirement = FAMILY_REQUIREMENTS[family];
    if (requirement.unresolved) {
      throw new ClosureProviderEvidenceUnavailableError(family, requirement.unresolved);
    }
    for (const kind of requirement.providerKinds) {
      if (!declared.has(`${family}:${kind}`)) {
        throw new ClosureProviderEvidenceUnavailableError(
          family,
          `no ${kind} reference source is declared for ${family}`,
        );
      }
    }
    if (requirement.strategy !== "SQUARE_BACKED" && requirement.localBlockers.length === 0) {
      throw new ClosureProviderEvidenceUnavailableError(
        family,
        `${family} has no Square object and names no local obligation check, so nothing would inspect it`,
      );
    }
    for (const blocker of requirement.localBlockers) {
      if (!knownBlockers.has(blocker)) {
        throw new ClosureProviderEvidenceUnavailableError(
          family,
          `${family} names the local obligation check ${blocker}, which closure-obligations.ts does not define`,
        );
      }
    }
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
  return collectDeclaredProviderReferences(tx, userId);
}

/**
 * The declared sources, run without the coverage assertion. Exported so the suite can prove every
 * query executes against the real schema even while a family is unresolved; production code calls
 * {@link collectLocalProviderReferences}, which refuses first.
 */
export async function collectDeclaredProviderReferences(tx: any, userId: string): Promise<ProviderReference[]> {
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
        amountExpectation: source.amountExpectation,
        expectedAmountCents: row.expected_amount_cents == null ? null : Number(row.expected_amount_cents),
        expectedCurrency: row.expected_currency == null ? null : String(row.expected_currency),
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
  // Both mean "we did not establish this", not "we established it is fine".
  "CHECK_NOT_PERFORMED",
  "AMOUNT_UNVERIFIABLE",
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
      // The questions a terminal status does not answer. A required check whose key is absent was
      // not performed, and the absence of a finding is not a finding.
      for (const check of REQUIRED_CHECKS[reference.kind]) {
        if (!Object.prototype.hasOwnProperty.call(object.checkResults, check)) {
          exceptions.push(exception("CHECK_NOT_PERFORMED", reference,
            `${reference.kind} ${reference.providerId} was reconciled without a ${check} result`));
        }
      }
      // Every result the adapter DID supply is honoured, required for this kind or not: a reported
      // finding must never be ignored because the kind's required list happens not to mention it.
      for (const check of PROVIDER_CHECKS) {
        if (object.checkResults[check] === true) {
          const finding = CHECK_FINDINGS[check];
          exceptions.push(exception(finding.code, reference, `${reference.providerId} ${finding.detail}`));
        }
      }

      // Local says the money moved, the provider says it did not. Terminality is not settlement:
      // a FAILED payment is a finished attempt, and if the ledger recorded it as captured then one
      // of the two is wrong and neither may be assumed.
      // Only for kinds whose local status describes money moving. A subscription that reads CANCELED
      // is in a normal terminal state and says nothing about a payment, so comparing it this way
      // would invent a contradiction out of two consistent facts.
      const MONEY_KINDS: readonly ProviderObjectKind[] = ["payment", "refund", "invoice", "order"];
      const localClaimsMoneyMoved = MONEY_KINDS.includes(reference.kind) && reference.localStatus != null &&
        ["captured", "completed", "paid", "refunded", "succeeded"].includes(reference.localStatus.toLowerCase());
      if (localClaimsMoneyMoved && ["FAILED", "CANCELED", "REJECTED"].includes(object.status)) {
        exceptions.push(exception("LOCAL_PROVIDER_DISAGREEMENT", reference,
          `the ledger records ${reference.localStatus} but the provider reports ${object.status}`));
      }

      // Amounts. A completed payment for the wrong amount must not pass on its status alone, and a
      // local ledger with no single unambiguous amount for the object cannot verify it at all.
      // No money moved on a failed or canceled object, so there is nothing to compare; and a source
      // that declares the amount not applicable has already been reviewed as such.
      const comparesAmounts = !["FAILED", "CANCELED"].includes(object.status) &&
        reference.amountExpectation === "required";
      if (comparesAmounts) {
        if (reference.expectedAmountCents == null || reference.expectedCurrency == null) {
          exceptions.push(exception("AMOUNT_UNVERIFIABLE", reference,
            `the ledger records no single expected amount for ${reference.kind} ${reference.providerId}`));
        } else if (object.amountCents == null || object.currency == null) {
          exceptions.push(exception("AMOUNT_UNVERIFIABLE", reference,
            `the provider reported no amount for ${reference.kind} ${reference.providerId}`));
        } else {
          if (object.amountCents !== reference.expectedAmountCents) {
            exceptions.push(exception("AMOUNT_MISMATCH", reference,
              `the ledger expects ${reference.expectedAmountCents} but the provider reports ${object.amountCents}`));
          }
          if (object.currency !== reference.expectedCurrency) {
            exceptions.push(exception("CURRENCY_MISMATCH", reference,
              `the ledger expects ${reference.expectedCurrency} but the provider reports ${object.currency}`));
          }
        }
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
 * A stable summary of what the ledgers said, used to tell whether the world moved under a decision.
 *
 * EVERY field, not just identity: a row whose local status, expected amount, currency or Square
 * account changed between the readback and the final gate describes a different obligation, even
 * though it is the same row. Each field is length-prefixed so no combination of values can imitate
 * another (an id ending in a separator, say).
 */
export function providerEvidenceFingerprint(references: readonly ProviderReference[]): string {
  return references
    .map((reference) =>
      [
        reference.family,
        reference.kind,
        reference.table,
        reference.localRowId,
        reference.environment,
        reference.merchantId,
        reference.providerId,
        reference.localStatus,
        reference.amountExpectation,
        reference.expectedAmountCents,
        reference.expectedCurrency,
      ]
        .map((field) => {
          const text = field == null ? "" : String(field);
          return `${text.length}:${text}`;
        })
        .join("|"),
    )
    .sort()
    .join("\n");
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
  if (providerEvidenceFingerprint(current) !== providerEvidenceFingerprint(manifest.references)) {
    throw new ClosureProviderEvidenceUnavailableError(
      null,
      "the member's provider-linked records changed after the readback, so the evidence is void",
    );
  }
}
