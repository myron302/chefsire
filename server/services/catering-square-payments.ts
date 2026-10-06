import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  cateringAttemptSquarePayments,
  cateringBookingActivity,
  cateringBookingBilling,
  cateringBookingPaymentAttempts,
  cateringBookingPayments,
  cateringBookings,
  cateringSquareWebhookEvents,
  notifications,
  type CateringAttemptSquarePayment,
  type CateringBookingPaymentAttempt,
} from "@shared/schema";
import {
  CATERING_BILLING_NOT_AVAILABLE_CODE,
  cateringBillingSectionPath,
  cateringInvoiceReference,
} from "@shared/catering-booking-billing";
import { cateringWorkspaceRole } from "@shared/catering-booking-operations";
import {
  CATERING_ATTEMPT_PROVIDER_NOT_READY_CODE,
  CATERING_ATTEMPT_STATE_CODE,
  CATERING_ATTEMPT_UNAVAILABLE_CODE,
  CATERING_SQUARE_COPY,
  CATERING_SQUARE_CURRENCY,
  CATERING_SQUARE_NOTIFICATIONS,
  CATERING_SQUARE_PROCESSOR,
  type CateringReconciliationReason,
} from "@shared/catering-square-payments";
import type { db as Database } from "../db";
import { classifySquareFailure, squareFailureStatus } from "../lib/square-integration";
import {
  SquareSandboxOnlyError,
  cateringSquarePaymentsEnabled,
  cateringSquareSandboxReady,
  type SquareCheckoutApi,
  type SquareOrderFacts,
  type SquarePaymentFacts,
} from "../lib/square-checkout";
import { ownedCateringBooking } from "./catering-booking-access";
import { cateringBillingFacts, cateringBillingDay, cateringInvoiceFactOf } from "./catering-booking-billing-policy";
import { loadLedgerRows, lockCateringBilling } from "./catering-booking-adjustments";
import {
  cateringAttemptMatches,
  decideCateringSettlement,
  deriveCateringSquareAmount,
  evaluateSquareEvidence,
  summarizeConfirmedPayments,
  type ConfirmedSquarePayment,
  type CateringEvidenceVerdict,
} from "./catering-square-payment-policy";

type Executor = typeof Database;

/**
 * Catering Phase 2Q: customer payments through Square's hosted checkout, created under the PROVIDER's own connected account.
 *
 * WHO HOLDS THE MONEY. Nobody at ChefSire. The checkout, its order and the payment all live in the provider's Square account,
 * created and read with the provider's own OAuth credential at their verified merchant and location. ChefSire never uses a
 * platform Square account for Catering, takes no fee, and does not route or hold funds.
 *
 * ONE SETTLEMENT FUNCTION. A browser return, a status poll and a webhook all end in `settleAttempt`, which asks Square for
 * FRESH facts with the provider's credential, judges them against the attempt, and then -- in one transaction under the
 * booking's billing lock -- either credits the ledger or keeps the evidence as reconciliation. Nothing else writes a processor
 * payment, so there is exactly one place where duplicate credit has to be impossible, and it is guarded three times: the attempt
 * row lock and state, the attempt's unique `square_payment_id`, and the ledger's unique `(processor, processor_payment_id)`.
 *
 * LOCK ORDER, identical to Phase 2L/2P billing: the booking's advisory billing lock, then the booking row, then the attempt row.
 * No network call is ever made while a lock is held.
 */

export type CateringSquareConnections = {
  getReadyConnectedCredentials(userId: string): Promise<{ accessToken: string; merchantId: string; locationId: string; currency: string; credentialGeneration: string } | null>;
  /** Persisted state only (no network, no token): whether a credential is on file for the user, and for which merchant. Throws if it cannot be read. */
  storedCredentialState(userId: string): Promise<{ present: boolean; merchantId: string | null }>;
  reportAuthorizationFailure(userId: string, credentialGeneration: string): Promise<void>;
};

export type CateringSquareLogger = { warn(event: string, fields: Record<string, string | number | boolean | null>): void };

export type CateringSquarePaymentsDeps = {
  db: Executor;
  connections: CateringSquareConnections;
  checkout: SquareCheckoutApi;
  now?: () => Date;
  /** Whether NEW Square checkouts may be offered and created: sandbox AND webhook configured. Overridable by tests; production wiring never overrides it. */
  enabled?: () => boolean;
  /**
   * Whether existing attempts may still be read, settled and cleaned up: sandbox only. Deliberately weaker than `enabled`: missing webhook
   * configuration stops new checkouts, but must never stop closing a live link or recognising money that already moved. When a test overrides
   * `enabled` and not this, `enabled` governs both.
   */
  sandboxReady?: () => boolean;
  appBaseUrl?: () => string | null;
  /** Minimum gap between two status-triggered Square reads of one attempt. */
  pollIntervalMs?: number;
  log?: CateringSquareLogger;
  notify?: (userId: string, notification: { type: string; title: string; message: string; linkUrl: string }) => Promise<void>;
};

export type CreatePaymentResult =
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "unavailable" }
  | { kind: "refused"; status: number; message: string; code: string }
  | { kind: "ok"; attempt: CateringBookingPaymentAttempt; reused: boolean };

export type SettleOutcome =
  | { outcome: "completed"; attempt: CateringBookingPaymentAttempt }
  | { outcome: "reconciliation_required"; attempt: CateringBookingPaymentAttempt }
  | { outcome: "already_settled"; attempt: CateringBookingPaymentAttempt }
  | { outcome: "awaiting" | "processing" | "cancelled" | "no_checkout"; attempt: CateringBookingPaymentAttempt }
  | { outcome: "rejected"; code: string; attempt: CateringBookingPaymentAttempt }
  | { outcome: "unavailable"; reason: string; attempt: CateringBookingPaymentAttempt }
  | { outcome: "not_found" };

export type SquareWebhookInput = { eventId: string; eventType: string; merchantId: string | null; orderId: string | null; paymentId: string | null };
export type WebhookResult =
  | { kind: "duplicate" }
  | { kind: "in_flight" }
  | { kind: "ignored"; reason: string }
  | { kind: "processed"; outcome: SettleOutcome["outcome"] }
  | { kind: "retry"; reason: string };

const WEBHOOK_EVENT_TYPES = new Set(["payment.created", "payment.updated", "order.created", "order.updated"]);
/** How many ordinary (non-reconciliation) attempts a billing view carries; unresolved reconciliations are never subject to it. */
export const ATTEMPT_HISTORY_LIMIT = 50;
const STALE_PROCESSING_MS = 2 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

const OPEN: readonly string[] = ["creating", "pending"];
/** Locally terminal states whose Square payment link may still be live until Square confirms otherwise. */
const CLOSED_WITH_LINK_STATES: readonly string[] = ["cancelled", "superseded", "expired"];
const CONSUMED: readonly string[] = ["completed", "reconciliation_required"];

export function createCateringSquarePayments(deps: CateringSquarePaymentsDeps) {
  const { db, connections, checkout } = deps;
  const now = deps.now ?? (() => new Date());
  const enabled = deps.enabled ?? cateringSquarePaymentsEnabled;
  const sandboxReady = deps.sandboxReady ?? (deps.enabled ?? cateringSquareSandboxReady);
  const log: CateringSquareLogger = deps.log ?? { warn: (event, fields) => console.warn(JSON.stringify({ event, ...fields })) };
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const appBaseUrl = deps.appBaseUrl ?? (() => (process.env.APP_BASE_URL?.trim() || process.env.CLIENT_URL?.trim() || null));
  const notify = deps.notify ?? (async (userId, notification) => {
    await db.insert(notifications).values({ userId, type: notification.type, title: notification.title, message: notification.message, linkUrl: notification.linkUrl }).catch(() => undefined);
  });

  /* --------------------------------------------------------------------------------------------------------- *
   * Shared reads under the billing lock
   * --------------------------------------------------------------------------------------------------------- */

  async function lockedBooking(tx: Executor, bookingId: string) {
    await tx.execute(sql`SELECT id FROM catering_bookings WHERE id = ${bookingId} FOR UPDATE`);
    const [booking] = await tx.select({
      status: cateringBookings.status, agreedPrice: cateringBookings.agreedPrice, currency: cateringBookings.currency,
      providerId: cateringBookings.providerId, customerId: cateringBookings.customerId,
    }).from(cateringBookings).where(eq(cateringBookings.id, bookingId)).limit(1);
    return booking;
  }

  async function lockedFacts(tx: Executor, bookingId: string, booking: { status: string; agreedPrice: string | null; currency: string; providerId: string }) {
    const [terms] = await tx.select().from(cateringBookingBilling).where(eq(cateringBookingBilling.bookingId, bookingId)).limit(1);
    const rows = await loadLedgerRows(tx, bookingId);
    const asOfDate = await cateringBillingDay(tx, booking.providerId, now());
    return { facts: cateringBillingFacts({ booking, terms, invoices: rows.invoices, payments: rows.payments, adjustments: rows.adjustments, asOfDate }), rows, asOfDate };
  }

  async function attemptById(executor: Executor, attemptId: string) {
    const [attempt] = await executor.select().from(cateringBookingPaymentAttempts).where(eq(cateringBookingPaymentAttempts.id, attemptId)).limit(1);
    return attempt as CateringBookingPaymentAttempt | undefined;
  }

  function squareFailureDisposition(error: unknown): "provider_credential_invalid" | "definitive" | "uncertain" {
    const failure = classifySquareFailure(error);
    if (failure === "provider_credential_invalid") return "provider_credential_invalid";
    if (failure === "application_auth") return "definitive";
    const status = squareFailureStatus(error);
    // A 4xx that is not a timeout or rate limit means Square answered and refused: nothing was created. Everything else (timeouts,
    // network faults, 5xx, rate limits, a 2xx we could not read) is UNCERTAIN: Square may or may not have created the checkout.
    if (status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429) return "definitive";
    return "uncertain";
  }

  /* --------------------------------------------------------------------------------------------------------- *
   * Create
   * --------------------------------------------------------------------------------------------------------- */

  async function createPayment(input: { bookingId: string; invoiceId: string; userId: string }): Promise<CreatePaymentResult> {
    if (!enabled()) return { kind: "unavailable" };
    const booking = await ownedCateringBooking(input.bookingId, input.userId, db);
    if (!booking) return { kind: "not_found" };
    // CUSTOMER ONLY. The role comes from the persisted booking, never from the request, so a provider cannot pay as the customer.
    if (cateringWorkspaceRole(booking, input.userId) !== "customer") return { kind: "forbidden" };

    // The provider's CURRENT verified credential, merchant and card-capable location. Fetched before any lock: it may call Square.
    const credentials = await connections.getReadyConnectedCredentials(booking.providerId);
    if (!credentials || credentials.currency !== CATERING_SQUARE_CURRENCY) {
      return { kind: "refused", status: 409, code: CATERING_ATTEMPT_PROVIDER_NOT_READY_CODE, message: CATERING_SQUARE_COPY.notReady };
    }

    const prepared = await db.transaction(async (tx: Executor) => {
      await lockCateringBilling(tx, booking.id);
      const locked = await lockedBooking(tx, booking.id);
      if (!locked || locked.customerId !== input.userId) return { kind: "not_found" } as const;
      const { facts, rows } = await lockedFacts(tx, booking.id, locked);
      const invoiceRow = rows.invoices.find((invoice) => invoice.id === input.invoiceId);
      // An invoice that is not on THIS booking is indistinguishable from one that does not exist.
      if (!invoiceRow) return { kind: "not_found" } as const;
      // The amount is DERIVED here, under the same locks every ledger write takes. No client figure exists to consult.
      const decision = deriveCateringSquareAmount({ invoice: cateringInvoiceFactOf(invoiceRow), facts });
      if (!decision.ok) {
        const code = decision.code === "booking_cancelled" ? CATERING_BILLING_NOT_AVAILABLE_CODE : CATERING_ATTEMPT_STATE_CODE;
        return { kind: "refused", status: 409, code, message: decision.message } as const;
      }
      const wanted = { amountCents: decision.amountCents, currency: decision.currency, merchantId: credentials.merchantId, locationId: credentials.locationId };

      const open = await tx.select().from(cateringBookingPaymentAttempts)
        .where(and(eq(cateringBookingPaymentAttempts.invoiceId, input.invoiceId), inArray(cateringBookingPaymentAttempts.state, [...OPEN])));
      const compatible = open.find((attempt: CateringBookingPaymentAttempt) => attempt.customerId === input.userId && cateringAttemptMatches(attempt, wanted));
      if (compatible) return { kind: "ok", attempt: compatible as CateringBookingPaymentAttempt, reused: true, superseded: [] } as const;

      // The open checkout is for a different amount (or another customer's, or another account): close it so the invoice has one.
      // Its Square link is deleted best-effort below; a payment that still arrives on it is recognised by settlement.
      const superseded: CateringBookingPaymentAttempt[] = [];
      for (const stale of open) {
        const [closed] = await tx.update(cateringBookingPaymentAttempts)
          .set({ state: "superseded", closedAt: now(), updatedAt: now() })
          .where(and(eq(cateringBookingPaymentAttempts.id, stale.id), inArray(cateringBookingPaymentAttempts.state, [...OPEN]))).returning();
        if (closed) superseded.push(closed as CateringBookingPaymentAttempt);
      }
      const id = randomUUID();
      const [created] = await tx.insert(cateringBookingPaymentAttempts).values({
        id,
        bookingId: booking.id,
        invoiceId: input.invoiceId,
        customerId: input.userId,
        providerId: locked.providerId,
        processor: CATERING_SQUARE_PROCESSOR,
        processorEnvironment: "sandbox",
        merchantId: credentials.merchantId,
        locationId: credentials.locationId,
        currency: decision.currency,
        amountCents: decision.amountCents,
        // Persisted BEFORE the Square call and sent as its idempotency key, so a retry after an uncertain result resumes this
        // same checkout rather than creating another.
        idempotencyKey: `chefsire-cat-${id}`,
        state: "creating",
      }).returning();
      return { kind: "ok", attempt: created as CateringBookingPaymentAttempt, reused: false, superseded } as const;
    });

    if (prepared.kind === "not_found") return { kind: "not_found" };
    if (prepared.kind === "refused") return prepared;
    // The superseded checkouts are already closed locally; their Square links are removed (and the removal recorded only once Square confirms it).
    if (prepared.superseded.length > 0) await sweepClosedLinks(booking.id);

    let attempt = prepared.attempt;
    if (attempt.state === "creating") {
      const resumed = await completeCreation(attempt, credentials, booking.id);
      if (resumed.kind === "unavailable") return { kind: "unavailable" };
      attempt = resumed.attempt;
    }
    return { kind: "ok", attempt, reused: prepared.reused };
  }

  /** Asks Square to create the checkout under the provider's credential, then records it. Safe to repeat: the idempotency key is fixed. */
  async function completeCreation(
    attempt: CateringBookingPaymentAttempt,
    credentials: { accessToken: string; credentialGeneration: string },
    bookingId: string,
  ): Promise<{ kind: "ok"; attempt: CateringBookingPaymentAttempt } | { kind: "unavailable" }> {
    let link;
    try {
      const baseUrl = appBaseUrl();
      link = await checkout.createPaymentLink(credentials.accessToken, {
        idempotencyKey: attempt.idempotencyKey,
        locationId: attempt.locationId,
        referenceId: attempt.id,
        itemName: await checkoutItemName(attempt),
        amountCents: attempt.amountCents,
        currency: attempt.currency,
        redirectUrl: baseUrl ? `${baseUrl.replace(/\/$/, "")}${cateringBillingSectionPath("customer", bookingId).replace("#", `?squareAttempt=${attempt.id}#`)}` : null,
      });
    } catch (error) {
      if (error instanceof SquareSandboxOnlyError) return { kind: "unavailable" };
      const disposition = squareFailureDisposition(error);
      if (disposition === "uncertain") {
        // Square may or may not have created it. Leave the attempt `creating`: the customer's retry resumes it with the same key.
        log.warn("catering_square_checkout_uncertain", { attemptId: attempt.id, errorName: error instanceof Error ? error.name : "unknown" });
        return { kind: "ok", attempt };
      }
      if (disposition === "provider_credential_invalid") await connections.reportAuthorizationFailure(attempt.providerId, credentials.credentialGeneration).catch(() => undefined);
      const [failed] = await db.update(cateringBookingPaymentAttempts)
        .set({ state: "failed", failureCode: disposition === "provider_credential_invalid" ? "provider_credential_rejected" : "square_refused", closedAt: now(), updatedAt: now() })
        .where(and(eq(cateringBookingPaymentAttempts.id, attempt.id), eq(cateringBookingPaymentAttempts.state, "creating"))).returning();
      return { kind: "ok", attempt: (failed as CateringBookingPaymentAttempt | undefined) ?? (await attemptById(db, attempt.id)) ?? attempt };
    }

    const [pending] = await db.update(cateringBookingPaymentAttempts)
      .set({ state: "pending", squarePaymentLinkId: link.paymentLinkId, squareOrderId: link.orderId, checkoutUrl: link.url, updatedAt: now() })
      .where(and(eq(cateringBookingPaymentAttempts.id, attempt.id), eq(cateringBookingPaymentAttempts.state, "creating"))).returning();
    if (pending) return { kind: "ok", attempt: pending as CateringBookingPaymentAttempt };
    // Another request resumed it first, or it was closed while Square was creating it. Report what is true now.
    let current = (await attemptById(db, attempt.id)) ?? attempt;
    if ((current.state === "superseded" || current.state === "cancelled") && !current.squarePaymentLinkId) {
      // Closed while Square was creating it. Keep the link and order it produced ON the closed attempt, so a payment that still lands on that
      // link is recognised by settlement, and so the link can be removed and that removal confirmed.
      const [kept] = await db.update(cateringBookingPaymentAttempts)
        .set({ squarePaymentLinkId: link.paymentLinkId, squareOrderId: link.orderId, updatedAt: now() })
        .where(and(eq(cateringBookingPaymentAttempts.id, attempt.id), inArray(cateringBookingPaymentAttempts.state, ["superseded", "cancelled"]))).returning();
      current = (kept as CateringBookingPaymentAttempt | undefined) ?? current;
      await sweepClosedLinks(bookingId);
    }
    return { kind: "ok", attempt: current };
  }

  async function checkoutItemName(attempt: CateringBookingPaymentAttempt): Promise<string> {
    const rows = await db.execute(sql`SELECT invoice_number FROM catering_booking_invoices WHERE id = ${attempt.invoiceId}`);
    const number = Number((rows as unknown as { rows: { invoice_number: number }[] }).rows?.[0]?.invoice_number ?? 0);
    return number > 0 ? `Catering invoice ${cateringInvoiceReference(attempt.bookingId, number)}` : "Catering invoice";
  }

  /**
   * Removes the Square payment links of CLOSED attempts (cancelled or superseded) whose removal Square has not yet confirmed.
   *
   * Best effort and idempotent. It never decides whether an attempt is closed -- that is already settled, locally and authoritatively, in
   * the transaction that closed it -- so a Square outage cannot undo a cancellation. `square_link_closed_at` is written ONLY after Square
   * confirms the link is gone (a delete, or a 404 saying it is already absent); a failure leaves it NULL so the next sweep retries and
   * nothing ever claims a closure Square did not confirm. If money lands on a link that could not be removed in time, settlement still
   * recognises it and routes it to reconciliation.
   */
  async function sweepClosedLinks(bookingId: string, options: { force?: boolean } = {}): Promise<number> {
    if (!sandboxReady()) return 0;
    // The DURABLE external-link state is `square_link_closed_at`, deliberately separate from the attempt's business state: a locally
    // terminal attempt (cancelled, superseded, expired) whose link Square has not confirmed gone still needs work, whatever its state says.
    // Each attempt is CLAIMED atomically with exponential backoff (30s, 60s, ... capped at 15 min) so concurrent sweeps share one Square call
    // and an outage is not hammered -- but the claims never stop while the link is unconfirmed.
    // The overwhelmingly common case has nothing to do, and a plain read must stay a read: one lock-free SELECT decides, before any UPDATE.
    const [due] = await db.select({ id: cateringBookingPaymentAttempts.id }).from(cateringBookingPaymentAttempts).where(and(
      eq(cateringBookingPaymentAttempts.bookingId, bookingId),
      inArray(cateringBookingPaymentAttempts.state, [...CLOSED_WITH_LINK_STATES]),
      sql`${cateringBookingPaymentAttempts.squarePaymentLinkId} IS NOT NULL AND ${cateringBookingPaymentAttempts.squareLinkClosedAt} IS NULL`,
    )).limit(1);
    if (!due) return 0;
    const at = now();
    const claimed = await db.update(cateringBookingPaymentAttempts)
      .set({ squareLinkCloseAttempts: sql`${cateringBookingPaymentAttempts.squareLinkCloseAttempts} + 1`, squareLinkCloseAttemptedAt: at })
      .where(and(
        eq(cateringBookingPaymentAttempts.bookingId, bookingId),
        inArray(cateringBookingPaymentAttempts.state, [...CLOSED_WITH_LINK_STATES]),
        sql`${cateringBookingPaymentAttempts.squarePaymentLinkId} IS NOT NULL AND ${cateringBookingPaymentAttempts.squareLinkClosedAt} IS NULL`,
        // `force` is for a caller that is about to discard the credential and so cannot wait out the backoff.
        options.force ? sql`true` : sql`(${cateringBookingPaymentAttempts.squareLinkCloseAttemptedAt} IS NULL OR ${cateringBookingPaymentAttempts.squareLinkCloseAttemptedAt} + make_interval(secs => least(900, 30 * power(2, greatest(${cateringBookingPaymentAttempts.squareLinkCloseAttempts} - 1, 0)))) <= ${at})`,
      )).returning() as CateringBookingPaymentAttempt[];
    let confirmed = 0;
    for (const attempt of claimed) {
      const credentials = await connections.getReadyConnectedCredentials(attempt.providerId).catch(() => null);
      if (!credentials || credentials.merchantId !== attempt.merchantId) { log.warn("catering_square_link_close_deferred", { attemptId: attempt.id }); continue; }
      try {
        await checkout.deletePaymentLink(credentials.accessToken, attempt.squarePaymentLinkId!);
      } catch (error) {
        // Square saying the link does not exist is a confirmation that it is gone; anything else is unconfirmed.
        if (squareFailureStatus(error) !== 404) { log.warn("catering_square_link_delete_failed", { attemptId: attempt.id, errorName: error instanceof Error ? error.name : "unknown" }); continue; }
      }
      await db.update(cateringBookingPaymentAttempts).set({ squareLinkClosedAt: now() })
        .where(and(eq(cateringBookingPaymentAttempts.id, attempt.id), sql`${cateringBookingPaymentAttempts.squareLinkClosedAt} IS NULL`));
      confirmed += 1;
    }
    return confirmed;
  }

  /* --------------------------------------------------------------------------------------------------------- *
   * Settlement: the ONE place a processor payment is recognised
   * --------------------------------------------------------------------------------------------------------- */

  async function fetchEvidence(attempt: CateringBookingPaymentAttempt, accessToken: string): Promise<{ order: SquareOrderFacts; payments: SquarePaymentFacts[] }> {
    const order = await checkout.retrieveOrder(accessToken, attempt.squareOrderId!);
    const payments: SquarePaymentFacts[] = [];
    for (const paymentId of order.paymentIds) payments.push(await checkout.retrievePayment(accessToken, paymentId));
    return { order, payments };
  }

  /**
   * Webhook, poll and retry all converge here. Reads FRESH Square state with the provider's credential, judges it against the
   * attempt, and writes the outcome in one transaction. Idempotent and safe to run concurrently with itself.
   */
  async function settleAttempt(attemptId: string): Promise<SettleOutcome> {
    const first = await attemptById(db, attemptId);
    if (!first) return { outcome: "not_found" };
    if (!sandboxReady()) return { outcome: "unavailable", reason: "sandbox_only", attempt: first };
    if (!first.squareOrderId) return { outcome: "no_checkout", attempt: first };

    // An attempt that already consumed a payment is not finished with: Square may show MORE completed payments on the same order later,
    // and those are money that moved too. A consumed attempt's LOCAL state proves nothing about Square: when fresh evidence cannot be read, the
    // answer is `unavailable` (retryable), never `already_settled`. Only evidence that WAS read and holds nothing new is `already_settled`.
    const consumed = CONSUMED.includes(first.state);
    const unavailable = (reason: "sandbox_only" | "connection_not_ready" | "merchant_changed" | "square_unreachable"): SettleOutcome => ({ outcome: "unavailable", reason, attempt: first });
    const credentials = await connections.getReadyConnectedCredentials(first.providerId);
    if (!credentials) return unavailable("connection_not_ready");
    // The attempt was created for ONE merchant. A connection that now belongs to another merchant cannot see (and must never be
    // used to judge) this attempt's order.
    if (credentials.merchantId !== first.merchantId) return unavailable("merchant_changed");

    let verdict: CateringEvidenceVerdict;
    try {
      const { order, payments } = await fetchEvidence(first, credentials.accessToken);
      verdict = evaluateSquareEvidence({ attemptId: first.id, squareOrderId: first.squareOrderId, locationId: first.locationId, amountCents: first.amountCents, currency: first.currency }, order, payments);
    } catch (error) {
      if (error instanceof SquareSandboxOnlyError) return unavailable("sandbox_only");
      if (classifySquareFailure(error) === "provider_credential_invalid") {
        await connections.reportAuthorizationFailure(first.providerId, credentials.credentialGeneration).catch(() => undefined);
      }
      log.warn("catering_square_evidence_unavailable", { attemptId: first.id, errorName: error instanceof Error ? error.name : "unknown" });
      return unavailable("square_unreachable");
    }

    if (consumed) {
      // Only a COMPLETED payment we have not yet recorded matters here; every other verdict leaves the settled attempt exactly as it is.
      if (verdict.kind !== "confirmed") return { outcome: "already_settled", attempt: first };
      const audited = await recordAdditionalPayments(first.id, verdict.payments);
      if (audited.changed) await notifyReconciliation(audited.attempt);
      return audited.changed ? { outcome: "reconciliation_required", attempt: audited.attempt } : { outcome: "already_settled", attempt: audited.attempt };
    }

    if (verdict.kind === "rejected") {
      log.warn("catering_square_evidence_rejected", { attemptId: first.id, code: verdict.code });
      return { outcome: "rejected", code: verdict.code, attempt: (await attemptById(db, first.id)) ?? first };
    }
    if (verdict.kind === "awaiting" || verdict.kind === "processing") {
      await db.update(cateringBookingPaymentAttempts).set({ lastCheckedAt: now() }).where(eq(cateringBookingPaymentAttempts.id, first.id));
      return { outcome: verdict.kind, attempt: (await attemptById(db, first.id)) ?? first };
    }
    if (verdict.kind === "cancelled") {
      await db.update(cateringBookingPaymentAttempts)
        .set({ state: "cancelled", closedAt: now(), updatedAt: now(), lastCheckedAt: now() })
        .where(and(eq(cateringBookingPaymentAttempts.id, first.id), inArray(cateringBookingPaymentAttempts.state, [...OPEN])));
      return { outcome: "cancelled", attempt: (await attemptById(db, first.id)) ?? first };
    }

    // CONFIRMED: Square says a COMPLETED payment exists for exactly this attempt's order.
    const result = await recordConfirmedPayment(first.id, verdict);
    if (result.kind === "completed") await notifyCompleted(result.attempt);
    if (result.kind === "reconciliation" || result.kind === "additional") await notifyReconciliation(result.attempt);
    if (result.kind === "duplicate") {
      log.warn("catering_square_payment_already_consumed", { attemptId: first.id });
      return { outcome: "rejected", code: "payment_already_consumed", attempt: result.attempt };
    }
    if (result.kind === "completed") return { outcome: "completed", attempt: result.attempt };
    if (result.kind === "reconciliation" || result.kind === "additional") return { outcome: "reconciliation_required", attempt: result.attempt };
    return { outcome: "already_settled", attempt: result.attempt };
  }

  type Confirmed = Extract<CateringEvidenceVerdict, { kind: "confirmed" }>;

  /** Writes one evidence row per completed Square payment. Idempotent: a payment already recorded (by anyone) is left exactly as it is. */
  async function insertPaymentEvidence(tx: Executor, attemptId: string, payments: readonly ConfirmedSquarePayment[]) {
    for (const payment of payments) {
      await tx.insert(cateringAttemptSquarePayments).values({
        attemptId, squarePaymentId: payment.paymentId, amountCents: payment.amountCents, tipCents: payment.tipCents, currency: payment.currency,
        squareCreatedAt: payment.createdAt, squareUpdatedAt: payment.updatedAt, completedAt: payment.completedAt,
      }).onConflictDoNothing({ target: cateringAttemptSquarePayments.squarePaymentId });
    }
  }

  /** The evidence rows of an attempt, read back (so every summary is computed from what was PERSISTED, not from what was in memory). */
  async function paymentEvidenceOf(executor: Executor, attemptId: string): Promise<CateringAttemptSquarePayment[]> {
    return executor.select().from(cateringAttemptSquarePayments).where(eq(cateringAttemptSquarePayments.attemptId, attemptId))
      .orderBy(asc(cateringAttemptSquarePayments.completedAt), asc(cateringAttemptSquarePayments.squarePaymentId)) as Promise<CateringAttemptSquarePayment[]>;
  }

  const evidenceSummary = (rows: readonly CateringAttemptSquarePayment[]) => summarizeConfirmedPayments(rows.map((row) => ({
    paymentId: row.squarePaymentId, amountCents: row.amountCents, tipCents: row.tipCents, currency: row.currency,
    createdAt: row.squareCreatedAt, updatedAt: row.squareUpdatedAt, completedAt: row.completedAt,
  })));

  /**
   * THE ATOMIC LEDGER CREDIT.
   *
   * One transaction: billing lock, booking row, attempt row; recompute the CURRENT payable from the locked ledger; then either
   * insert the processor payment and complete the attempt (and write the activity row) together, or keep the Square evidence on
   * the attempt as `reconciliation_required`. EVERY completed Square payment is persisted as its own evidence row in the same commit,
   * before the attempt can become terminal. A concurrent webhook/poll waits on the attempt row, then finds it consumed.
   */
  async function recordConfirmedPayment(attemptId: string, confirmed: Confirmed): Promise<
    { kind: "completed" | "reconciliation" | "additional" | "already" | "duplicate"; attempt: CateringBookingPaymentAttempt }
  > {
    return db.transaction(async (tx: Executor) => {
      const seen = await attemptById(tx, attemptId);
      if (!seen) throw new Error("payment attempt vanished");
      await lockCateringBilling(tx, seen.bookingId);
      const booking = await lockedBooking(tx, seen.bookingId);
      await tx.execute(sql`SELECT id FROM catering_booking_payment_attempts WHERE id = ${attemptId} FOR UPDATE`);
      const attempt = (await attemptById(tx, attemptId))!;
      // A consumed attempt means only "do not credit the ledger a second time". It never means "ignore newer completed payments": the evidence
      // this settlement already fetched (it may hold payments the winner of the lock race never saw) is audited under the locks just taken.
      if (CONSUMED.includes(attempt.state)) {
        const audited = await auditAdditionalPaymentsInTx(tx, attempt, confirmed.payments);
        return audited.changed ? { kind: "additional", attempt: audited.attempt } : { kind: "already", attempt };
      }

      // A Square payment is evidence for AT MOST ONE attempt and credited at most once. Checked here as well as by the unique indexes, so a
      // replayed or foreign payment id is a clean refusal and not a constraint error that aborts the settlement.
      const ids = confirmed.payments.map((payment) => payment.paymentId);
      const [consumedByLedger] = await tx.select({ id: cateringBookingPayments.id }).from(cateringBookingPayments)
        .where(and(eq(cateringBookingPayments.processor, CATERING_SQUARE_PROCESSOR), inArray(cateringBookingPayments.processorPaymentId, ids))).limit(1);
      const [consumedByAttempt] = await tx.select({ id: cateringBookingPaymentAttempts.id }).from(cateringBookingPaymentAttempts)
        .where(and(inArray(cateringBookingPaymentAttempts.squarePaymentId, ids), sql`${cateringBookingPaymentAttempts.id} <> ${attemptId}`)).limit(1);
      const [elsewhere] = await tx.select({ id: cateringAttemptSquarePayments.id }).from(cateringAttemptSquarePayments)
        .where(and(inArray(cateringAttemptSquarePayments.squarePaymentId, ids), sql`${cateringAttemptSquarePayments.attemptId} <> ${attemptId}`)).limit(1);
      if (consumedByLedger || consumedByAttempt || elsewhere) return { kind: "duplicate", attempt };

      const summary = summarizeConfirmedPayments(confirmed.payments);
      const { facts, rows, asOfDate } = await lockedFacts(tx, attempt.bookingId, booking);
      const invoiceRow = rows.invoices.find((invoice) => invoice.id === attempt.invoiceId);
      let decision = decideCateringSettlement({
        confirmed: { amountCents: summary.amountCents ?? 0, currency: summary.currency ?? "", mismatch: confirmed.mismatch },
        invoice: invoiceRow ? cateringInvoiceFactOf(invoiceRow) : undefined,
        facts,
      });

      // THE ACCOUNTING DATE is the day SQUARE completed the payment, in the PROVIDER's calendar (the one every other billing date uses) --
      // not the day ChefSire happened to verify it. A time that is in the future of the billing day cannot be a received-on date.
      let receivedOn: string | null = null;
      if (decision.kind === "credit") {
        const completedAt = confirmed.payments[0].completedAt;
        receivedOn = completedAt ? await cateringBillingDay(tx, booking.providerId, completedAt) : null;
        if (!receivedOn || receivedOn > asOfDate) decision = { kind: "reconcile", reason: "payment_timestamp_invalid" };
      }

      // The evidence is persisted FIRST, whatever happens next: it is what keeps every movement of money visible.
      await insertPaymentEvidence(tx, attemptId, confirmed.payments);

      if (decision.kind === "credit") {
        const only = confirmed.payments[0];
        const [payment] = await tx.insert(cateringBookingPayments).values({
          bookingId: attempt.bookingId,
          invoiceId: attempt.invoiceId,
          amountCents: decision.amountCents,
          currency: attempt.currency,
          paymentMethod: "card_online",
          paymentSource: "processor",
          status: "recorded",
          receivedOn: receivedOn!,
          recordedBy: null,
          processor: CATERING_SQUARE_PROCESSOR,
          processorPaymentId: only.paymentId,
        }).returning();
        const [completed] = await tx.update(cateringBookingPaymentAttempts).set({
          state: "completed", paymentId: payment.id, squarePaymentId: only.paymentId,
          processorAmountCents: only.amountCents, processorCurrency: only.currency, processorPaymentCount: 1,
          verifiedAt: now(), completedAt: now(), closedAt: now(), lastCheckedAt: now(), updatedAt: now(),
        }).where(eq(cateringBookingPaymentAttempts.id, attemptId)).returning();
        await tx.insert(cateringBookingActivity).values({
          bookingId: attempt.bookingId, actorUserId: attempt.customerId, eventType: "billing_processor_payment_confirmed", visibility: "shared",
          // Amount and currency only: no Square identifier reaches the shared feed.
          metadata: { amountCents: decision.amountCents, currency: attempt.currency } as never,
        });
        return { kind: "completed", attempt: completed as CateringBookingPaymentAttempt };
      }

      // Money moved but the ledger cannot take it as a normal credit. KEEP THE EVIDENCE; credit nothing, clamp nothing, refund nothing.
      // With ONE payment its reference is the attempt's; with several there is no single reference and none is named as "the" payment.
      const [reconciled] = await tx.update(cateringBookingPaymentAttempts).set({
        state: "reconciliation_required", reconciliationReason: decision.reason, processorPaymentCount: summary.count,
        squarePaymentId: summary.singlePaymentId, processorAmountCents: summary.amountCents, processorCurrency: summary.currency,
        verifiedAt: now(), closedAt: now(), lastCheckedAt: now(), updatedAt: now(),
      }).where(eq(cateringBookingPaymentAttempts.id, attemptId)).returning();
      return { kind: "reconciliation", attempt: reconciled as CateringBookingPaymentAttempt };
    });
  }

  /**
   * An attempt that ALREADY consumed a payment is audited against Square again (on a new webhook): any completed payment on its order that
   * is not yet recorded is added as evidence in its own row, and the attempt becomes `reconciliation_required` / `multiple_payments`.
   * What was already credited to the ledger is never touched, rewritten or removed; the ledger link stays; a replay finds nothing new.
   */
  async function recordAdditionalPayments(attemptId: string, payments: readonly ConfirmedSquarePayment[]): Promise<{ changed: boolean; attempt: CateringBookingPaymentAttempt }> {
    return db.transaction(async (tx: Executor) => {
      const seen = await attemptById(tx, attemptId);
      if (!seen) throw new Error("payment attempt vanished");
      await lockCateringBilling(tx, seen.bookingId);
      await lockedBooking(tx, seen.bookingId);
      await tx.execute(sql`SELECT id FROM catering_booking_payment_attempts WHERE id = ${attemptId} FOR UPDATE`);
      const attempt = (await attemptById(tx, attemptId))!;
      return auditAdditionalPaymentsInTx(tx, attempt, payments);
    });
  }

  /**
   * The audit itself, run with the billing lock, booking row and attempt row ALREADY held (in that order) and `attempt` read under them.
   * No Square call happens here. Payments already recorded for this attempt are skipped, so a replay changes nothing.
   */
  async function auditAdditionalPaymentsInTx(tx: Executor, attempt: CateringBookingPaymentAttempt, payments: readonly ConfirmedSquarePayment[]): Promise<{ changed: boolean; attempt: CateringBookingPaymentAttempt }> {
    if (!CONSUMED.includes(attempt.state)) return { changed: false, attempt };
    const attemptId = attempt.id;
    const known = new Set((await paymentEvidenceOf(tx, attemptId)).map((row) => row.squarePaymentId));
    if (attempt.squarePaymentId) known.add(attempt.squarePaymentId);
    const fresh = payments.filter((payment) => !known.has(payment.paymentId));
    if (fresh.length === 0) return { changed: false, attempt };
    // A payment already recorded as evidence for ANOTHER attempt, or credited to the ledger, is not this attempt's to claim.
    const ids = fresh.map((payment) => payment.paymentId);
    const taken = new Set([
      ...(await tx.select({ id: cateringAttemptSquarePayments.squarePaymentId }).from(cateringAttemptSquarePayments).where(inArray(cateringAttemptSquarePayments.squarePaymentId, ids))).map((row: { id: string }) => row.id),
      ...(await tx.select({ id: cateringBookingPayments.processorPaymentId }).from(cateringBookingPayments).where(and(eq(cateringBookingPayments.processor, CATERING_SQUARE_PROCESSOR), inArray(cateringBookingPayments.processorPaymentId, ids)))).map((row: { id: string | null }) => row.id),
    ]);
    const claimable = fresh.filter((payment) => !taken.has(payment.paymentId));
    if (claimable.length === 0) return { changed: false, attempt };
    await insertPaymentEvidence(tx, attemptId, claimable);
    const stored = evidenceSummary(await paymentEvidenceOf(tx, attemptId));
    const [updated] = await tx.update(cateringBookingPaymentAttempts).set({
      state: "reconciliation_required", reconciliationReason: "multiple_payments", processorPaymentCount: stored.count,
      squarePaymentId: null, processorAmountCents: stored.amountCents, processorCurrency: stored.currency,
      verifiedAt: now(), lastCheckedAt: now(), updatedAt: now(),
    }).where(eq(cateringBookingPaymentAttempts.id, attemptId)).returning();
    return { changed: true, attempt: updated as CateringBookingPaymentAttempt };
  }

  async function notifyCompleted(attempt: CateringBookingPaymentAttempt) {
    await notify(attempt.customerId, { ...CATERING_SQUARE_NOTIFICATIONS.customerConfirmed, linkUrl: cateringBillingSectionPath("customer", attempt.bookingId) }).catch(() => undefined);
    await notify(attempt.providerId, { ...CATERING_SQUARE_NOTIFICATIONS.providerConfirmed, linkUrl: cateringBillingSectionPath("provider", attempt.bookingId) }).catch(() => undefined);
  }
  async function notifyReconciliation(attempt: CateringBookingPaymentAttempt) {
    await notify(attempt.customerId, { ...CATERING_SQUARE_NOTIFICATIONS.customerReconciliation, linkUrl: cateringBillingSectionPath("customer", attempt.bookingId) }).catch(() => undefined);
    await notify(attempt.providerId, { ...CATERING_SQUARE_NOTIFICATIONS.providerReconciliation, linkUrl: cateringBillingSectionPath("provider", attempt.bookingId) }).catch(() => undefined);
  }

  /* --------------------------------------------------------------------------------------------------------- *
   * Closing checkouts that can no longer be paid in full
   * --------------------------------------------------------------------------------------------------------- */

  /**
   * Closes a booking's open checkouts that could no longer be credited in full -- the booking was cancelled, the invoice was
   * withdrawn, or the amount payable fell below what the checkout would take -- and deletes their Square links best-effort so no
   * more money can be taken on them. A payment that lands anyway is still recognised by `settleAttempt`.
   */
  async function closeStaleOpenAttempts(bookingId: string, options: { sweep?: boolean } = {}): Promise<number> {
    if (!sandboxReady()) return 0;
    // The common case is a booking with no open checkout: answer it with one cheap read, before taking any lock. Closed checkouts whose
    // Square removal is still unconfirmed (a cancellation while Square was down) are retried here too.
    const [anyOpen] = await db.select({ id: cateringBookingPaymentAttempts.id }).from(cateringBookingPaymentAttempts)
      .where(and(eq(cateringBookingPaymentAttempts.bookingId, bookingId), inArray(cateringBookingPaymentAttempts.state, [...OPEN]))).limit(1);
    if (!anyOpen) { if (options.sweep !== false) await sweepClosedLinks(bookingId); return 0; }
    const closed = await db.transaction(async (tx: Executor) => {
      await lockCateringBilling(tx, bookingId);
      const booking = await lockedBooking(tx, bookingId);
      if (!booking) return [] as CateringBookingPaymentAttempt[];
      const open = await tx.select().from(cateringBookingPaymentAttempts)
        .where(and(eq(cateringBookingPaymentAttempts.bookingId, bookingId), inArray(cateringBookingPaymentAttempts.state, [...OPEN])));
      if (open.length === 0) return [];
      const { facts, rows } = await lockedFacts(tx, bookingId, booking);
      const result: CateringBookingPaymentAttempt[] = [];
      for (const attempt of open) {
        const invoiceRow = rows.invoices.find((invoice) => invoice.id === attempt.invoiceId);
        const decision = deriveCateringSquareAmount({ invoice: invoiceRow ? cateringInvoiceFactOf(invoiceRow) : undefined, facts });
        if (decision.ok && decision.amountCents >= attempt.amountCents) continue;
        const [done] = await tx.update(cateringBookingPaymentAttempts)
          .set({ state: "cancelled", closedAt: now(), updatedAt: now() })
          .where(and(eq(cateringBookingPaymentAttempts.id, attempt.id), inArray(cateringBookingPaymentAttempts.state, [...OPEN]))).returning();
        if (done) result.push(done as CateringBookingPaymentAttempt);
      }
      return result;
    });
    if (options.sweep !== false) await sweepClosedLinks(bookingId);
    return closed.length;
  }

  /**
   * Winds down EVERY open Square checkout of one provider, while the provider's Square credential still works. The Square connection service
   * calls this before it discards or replaces that credential (a disconnect, or a reconnect to a DIFFERENT merchant).
   *
   *  1. every open attempt of the provider becomes locally non-payable (database only, under each booking's billing lock);
   *  2. every locally closed attempt of the provider whose Square link is unconfirmed, on the merchant the credential belongs to, has its link
   *     deleted at Square NOW (no backoff);
   *  3. `safe` is false -- and the credential change is refused -- if any such link is still unconfirmed afterwards: ChefSire will not
   *     knowingly leave a customer holding a live checkout it is about to lose the ability to settle.
   *
   * With NO credential on file (persisted state: disconnected, or every secret removed) there is nothing to close WITH and refusing would help nobody, so it is safe;
 * a credential that is on file but not ready (outage, failed refresh, configuration fault) is NOT safe to discard while a link remains unconfirmed;
   * the attempts are closed locally either way and can still be closed later if the SAME merchant is reconnected. Idempotent.
   */
  async function closeProviderCheckouts(providerId: string): Promise<{ safe: boolean }> {
    const open = await db.selectDistinct({ bookingId: cateringBookingPaymentAttempts.bookingId }).from(cateringBookingPaymentAttempts)
      .where(and(eq(cateringBookingPaymentAttempts.providerId, providerId), inArray(cateringBookingPaymentAttempts.state, [...OPEN]))) as { bookingId: string }[];
    for (const { bookingId } of open) {
      await db.transaction(async (tx: Executor) => {
        await lockCateringBilling(tx, bookingId);
        await closeOpenAttemptsInTransaction(tx, bookingId, now());
      });
    }
    // WHAT DEPENDS ON THE STORED CREDENTIAL, from persisted state only: a checkout link whose removal at Square is not yet confirmed. Such a link
    // can still take a payment, and only that merchant's credential can delete it or read what it took. "Not payment-ready right now" is NOT
    // "safe to destroy": a verification outage, a failed refresh or a configuration fault all leave the credential on file and still needed.
    const stored = await connections.storedCredentialState(providerId);
    if (!stored.present || !stored.merchantId) return { safe: true }; // nothing usable is on file, so nothing is lost by discarding it
    const merchantId = stored.merchantId;
    const unconfirmed = () => and(
      eq(cateringBookingPaymentAttempts.providerId, providerId),
      eq(cateringBookingPaymentAttempts.merchantId, merchantId),
      inArray(cateringBookingPaymentAttempts.state, [...CLOSED_WITH_LINK_STATES]),
      sql`${cateringBookingPaymentAttempts.squarePaymentLinkId} IS NOT NULL AND ${cateringBookingPaymentAttempts.squareLinkClosedAt} IS NULL`,
    );
    const due = await db.selectDistinct({ bookingId: cateringBookingPaymentAttempts.bookingId }).from(cateringBookingPaymentAttempts).where(unconfirmed()) as { bookingId: string }[];
    if (due.length === 0) return { safe: true }; // no live or unconfirmed link depends on the credential
    // Links remain: the credential must still work to close them. If it cannot be obtained, FAIL CLOSED (the credential is kept for a retry).
    const credentials = await connections.getReadyConnectedCredentials(providerId).catch(() => null);
    if (!credentials || credentials.merchantId !== merchantId) {
      log.warn("catering_square_connection_change_refused", { providerId, reason: "credential_unavailable" });
      return { safe: false };
    }
    for (const { bookingId } of due) await sweepClosedLinks(bookingId, { force: true });
    const [remaining] = await db.select({ id: cateringBookingPaymentAttempts.id }).from(cateringBookingPaymentAttempts).where(unconfirmed()).limit(1);
    if (remaining) log.warn("catering_square_connection_change_refused", { providerId, reason: "links_unconfirmed" });
    return { safe: !remaining };
  }

  /* --------------------------------------------------------------------------------------------------------- *
   * Status
   * --------------------------------------------------------------------------------------------------------- */

  type StatusResult =
    | { kind: "not_found" }
    | { kind: "ok"; role: "provider" | "customer"; attempt: CateringAttemptWithPayments };

  /**
   * A participant's view of one attempt. The CUSTOMER's read first asks Square (throttled), because a browser returning from
   * Square proves nothing and the webhook may not have arrived; the answer is whatever settlement concludes from fresh evidence.
   * The provider's read is a plain database read.
   */
  async function getAttempt(input: { bookingId: string; attemptId: string; userId: string }): Promise<StatusResult> {
    const booking = await ownedCateringBooking(input.bookingId, input.userId, db);
    if (!booking) return { kind: "not_found" };
    const role = cateringWorkspaceRole(booking, input.userId) as "provider" | "customer";
    let attempt = await attemptById(db, input.attemptId);
    if (!attempt || attempt.bookingId !== booking.id) return { kind: "not_found" };
    if (role === "customer" && attempt.customerId !== input.userId) return { kind: "not_found" };
    // Whatever the attempt's own state, a closed attempt whose Square link removal is unconfirmed keeps being retried (rate-limited by the
    // sweep's own backoff). This is a retry path for BOTH participants' reads; it never depends on the attempt still being open.
    const sweepIfUnconfirmed = async () => {
      if (!CONSUMED.includes(attempt!.state)) await sweepClosedLinks(attempt!.bookingId).catch(() => 0);
    };
    if (role === "provider") await sweepIfUnconfirmed();
    if (role === "customer" && !CONSUMED.includes(attempt.state)) {
      const claimed = await db.update(cateringBookingPaymentAttempts).set({ lastCheckedAt: now() })
        .where(and(
          eq(cateringBookingPaymentAttempts.id, attempt.id),
          sql`(${cateringBookingPaymentAttempts.lastCheckedAt} IS NULL OR ${cateringBookingPaymentAttempts.lastCheckedAt} < ${new Date(now().getTime() - pollIntervalMs)})`,
        )).returning({ id: cateringBookingPaymentAttempts.id });
      if (claimed.length > 0) {
        if (attempt.squareOrderId) await settleAttempt(attempt.id);
        const refreshed = await attemptById(db, attempt.id);
        if (OPEN.includes(refreshed?.state ?? "")) await closeStaleOpenAttempts(attempt.bookingId);
        else await sweepIfUnconfirmed();
        attempt = (await attemptById(db, attempt.id)) ?? attempt;
      }
    }
    return { kind: "ok", role, attempt: (await withPaymentEvidence(db, [attempt]))[0] };
  }

  /* --------------------------------------------------------------------------------------------------------- *
   * Webhook
   * --------------------------------------------------------------------------------------------------------- */

  /**
   * Persists a verified Square delivery and processes it. The payload is a TRIGGER: only the identifiers needed to find the attempt
   * are kept, and what the ledger records is whatever fresh Square evidence says, never the payload.
   */
  async function handleWebhookEvent(event: SquareWebhookInput): Promise<WebhookResult> {
    if (!sandboxReady()) return { kind: "retry", reason: "sandbox_only" };
    await db.insert(cateringSquareWebhookEvents).values({
      eventId: event.eventId, eventType: event.eventType.slice(0, 64), merchantId: event.merchantId,
      squareOrderId: event.orderId, squarePaymentId: event.paymentId,
    }).onConflictDoNothing({ target: cateringSquareWebhookEvents.eventId });

    const staleBefore = new Date(now().getTime() - STALE_PROCESSING_MS);
    const [claimed] = await db.update(cateringSquareWebhookEvents)
      .set({ state: "processing", attemptCount: sql`${cateringSquareWebhookEvents.attemptCount} + 1`, updatedAt: now() })
      .where(and(
        eq(cateringSquareWebhookEvents.eventId, event.eventId),
        sql`(${cateringSquareWebhookEvents.state} IN ('received', 'failed') OR (${cateringSquareWebhookEvents.state} = 'processing' AND ${cateringSquareWebhookEvents.updatedAt} < ${staleBefore}))`,
      )).returning();
    if (!claimed) {
      const [existing] = await db.select().from(cateringSquareWebhookEvents).where(eq(cateringSquareWebhookEvents.eventId, event.eventId)).limit(1);
      return existing?.state === "processing" ? { kind: "in_flight" } : { kind: "duplicate" };
    }

    const finish = async (state: "processed" | "ignored" | "failed", outcome: string, attemptId: string | null) => {
      await db.update(cateringSquareWebhookEvents)
        .set({ state, outcome: outcome.slice(0, 40), attemptId, processedAt: state === "failed" ? null : now(), updatedAt: now() })
        .where(eq(cateringSquareWebhookEvents.eventId, event.eventId));
    };

    try {
      if (!WEBHOOK_EVENT_TYPES.has(event.eventType)) { await finish("ignored", "unsupported_event_type", null); return { kind: "ignored", reason: "unsupported_event_type" }; }
      if (!event.orderId) { await finish("ignored", "no_order_reference", null); return { kind: "ignored", reason: "no_order_reference" }; }
      const [attempt] = await db.select().from(cateringBookingPaymentAttempts).where(eq(cateringBookingPaymentAttempts.squareOrderId, event.orderId)).limit(1);
      if (!attempt) { await finish("ignored", "no_matching_attempt", null); return { kind: "ignored", reason: "no_matching_attempt" }; }
      // A delivery for another merchant's account is never allowed to trigger work on this attempt.
      if (!event.merchantId || event.merchantId !== attempt.merchantId) { await finish("ignored", "merchant_mismatch", attempt.id); return { kind: "ignored", reason: "merchant_mismatch" }; }

      const settled = await settleAttempt(attempt.id);
      if (settled.outcome === "unavailable") { await finish("failed", settled.reason, attempt.id); return { kind: "retry", reason: settled.reason }; }
      if (settled.outcome === "rejected") { await finish("ignored", settled.code, attempt.id); return { kind: "ignored", reason: settled.code }; }
      await finish("processed", settled.outcome, attempt.id);
      return { kind: "processed", outcome: settled.outcome };
    } catch (error) {
      await finish("failed", "processing_error", null).catch(() => undefined);
      log.warn("catering_square_webhook_failed", { eventId: event.eventId, errorName: error instanceof Error ? error.name : "unknown" });
      return { kind: "retry", reason: "processing_error" };
    }
  }

  /** Attempts for a booking's billing view, newest first and bounded. The caller filters by role. */
  /**
   * A booking's attempts for its billing view: EVERY `reconciliation_required` attempt (unresolved money that moved, whose attempt row may be
   * the only provider-visible record of it) PLUS a bounded window of the most recent other attempts. The history cap can therefore never
   * hide an unresolved financial exception, however many newer attempts exist. Newest first.
   */
  async function attemptsForBooking(executor: Executor, bookingId: string): Promise<CateringAttemptWithPayments[]> {
    const unresolved = await executor.select().from(cateringBookingPaymentAttempts)
      .where(and(eq(cateringBookingPaymentAttempts.bookingId, bookingId), eq(cateringBookingPaymentAttempts.state, "reconciliation_required"))) as CateringBookingPaymentAttempt[];
    const recent = await executor.select().from(cateringBookingPaymentAttempts)
      .where(and(eq(cateringBookingPaymentAttempts.bookingId, bookingId), sql`${cateringBookingPaymentAttempts.state} <> 'reconciliation_required'`))
      .orderBy(desc(cateringBookingPaymentAttempts.createdAt), asc(cateringBookingPaymentAttempts.id)).limit(ATTEMPT_HISTORY_LIMIT) as CateringBookingPaymentAttempt[];
    const merged = [...unresolved, ...recent].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id));
    return withPaymentEvidence(executor, merged);
  }

  /** Attaches each money-moved attempt's per-payment evidence (one query for the whole list). */
  async function withPaymentEvidence(executor: Executor, attempts: CateringBookingPaymentAttempt[]): Promise<CateringAttemptWithPayments[]> {
    const ids = attempts.filter((attempt) => CONSUMED.includes(attempt.state)).map((attempt) => attempt.id);
    if (ids.length === 0) return attempts.map((attempt) => ({ ...attempt, processorPayments: [] }));
    const rows = await executor.select().from(cateringAttemptSquarePayments).where(inArray(cateringAttemptSquarePayments.attemptId, ids))
      .orderBy(asc(cateringAttemptSquarePayments.completedAt), asc(cateringAttemptSquarePayments.squarePaymentId)) as CateringAttemptSquarePayment[];
    return attempts.map((attempt) => ({ ...attempt, processorPayments: rows.filter((row) => row.attemptId === attempt.id) }));
  }

  return { enabled, createPayment, settleAttempt, getAttempt, handleWebhookEvent, closeStaleOpenAttempts, sweepClosedLinks, closeProviderCheckouts, attemptsForBooking };
}

/**
 * Closes a booking's open Square checkouts LOCALLY, inside the caller's transaction. Called by the booking-cancellation transaction, under
 * the billing advisory lock it has already taken, so the booking's status and its open checkouts change in one commit: there is no moment
 * at which a cancelled booking still has a live checkout in the database. Database only -- no Square call is made here, so a Square outage
 * can never roll back or block a cancellation. The Square links are removed afterwards by `sweepClosedLinks`.
 */
export async function closeOpenAttemptsInTransaction(tx: Executor, bookingId: string, at: Date): Promise<number> {
  const closed = await tx.update(cateringBookingPaymentAttempts)
    .set({ state: "cancelled", closedAt: at, updatedAt: at })
    .where(and(eq(cateringBookingPaymentAttempts.bookingId, bookingId), inArray(cateringBookingPaymentAttempts.state, [...OPEN]))).returning({ id: cateringBookingPaymentAttempts.id });
  return closed.length;
}

/** An attempt together with its per-payment Square evidence (empty until money moved). */
export type CateringAttemptWithPayments = CateringBookingPaymentAttempt & { processorPayments: CateringAttemptSquarePayment[] };

export type CateringSquarePayments = ReturnType<typeof createCateringSquarePayments>;

export type { CateringReconciliationReason };
