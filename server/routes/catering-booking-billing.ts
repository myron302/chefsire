import { Router } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  cateringBookingActivity,
  cateringBookingBilling,
  cateringBookings,
  cateringBookingInvoices,
  cateringBookingPayments,
  notifications,
  type CateringBookingBillingRecord,
  type CateringBookingInvoice,
  type CateringBookingPayment,
} from "@shared/schema";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { cateringWorkspaceRole } from "@shared/catering-booking-operations";
import {
  CATERING_BILLING_NOTIFICATIONS,
  cateringBalanceAmount,
  cateringBillingSectionPath,
  cateringDepositRequirement,
  cateringDepositTermsSaveSchema,
  cateringInvoiceAmountFor,
  cateringInvoiceIssueSchema,
  cateringInvoiceVoidSchema,
  cateringIssuableInvoiceKinds,
  cateringMoneyToCents,
  cateringPaymentRecordSchema,
  cateringPaymentVoidSchema,
  cateringPercentToBasisPoints,
  deriveCateringBillingSummary,
  type CateringBookingBillingView,
  type CateringInvoiceKind,
} from "@shared/catering-booking-billing";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { ownedCateringBooking } from "../services/catering-booking-access";
import { cateringCounterpart } from "../services/catering-booking-communication-policy";
import {
  CATERING_BILLING_CONFLICT_REFUSAL,
  CATERING_BILLING_FORBIDDEN_MESSAGE,
  CATERING_BILLING_NOT_AVAILABLE_REFUSAL,
  CATERING_BILLING_NOT_FOUND_REFUSAL,
  cateringBillingFacts,
  cateringBillingGuard,
  cateringBillingStateRefusal,
  cateringBillingToday,
  cateringBillingVersionMatches,
  cateringInvoiceFactOf,
  resolveCateringDepositTerms,
  resolveCateringPayment,
} from "../services/catering-booking-billing-policy";
import {
  serializeCateringDepositTerms,
  serializeCateringInvoice,
  serializeCateringPayment,
} from "../serializers/catering-booking-billing";

/**
 * Phase 2L billing routes, inside the existing catering booking namespace.
 *
 * ONE cohesive read plus five narrow, provider-only mutations. No generic CRUD, no second booking lifecycle, no
 * second activity feed, no second notification system, and no payment processor: see the header of
 * `shared/catering-booking-billing.ts` for why this phase moves no money and what it does instead.
 *
 * AUTHORIZATION, identically on every route here and identical to Phases 2H, 2I, 2J and 2K:
 *
 *  1. the acting user is `req.user.id` from the authenticated session, and nothing else;
 *  2. the booking is resolved by `ownedCateringBooking`, which restricts to the PERSISTED provider or customer, so
 *     a body naming a providerId, customerId, actor or owner contributes nothing and a stranger gets no row;
 *  3. the role is derived from the resolved booking, never read from the request;
 *  4. every mutation is provider-only and requires a booking that is not cancelled, checked by
 *     `cateringBillingGuard` before any transaction opens and AGAIN against the locked booking inside it;
 *  5. an unresolvable booking answers 404 with one message, so a guessed id, another provider's booking and
 *     another customer's booking are indistinguishable.
 *
 * WHAT A CLIENT MAY NEVER SEND, and cannot: an invoice amount (issuing sends a kind, and the amount is derived
 * from the booking's own agreed price under the lock), a role, a participant id, an invoice's paid state, a
 * booking status, or a claim that a payment succeeded. The single amount a client does send is on a recorded
 * payment, and it is bounded server-side against what that invoice actually has left.
 */
const r = Router();
type Res = Parameters<Parameters<typeof r.get>[1]>[1];

function invalid(error: unknown, res: Res, next: (error: unknown) => void) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
  next(error);
}
function refuse(res: Res, refusal: { status: number; message: string; code?: string }) {
  return res.status(refusal.status).json(refusal.code ? { message: refusal.message, code: refusal.code } : { message: refusal.message });
}

/**
 * The advisory lock one booking's billing is serialized under.
 *
 * Named per booking, so one booking's billing never serializes against another's. It is what makes every derived
 * amount in this file real under concurrency: allocating the next invoice number, deriving a deposit from the
 * agreed price, deriving a balance from the deposit already issued, and bounding a payment against what an invoice
 * has left are all reads followed by a write, and two tabs interleaving them is exactly the race that would
 * produce two invoices for the same money or a credit larger than the invoice.
 */
async function lockBilling(tx: typeof db, bookingId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`catering-billing:${bookingId}`}))`);
}

/**
 * Re-reads the booking's own money and status under its ROW LOCK.
 *
 * This is the authoritative read, not the early guard. It is what closes the stale-price race: the agreed price an
 * invoice is derived from is read here, inside the transaction that writes it, so a cancellation or any future
 * change to the booking that lands between the request arriving and the invoice being written is seen rather than
 * billed against. `agreedPrice` is in fact written exactly once today, at booking creation, and never updated --
 * the audit found no path that changes it -- but the lock costs nothing and is what stops that being an assumption
 * the correctness of this file depends on.
 */
async function lockedBooking(tx: typeof db, bookingId: string) {
  await tx.execute(sql`SELECT id FROM catering_bookings WHERE id = ${bookingId} FOR UPDATE`);
  const [booking] = await tx.select({
    status: cateringBookings.status, agreedPrice: cateringBookings.agreedPrice, currency: cateringBookings.currency,
  }).from(cateringBookings).where(eq(cateringBookings.id, bookingId)).limit(1);
  return booking;
}

async function billingRows(tx: typeof db, bookingId: string): Promise<{
  terms: CateringBookingBillingRecord | undefined;
  invoices: CateringBookingInvoice[];
  payments: CateringBookingPayment[];
}> {
  const [terms] = await tx.select().from(cateringBookingBilling).where(eq(cateringBookingBilling.bookingId, bookingId)).limit(1);
  const invoices = await tx.select().from(cateringBookingInvoices)
    .where(eq(cateringBookingInvoices.bookingId, bookingId)).orderBy(asc(cateringBookingInvoices.invoiceNumber)) as CateringBookingInvoice[];
  // Ordered by the day the money arrived, then by id, so a list rendered from this is stable across refetches.
  const payments = await tx.select().from(cateringBookingPayments)
    .where(eq(cateringBookingPayments.bookingId, bookingId)).orderBy(asc(cateringBookingPayments.receivedOn), asc(cateringBookingPayments.id)) as CateringBookingPayment[];
  return { terms: terms as CateringBookingBillingRecord | undefined, invoices, payments };
}

/**
 * The one cohesive read, projected by role.
 *
 * Both actors get the same derived summary from the same authoritative rows, so they cannot disagree about what is
 * owed. What differs is only what each is entitled to: the provider additionally gets the deposit terms, what is
 * issuable and for how much, the invoice concurrency versions, and their own payment references.
 */
function billingView(input: {
  role: "provider" | "customer";
  booking: { status: string; agreedPrice: string | null; currency: string };
  terms: CateringBookingBillingRecord | undefined;
  invoices: readonly CateringBookingInvoice[];
  payments: readonly CateringBookingPayment[];
  asOfDate: string;
}): CateringBookingBillingView {
  const facts = cateringBillingFacts(input);
  const view: CateringBookingBillingView = {
    role: input.role,
    bookingStatus: facts.bookingStatus,
    actionable: input.role === "provider" && facts.bookingStatus !== "cancelled",
    asOfDate: input.asOfDate,
    summary: deriveCateringBillingSummary(facts),
    // A voided invoice stays in both actors' history: a customer who was asked for money is entitled to see that
    // the ask was withdrawn rather than watch it vanish.
    invoices: input.invoices.map((row) => serializeCateringInvoice(row, facts, input.role)),
    payments: input.payments.map((row) => serializeCateringPayment(row, input.role)),
  };
  if (input.role !== "provider") return view;
  const issuable = cateringIssuableInvoiceKinds(facts);
  return {
    ...view,
    terms: serializeCateringDepositTerms(input.terms, facts.agreedTotalCents),
    issuable,
    issuablePreview: issuable.map((kind) => ({ kind, amountCents: cateringInvoiceAmountFor(kind, facts) ?? 0 })),
  };
}

async function resolveRequest(req: { params: { id: string }; user?: { id: string } }, res: Res, mutating: boolean) {
  const id = cateringBookingIdSchema.parse(req.params.id);
  const userId = req.user!.id;
  const booking = await ownedCateringBooking(id, userId);
  if (!booking) { refuse(res, CATERING_BILLING_NOT_FOUND_REFUSAL); return null; }
  if (mutating) {
    const guard = cateringBillingGuard(booking, userId);
    if (guard === "forbidden") { res.status(403).json({ message: CATERING_BILLING_FORBIDDEN_MESSAGE }); return null; }
    if (guard === "not_available") { refuse(res, CATERING_BILLING_NOT_AVAILABLE_REFUSAL); return null; }
  }
  return { id, userId, booking, role: cateringWorkspaceRole(booking, userId) as "provider" | "customer" };
}

/** The customer is the counterpart of every Phase 2L action, because every Phase 2L action is the provider's. */
async function notifyCustomer(booking: { providerId: string; customerId: string }, actorId: string, bookingId: string, notification: { type: string; title: string; message: string }) {
  const customerId = cateringCounterpart(booking, actorId);
  if (!customerId) return;
  await db.insert(notifications).values({
    userId: customerId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    linkUrl: cateringBillingSectionPath("customer", bookingId),
  }).catch(() => undefined);
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Read
 * ------------------------------------------------------------------------------------------------------------- */

r.get("/bookings/:id/billing", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveRequest(req as never, res, false);
  if (!resolved) return;
  const { terms, invoices, payments } = await billingRows(db, resolved.id);
  res.json(billingView({
    role: resolved.role,
    booking: resolved.booking,
    terms, invoices, payments,
    asOfDate: cateringBillingToday(),
  }));
} catch (error) { invalid(error, res, next); } });

/* ------------------------------------------------------------------------------------------------------------- *
 * Deposit terms
 * ------------------------------------------------------------------------------------------------------------- */

r.put("/bookings/:id/billing/deposit-terms", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveRequest(req as never, res, true);
  if (!resolved) return;
  const body = cateringDepositTermsSaveSchema.parse(req.body ?? {});
  const { id, userId } = resolved;

  const result = await db.transaction(async (tx: typeof db) => {
    await lockBilling(tx, id);
    const booking = await lockedBooking(tx, id);
    if (!booking || booking.status === "cancelled") return { kind: "not_available" } as const;
    const [existing] = await tx.select().from(cateringBookingBilling).where(eq(cateringBookingBilling.bookingId, id)).limit(1);
    // Two tabs editing terms must not silently overwrite each other, so the precondition is checked against the
    // row this transaction is actually holding rather than the one the request was composed from.
    if (!cateringBillingVersionMatches(body.expectedUpdatedAt, existing?.updatedAt)) return { kind: "conflict" } as const;

    const resolution = resolveCateringDepositTerms({
      mode: body.mode,
      amountCents: body.amount === undefined ? null : cateringMoneyToCents(body.amount),
      percentBasisPoints: body.percent === undefined ? null : cateringPercentToBasisPoints(body.percent),
      dueOn: body.dueOn ?? null,
      agreedTotalCents: cateringMoneyToCents(booking.agreedPrice),
    });
    if (!resolution.ok) return { kind: "refused", message: resolution.message } as const;

    const values = {
      depositMode: resolution.mode,
      depositAmountCents: resolution.amountCents,
      depositPercentBp: resolution.percentBasisPoints,
      depositDueOn: resolution.dueOn,
      termsUpdatedBy: userId,
      updatedAt: new Date(),
    };
    const [saved] = await tx.insert(cateringBookingBilling).values({ bookingId: id, ...values })
      .onConflictDoUpdate({ target: cateringBookingBilling.bookingId, set: values }).returning();
    // Terms write NO activity and NO notification. Nothing has been asked of the customer yet -- an issued invoice
    // is the ask, and that is the event they hear about.
    return { kind: "saved", record: saved as CateringBookingBillingRecord, agreedTotalCents: cateringMoneyToCents(booking.agreedPrice) } as const;
  });

  if (result.kind === "not_available") return refuse(res, CATERING_BILLING_NOT_AVAILABLE_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_BILLING_CONFLICT_REFUSAL);
  if (result.kind === "refused") return refuse(res, cateringBillingStateRefusal(result.message));
  res.json({ terms: serializeCateringDepositTerms(result.record, result.agreedTotalCents) });
} catch (error) { invalid(error, res, next); } });

/* ------------------------------------------------------------------------------------------------------------- *
 * Invoices
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Issue a deposit or a balance request.
 *
 * The request carries the KIND and an optional due date. It carries no amount, and there is no field in which one
 * could arrive: the amount is derived here, under the lock, from the booking's own agreed price and either the
 * persisted deposit terms or the deposit invoice already issued. That is what closes the stale-price race -- the
 * price is re-read from the locked booking at the moment of writing, not taken from whatever the tab was showing.
 *
 * Invoices are created ISSUED. A draft state exists in the schema for a later phase that wants one; issuing in one
 * step is what this phase's UI does, and a two-step flow whose first step no one can see would be state with no
 * behaviour behind it.
 */
r.post("/bookings/:id/billing/invoices", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveRequest(req as never, res, true);
  if (!resolved) return;
  const body = cateringInvoiceIssueSchema.parse(req.body ?? {});
  const { id, userId, booking } = resolved;

  const result = await db.transaction(async (tx: typeof db) => {
    await lockBilling(tx, id);
    const locked = await lockedBooking(tx, id);
    if (!locked || locked.status === "cancelled") return { kind: "not_available" } as const;
    const rows = await billingRows(tx, id);
    const facts = cateringBillingFacts({ booking: locked, ...rows, asOfDate: cateringBillingToday() });

    const amountCents = cateringInvoiceAmountFor(body.kind as CateringInvoiceKind, facts);
    if (amountCents === null || amountCents <= 0) {
      return { kind: "refused", message: unissuableMessage(body.kind as CateringInvoiceKind, facts.agreedTotalCents !== null) } as const;
    }
    // The next number in this booking's own sequence, allocated under the lock so two tabs cannot take the same
    // one. The unique index on (booking_id, invoice_kind) WHERE status <> 'void' is the second line of defence: a
    // double-issue that somehow got past the derivation fails the insert rather than asking twice for one amount.
    const nextNumber = rows.invoices.reduce((highest, invoice) => Math.max(highest, invoice.invoiceNumber), 0) + 1;
    const [created] = await tx.insert(cateringBookingInvoices).values({
      bookingId: id,
      invoiceNumber: nextNumber,
      invoiceKind: body.kind,
      amountCents,
      currency: locked.currency,
      status: "issued",
      dueOn: body.dueOn ?? (body.kind === "deposit" ? facts.terms.dueOn : null),
      issuedAt: new Date(),
      createdBy: userId,
    }).returning();
    await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: "billing_invoice_issued", visibility: "shared",
      // Shared amounts only. No processor field, no internal reference, no actor id beyond the one the activity
      // table already records for every event in the feed.
      metadata: { kind: body.kind, amountCents, currency: locked.currency },
    });
    return { kind: "issued", invoice: created as CateringBookingInvoice, rows, locked } as const;
  });

  if (result.kind === "not_available") return refuse(res, CATERING_BILLING_NOT_AVAILABLE_REFUSAL);
  if (result.kind === "refused") return refuse(res, cateringBillingStateRefusal(result.message));
  await notifyCustomer(booking, userId, id, CATERING_BILLING_NOTIFICATIONS.invoiceIssued);
  res.json(await freshView(resolved));
} catch (error) { invalid(error, res, next); } });

function unissuableMessage(kind: CateringInvoiceKind, hasAgreedPrice: boolean): string {
  if (!hasAgreedPrice) return "This booking has no agreed price, so there is nothing to request yet.";
  return kind === "deposit"
    ? "There is no deposit to request. Set your deposit terms first, or one has already been sent."
    : "There is no balance left to request.";
}

/**
 * Withdraw a request that should not have been made.
 *
 * A void does not rewrite history: the invoice keeps its number, its amount and its issue date, and gains a void
 * timestamp beside them. Nothing about an issued invoice is ever edited in place -- an amount a customer was shown
 * must not be able to become a different amount that claims it was always that -- so withdrawing and issuing again
 * is the only way to change what is asked for.
 *
 * An invoice with payments credited to it cannot be voided while they stand: taking back the ask while keeping the
 * credit would leave money recorded against nothing. Void the payments first, deliberately.
 */
r.post("/bookings/:id/billing/invoices/:invoiceId/void", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveRequest(req as never, res, true);
  if (!resolved) return;
  const body = cateringInvoiceVoidSchema.parse(req.body ?? {});
  const invoiceId = z.string().trim().min(1).max(64).parse(req.params.invoiceId);
  const { id, userId } = resolved;

  const result = await db.transaction(async (tx: typeof db) => {
    await lockBilling(tx, id);
    const locked = await lockedBooking(tx, id);
    if (!locked || locked.status === "cancelled") return { kind: "not_available" } as const;
    const rows = await billingRows(tx, id);
    const invoice = rows.invoices.find((row) => row.id === invoiceId);
    if (!invoice) return { kind: "missing" } as const;
    // Idempotent by STATE, judged before the precondition: a retry after a lost response finds the invoice already
    // void and reports success rather than a conflict about a change it made itself.
    if (invoice.status === "void") return { kind: "already" } as const;
    if (!cateringBillingVersionMatches(body.expectedUpdatedAt, invoice.updatedAt)) return { kind: "conflict" } as const;
    const credited = rows.payments.some((payment) => payment.invoiceId === invoiceId && payment.status === "recorded");
    if (credited) return { kind: "refused", message: "Payments are recorded against this request. Void those first if it should be withdrawn." } as const;

    await tx.update(cateringBookingInvoices).set({
      status: "void", voidedAt: new Date(), voidedBy: userId, voidReason: body.reason ?? null, updatedAt: new Date(),
    }).where(eq(cateringBookingInvoices.id, invoiceId));
    await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: "billing_invoice_voided", visibility: "shared",
      // The reason is the caterer's own words and stays out of the shared feed; that the ask was withdrawn is the
      // shared fact, and the amount it was for is already in the customer's own invoice list.
      metadata: { kind: invoice.invoiceKind, amountCents: invoice.amountCents, currency: invoice.currency },
    });
    return { kind: "voided" } as const;
  });

  if (result.kind === "not_available") return refuse(res, CATERING_BILLING_NOT_AVAILABLE_REFUSAL);
  if (result.kind === "missing") return refuse(res, CATERING_BILLING_NOT_FOUND_REFUSAL);
  if (result.kind === "conflict") return refuse(res, CATERING_BILLING_CONFLICT_REFUSAL);
  if (result.kind === "refused") return refuse(res, cateringBillingStateRefusal(result.message));
  res.json({ ...(await freshView(resolved)), duplicate: result.kind === "already" });
} catch (error) { invalid(error, res, next); } });

/* ------------------------------------------------------------------------------------------------------------- *
 * Payments
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Record a payment the caterer has actually received.
 *
 * This is NOT a charge. ChefSire moves no catering money; the caterer was paid directly and is writing down what
 * they received, attributed to them and dated, and every customer-facing string says so.
 *
 * IDEMPOTENCY. The client sends a key for one attempt. A replay -- a double-click, a browser retry, a proxy retry,
 * a lost response -- finds the payment the first attempt created, returns it, and writes no second credit, no
 * second activity row and no second notification. The unique index enforces that even if two requests arrive at
 * once, because the second insert fails inside its transaction rather than crediting the money twice.
 */
r.post("/bookings/:id/billing/payments", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveRequest(req as never, res, true);
  if (!resolved) return;
  const body = cateringPaymentRecordSchema.parse(req.body ?? {});
  const { id, userId, booking } = resolved;

  const result = await db.transaction(async (tx: typeof db) => {
    await lockBilling(tx, id);
    const locked = await lockedBooking(tx, id);
    if (!locked || locked.status === "cancelled") return { kind: "not_available" } as const;
    const rows = await billingRows(tx, id);
    // The duplicate check comes FIRST, before any validation that could refuse a retry of something already
    // recorded: a replay must resolve to what happened, not to a fresh judgement of whether it still could.
    const existing = rows.payments.find((payment) => payment.idempotencyKey === body.idempotencyKey);
    if (existing) return { kind: "duplicate" } as const;

    const facts = cateringBillingFacts({ booking: locked, ...rows, asOfDate: cateringBillingToday() });
    const invoiceRow = rows.invoices.find((row) => row.id === body.invoiceId);
    const resolution = resolveCateringPayment({
      amountCents: cateringMoneyToCents(body.amount),
      currency: locked.currency,
      invoice: invoiceRow ? cateringInvoiceFactOf(invoiceRow) : undefined,
      facts,
      receivedOn: body.receivedOn,
    });
    if (!resolution.ok) return { kind: "refused", message: resolution.message } as const;

    await tx.insert(cateringBookingPayments).values({
      bookingId: id,
      // The RESOLVED row's own id, not the one the request named. They are equal by construction -- the lookup is
      // scoped to this booking's rows and an unmatched id is already refused -- and writing the row's own id is
      // what makes that self-evident rather than something a reader has to trace.
      invoiceId: invoiceRow!.id,
      amountCents: resolution.amountCents,
      currency: locked.currency,
      paymentMethod: body.method,
      paymentSource: "provider_recorded",
      status: "recorded",
      receivedOn: body.receivedOn,
      reference: body.reference ?? null,
      recordedBy: userId,
      idempotencyKey: body.idempotencyKey,
    });
    await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: "billing_payment_recorded", visibility: "shared",
      metadata: { amountCents: resolution.amountCents, currency: locked.currency, method: body.method },
    });
    return { kind: "recorded" } as const;
  });

  if (result.kind === "not_available") return refuse(res, CATERING_BILLING_NOT_AVAILABLE_REFUSAL);
  if (result.kind === "refused") return refuse(res, cateringBillingStateRefusal(result.message));
  if (result.kind === "recorded") await notifyCustomer(booking, userId, id, CATERING_BILLING_NOTIFICATIONS.paymentRecorded);
  res.json({ ...(await freshView(resolved)), duplicate: result.kind === "duplicate" });
} catch (error) { invalid(error, res, next); } });

/**
 * Take back a payment that was recorded in error.
 *
 * The row is kept and marked voided, never deleted: a credit the customer saw must leave a trace of having been
 * withdrawn. This is NOT a refund and is not worded as one anywhere -- no money moved when it was recorded and
 * none moves now. A caterer returning money does so outside ChefSire, exactly as they received it.
 */
r.post("/bookings/:id/billing/payments/:paymentId/void", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveRequest(req as never, res, true);
  if (!resolved) return;
  const body = cateringPaymentVoidSchema.parse(req.body ?? {});
  const paymentId = z.string().trim().min(1).max(64).parse(req.params.paymentId);
  const { id, userId } = resolved;

  const result = await db.transaction(async (tx: typeof db) => {
    await lockBilling(tx, id);
    const locked = await lockedBooking(tx, id);
    if (!locked || locked.status === "cancelled") return { kind: "not_available" } as const;
    const [payment] = await tx.select().from(cateringBookingPayments)
      .where(and(eq(cateringBookingPayments.id, paymentId), eq(cateringBookingPayments.bookingId, id))).limit(1);
    if (!payment) return { kind: "missing" } as const;
    // Idempotent by state: a retry of a void that already landed says so instead of failing.
    if (payment.status === "voided") return { kind: "already" } as const;
    // A provider may only take back what a provider recorded. A processor-backed payment, when a later phase
    // writes one, is the processor's fact and cannot be reversed by a database toggle here.
    if (payment.paymentSource !== "provider_recorded") {
      return { kind: "refused", message: "Only a payment you recorded yourself can be taken back here." } as const;
    }
    await tx.update(cateringBookingPayments).set({
      status: "voided", voidedAt: new Date(), voidedBy: userId, voidReason: body.reason ?? null, updatedAt: new Date(),
    }).where(eq(cateringBookingPayments.id, paymentId));
    await tx.insert(cateringBookingActivity).values({
      bookingId: id, actorUserId: userId, eventType: "billing_payment_voided", visibility: "shared",
      metadata: { amountCents: payment.amountCents, currency: payment.currency },
    });
    return { kind: "voided" } as const;
  });

  if (result.kind === "not_available") return refuse(res, CATERING_BILLING_NOT_AVAILABLE_REFUSAL);
  if (result.kind === "missing") return refuse(res, CATERING_BILLING_NOT_FOUND_REFUSAL);
  if (result.kind === "refused") return refuse(res, cateringBillingStateRefusal(result.message));
  res.json({ ...(await freshView(resolved)), duplicate: result.kind === "already" });
} catch (error) { invalid(error, res, next); } });

/**
 * Every mutation answers with the WHOLE re-derived view rather than the row it wrote.
 *
 * Money is a set of totals that move together: recording one payment changes what that invoice has left, what the
 * booking has outstanding, what remains of the agreed price, what is issuable next and the financial status. A
 * response carrying only the new row would leave the client to recompute the rest, which is exactly the
 * client-side arithmetic this phase refuses to have anywhere.
 */
async function freshView(resolved: { id: string; userId: string; role: "provider" | "customer" }) {
  // The booking is re-read as well as the rows. The one this request resolved was read before the transaction, and
  // answering with it would report a booking cancelled in the meantime as still actionable for one render.
  const booking = await ownedCateringBooking(resolved.id, resolved.userId);
  const rows = await billingRows(db, resolved.id);
  return billingView({
    role: resolved.role,
    booking: booking ?? { status: "cancelled", agreedPrice: null, currency: "USD" },
    ...rows,
    asOfDate: cateringBillingToday(),
  });
}

export default r;
