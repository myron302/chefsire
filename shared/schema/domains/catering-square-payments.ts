import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { users } from "./users-auth";
import { cateringBookingInvoices, cateringBookingPayments, cateringBookings } from "./social-content";

/**
 * Phase 2Q: one customer attempt to pay one issued invoice through Square's hosted checkout, created under the PROVIDER'S own
 * connected Square account. See migration 20261014_catering_square_payments.sql for the full contract: state machine, the
 * amount the server derived, the idempotency key persisted before the Square call, the evidence retained when money moved but
 * could not be credited, and the sandbox-only CHECK. No credential is stored here.
 */
export const cateringBookingPaymentAttempts = pgTable("catering_booking_payment_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => cateringBookings.id, { onDelete: "restrict" }).notNull(),
  invoiceId: varchar("invoice_id").references(() => cateringBookingInvoices.id, { onDelete: "restrict" }).notNull(),
  customerId: varchar("customer_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  providerId: varchar("provider_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  processor: varchar("processor", { length: 24 }).default("square").notNull(),
  processorEnvironment: varchar("processor_environment", { length: 12 }).default("sandbox").notNull(),
  merchantId: text("merchant_id").notNull(),
  locationId: text("location_id").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull(),
  state: varchar("state", { length: 32 }).default("creating").notNull(),
  squarePaymentLinkId: text("square_payment_link_id"),
  squareOrderId: text("square_order_id"),
  checkoutUrl: text("checkout_url"),
  squarePaymentId: text("square_payment_id"),
  processorAmountCents: bigint("processor_amount_cents", { mode: "number" }),
  processorCurrency: varchar("processor_currency", { length: 3 }),
  paymentId: varchar("payment_id").references(() => cateringBookingPayments.id, { onDelete: "restrict" }),
  reconciliationReason: varchar("reconciliation_reason", { length: 40 }),
  failureCode: varchar("failure_code", { length: 40 }),
  squareLinkClosedAt: timestamp("square_link_closed_at", { withTimezone: true }),
  squareLinkCloseAttempts: integer("square_link_close_attempts").default(0).notNull(),
  squareLinkCloseAttemptedAt: timestamp("square_link_close_attempted_at", { withTimezone: true }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idempotencyUnique: uniqueIndex("catering_attempts_idempotency_uidx").on(t.idempotencyKey),
  orderUnique: uniqueIndex("catering_attempts_order_uidx").on(t.squareOrderId).where(sql`${t.squareOrderId} IS NOT NULL`),
  linkUnique: uniqueIndex("catering_attempts_link_uidx").on(t.squarePaymentLinkId).where(sql`${t.squarePaymentLinkId} IS NOT NULL`),
  squarePaymentUnique: uniqueIndex("catering_attempts_square_payment_uidx").on(t.squarePaymentId).where(sql`${t.squarePaymentId} IS NOT NULL`),
  ledgerUnique: uniqueIndex("catering_attempts_ledger_uidx").on(t.paymentId).where(sql`${t.paymentId} IS NOT NULL`),
  openInvoiceUnique: uniqueIndex("catering_attempts_open_invoice_uidx").on(t.invoiceId).where(sql`${t.state} IN ('creating', 'pending')`),
  bookingIdx: index("catering_attempts_booking_idx").on(t.bookingId, t.createdAt, t.id),
  invoiceIdx: index("catering_attempts_invoice_idx").on(t.invoiceId, t.state),
  processorCheck: check("catering_attempt_processor_check", sql`${t.processor} = 'square'`),
  linkCloseAttemptsCheck: check("catering_attempt_link_close_attempts_check", sql`${t.squareLinkCloseAttempts} >= 0`),
  environmentCheck: check("catering_attempt_environment_check", sql`${t.processorEnvironment} = 'sandbox'`),
  currencyCheck: check("catering_attempt_currency_check", sql`${t.currency} = 'USD'`),
  amountCheck: check("catering_attempt_amount_check", sql`${t.amountCents} > 0 AND ${t.amountCents} <= 9999999999`),
  stateCheck: check("catering_attempt_state_check", sql`${t.state} IN ('creating', 'pending', 'completed', 'failed', 'expired', 'cancelled', 'superseded', 'reconciliation_required')`),
  processorAmountCheck: check("catering_attempt_processor_amount_check", sql`${t.processorAmountCents} IS NULL OR (${t.processorAmountCents} > 0 AND ${t.processorAmountCents} <= 9999999999)`),
  processorCurrencyCheck: check("catering_attempt_processor_currency_check", sql`${t.processorCurrency} IS NULL OR ${t.processorCurrency} ~ '^[A-Z]{3}$'`),
  pendingCheck: check("catering_attempt_pending_check", sql`${t.state} <> 'pending' OR (${t.squareOrderId} IS NOT NULL AND ${t.squarePaymentLinkId} IS NOT NULL AND ${t.checkoutUrl} IS NOT NULL)`),
  completedCheck: check("catering_attempt_completed_check", sql`${t.state} <> 'completed' OR (${t.paymentId} IS NOT NULL AND ${t.squarePaymentId} IS NOT NULL AND ${t.processorAmountCents} IS NOT NULL AND ${t.processorCurrency} IS NOT NULL AND ${t.completedAt} IS NOT NULL)`),
  ledgerLinkCheck: check("catering_attempt_ledger_link_check", sql`${t.paymentId} IS NULL OR ${t.state} = 'completed'`),
  reconciliationCheck: check("catering_attempt_reconciliation_check", sql`${t.state} <> 'reconciliation_required' OR (${t.paymentId} IS NULL AND ${t.squarePaymentId} IS NOT NULL AND ${t.processorAmountCents} IS NOT NULL AND ${t.processorCurrency} IS NOT NULL AND ${t.reconciliationReason} IS NOT NULL)`),
  reconciliationReasonCheck: check("catering_attempt_reconciliation_reason_check", sql`${t.reconciliationReason} IS NULL OR ${t.state} = 'reconciliation_required'`),
  paymentEvidenceCheck: check("catering_attempt_payment_evidence_check", sql`${t.squarePaymentId} IS NULL OR ${t.state} IN ('completed', 'reconciliation_required')`),
}));

/**
 * Phase 2Q: Square webhook deliveries for Catering payments -- replay protection and retry state. A row is a trigger record,
 * never evidence; the payload is not stored.
 */
export const cateringSquareWebhookEvents = pgTable("catering_square_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  merchantId: text("merchant_id"),
  squareOrderId: text("square_order_id"),
  squarePaymentId: text("square_payment_id"),
  attemptId: varchar("attempt_id").references(() => cateringBookingPaymentAttempts.id, { onDelete: "restrict" }),
  state: varchar("state", { length: 16 }).default("received").notNull(),
  attemptCount: integer("attempt_count").default(0).notNull(),
  outcome: varchar("outcome", { length: 40 }),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  eventUnique: uniqueIndex("catering_square_webhook_event_uidx").on(t.eventId),
  attemptIdx: index("catering_square_webhook_attempt_idx").on(t.attemptId).where(sql`${t.attemptId} IS NOT NULL`),
  retryIdx: index("catering_square_webhook_retry_idx").on(t.state, t.updatedAt).where(sql`${t.state} IN ('received', 'processing', 'failed')`),
  stateCheck: check("catering_square_webhook_state_check", sql`${t.state} IN ('received', 'processing', 'processed', 'ignored', 'failed')`),
  attemptCountCheck: check("catering_square_webhook_attempt_count_check", sql`${t.attemptCount} >= 0`),
}));
