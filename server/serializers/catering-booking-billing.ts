import type { CateringBookingBillingRecord, CateringBookingInvoice, CateringBookingPayment } from "@shared/schema";
import {
  cateringDepositRequirement,
  cateringInvoiceIsOverdue,
  cateringInvoiceReference,
  cateringInvoiceState,
  cateringPaidTowards,
  cateringRemainingOnInvoice,
  type CateringBillingFacts,
  type CateringDepositTermsView,
  type CateringInvoiceKind,
  type CateringInvoiceStatus,
  type CateringInvoiceView,
  type CateringPaymentMethod,
  type CateringPaymentSource,
  type CateringPaymentStatus,
  type CateringPaymentView,
} from "@shared/catering-booking-billing";
import { cateringInvoiceFactOf, cateringDepositTermsOf } from "../services/catering-booking-billing-policy";

/**
 * EXPLICIT PROJECTIONS. Not one spread of a database row anywhere in this file.
 *
 * Financial rows carry things neither actor may read -- who recorded a payment, who voided an invoice, the
 * caterer's own bookkeeping reference, the concurrency version, and (when a later phase writes them) a processor
 * name and charge id. A `{ ...row }` would ship every one of those the moment a column was added, so every field
 * below is written out by hand and a new column reaches nobody until someone decides it should.
 *
 * The rule each field follows:
 *
 *  - SHARED, because it is the customer's own money: the amount, the currency, the kind, the due date, the derived
 *    state, what has been credited, what is left, when a payment was received and how.
 *  - PROVIDER ONLY: the concurrency version (a customer who watched one move could infer provider activity they
 *    were told nothing about), the caterer's reference string, and the deposit terms as a whole -- terms that have
 *    not been issued are planning, not an ask.
 *  - NEITHER: `createdBy`, `voidedBy`, `recordedBy`, `termsUpdatedBy`, `voidReason` and every processor field.
 *    Internal attribution stays internal, exactly as Phase 2K keeps `closedOutBy`, and no raw processor object,
 *    identifier or diagnostic is serialized to anyone.
 */

export function serializeCateringInvoice(
  row: CateringBookingInvoice,
  facts: CateringBillingFacts,
  role: "provider" | "customer",
): CateringInvoiceView {
  const fact = cateringInvoiceFactOf(row);
  const shared: CateringInvoiceView = {
    id: row.id,
    number: row.invoiceNumber,
    kind: row.invoiceKind as CateringInvoiceKind,
    reference: cateringInvoiceReference(row.bookingId, row.invoiceNumber),
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status as CateringInvoiceStatus,
    state: cateringInvoiceState(fact, facts.payments),
    overdue: cateringInvoiceIsOverdue(fact, facts.payments, facts.asOfDate),
    dueOn: row.dueOn ?? null,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    paidCents: cateringPaidTowards(row.id, facts.payments),
    remainingCents: cateringRemainingOnInvoice(fact, facts.payments),
  };
  if (role !== "provider") return shared;
  return { ...shared, updatedAt: row.updatedAt.toISOString() };
}

export function serializeCateringPayment(row: CateringBookingPayment, role: "provider" | "customer"): CateringPaymentView {
  const shared: CateringPaymentView = {
    id: row.id,
    invoiceId: row.invoiceId,
    amountCents: row.amountCents,
    currency: row.currency,
    method: row.paymentMethod as CateringPaymentMethod,
    // Shared deliberately, and load-bearing: it is what every customer-facing string about this payment is worded
    // from. A `provider_recorded` payment is the caterer's record of money they received directly, and the customer
    // is told that rather than being shown a bare "Paid" that ChefSire cannot stand behind.
    source: row.paymentSource as CateringPaymentSource,
    status: row.status as CateringPaymentStatus,
    receivedOn: row.receivedOn,
    recordedAt: row.createdAt.toISOString(),
    voidedAt: row.voidedAt?.toISOString() ?? null,
  };
  if (role !== "provider") return shared;
  return { ...shared, reference: row.reference ?? null };
}

/**
 * The deposit terms, PROVIDER ONLY as a whole object.
 *
 * A customer never receives this key at all -- not an empty one, not a nulled one. Terms that have not produced an
 * invoice are the caterer's planning, and a customer who could watch a percentage being adjusted would be reading
 * a negotiation they are not part of. What reaches them is the invoice that eventually gets issued.
 */
export function serializeCateringDepositTerms(
  record: CateringBookingBillingRecord | undefined,
  agreedTotalCents: number | null,
): CateringDepositTermsView {
  const terms = cateringDepositTermsOf(record);
  return {
    ...terms,
    requiredCents: cateringDepositRequirement(terms, agreedTotalCents),
    updatedAt: record?.updatedAt.toISOString() ?? null,
  };
}
