import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users-auth";

/**
 * Reviewed Wedding Square table definitions.
 * The matching, versioned SQL lives in server/migrations/20261101_0{1,2}_*.sql,
 * and must be applied through ChefSire's ledger before any Wedding billing
 * service may depend on the tables. Declarative Drizzle parity is tested.
 * No table row by itself proves a settled Square payment or paid entitlement.
 */
export const weddingSquareEnrollmentAttempts = pgTable("wedding_square_enrollment_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id),
  squareEnvironment: text("square_environment").notNull().default("sandbox"),
  tier: text("tier").notNull(),
  consentTermsVersion: text("consent_terms_version").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  consentedAmountCents: integer("consented_amount_cents").notNull(),
  consentedCurrency: text("consented_currency").notNull(),
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
  requestedStartDate: date("requested_start_date"),
  requestedTimezone: text("requested_timezone").notNull().default("UTC"),
  squareLocationId: text("square_location_id").notNull(),
  squarePlanVariationId: text("square_plan_variation_id").notNull(),
  squareCustomerId: text("square_customer_id").notNull(),
  squareCardId: text("square_card_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique("wedding_sq_attempt_idempotency_uq"),
  requestFingerprint: text("request_fingerprint").notNull(),
  providerSubscriptionId: text("provider_subscription_id"),
  status: text("status").notNull().default("reserved"),
  lastErrorCode: text("last_error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("wedding_square_enrollment_attempts_user_idx").on(t.userId, t.createdAt.desc()),
  providerUnique: uniqueIndex("wedding_square_enrollment_attempts_provider_idx").on(t.squareEnvironment, t.providerSubscriptionId).where(sql`${t.providerSubscriptionId} IS NOT NULL`),
  unresolvedUnique: uniqueIndex("wedding_square_enrollment_attempts_unresolved_user_idx").on(t.userId).where(sql`${t.status} IN ('reserved','submitting','needs_reconciliation','confirmed')`),
  sandboxCheck: check("wedding_sq_attempt_sandbox_ck", sql`${t.squareEnvironment} = 'sandbox'`),
  tierCheck: check("wedding_sq_attempt_tier_ck", sql`${t.tier} IN ('premium','elite')`),
  amountCheck: check("wedding_sq_attempt_amount_ck", sql`${t.consentedAmountCents} IN (2499,4999)`),
  currencyCheck: check("wedding_sq_attempt_currency_ck", sql`${t.consentedCurrency} = 'USD'`),
  timezoneCheck: check("wedding_sq_attempt_timezone_ck", sql`${t.requestedTimezone} = 'UTC'`),
  idempotencyLenCheck: check("wedding_sq_attempt_idempotency_len_ck", sql`length(${t.idempotencyKey}) BETWEEN 1 AND 45`),
  statusCheck: check("wedding_sq_attempt_status_ck", sql`${t.status} IN ('reserved','submitting','needs_reconciliation','confirmed','aborted')`),
  amountTierCheck: check("wedding_sq_attempt_tier_amount_ck", sql`(${t.tier} = 'premium' AND ${t.consentedAmountCents} = 2499) OR (${t.tier} = 'elite' AND ${t.consentedAmountCents} = 4999)`),
  trialDateCheck: check("wedding_sq_attempt_trial_date_ck", sql`${t.trialExpiresAt} IS NULL OR (${t.requestedStartDate} IS NOT NULL AND (${t.requestedStartDate}::timestamp AT TIME ZONE 'UTC') >= ${t.trialExpiresAt})`),
  providerStatusCheck: check("wedding_sq_attempt_provider_status_ck", sql`${t.providerSubscriptionId} IS NULL OR ${t.status} IN ('needs_reconciliation','confirmed')`),
  confirmedCheck: check("wedding_sq_attempt_confirmed_ck", sql`${t.status} <> 'confirmed' OR (${t.providerSubscriptionId} IS NOT NULL AND length(trim(${t.providerSubscriptionId})) > 0)`),
}));

export const weddingSquareSubscriptions = pgTable("wedding_square_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id),
  tier: text("tier").notNull(),
  squareEnvironment: text("square_environment").notNull(),
  squareMerchantId: text("square_merchant_id").notNull(),
  squareLocationId: text("square_location_id").notNull(),
  squareCustomerId: text("square_customer_id").notNull(),
  squarePlanVariationId: text("square_plan_variation_id").notNull(),
  squareSubscriptionId: text("square_subscription_id").notNull(),
  squareCardId: text("square_card_id"),
  billingConsentAt: timestamp("billing_consent_at", { withTimezone: true }).notNull(),
  billingConsentTermsVersion: text("billing_consent_terms_version").notNull(),
  agreedMonthlyAmountCents: integer("agreed_monthly_amount_cents").notNull(),
  agreedCurrency: text("agreed_currency").notNull(),
  requestedStartDate: date("requested_start_date"),
  providerStatus: text("provider_status").notNull().default("PENDING"),
  verifiedPaidThrough: timestamp("verified_paid_through", { withTimezone: true }),
  cancellationRequestedAt: timestamp("cancellation_requested_at", { withTimezone: true }),
  providerCancelledAt: timestamp("provider_cancelled_at", { withTimezone: true }),
  lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("wedding_square_subscriptions_user_idx").on(t.userId),
  liveUnique: uniqueIndex("wedding_square_subscriptions_one_live_user_idx").on(t.userId).where(sql`${t.providerStatus} IN ('PENDING','ACTIVE','PAUSED')`),
  providerUnique: unique("wedding_sq_sub_provider_uq").on(t.squareEnvironment, t.squareMerchantId, t.squareSubscriptionId),
  tierCheck: check("wedding_sq_sub_tier_ck", sql`${t.tier} IN ('premium','elite')`),
  envCheck: check("wedding_sq_sub_environment_ck", sql`${t.squareEnvironment} IN ('sandbox','production')`),
  amountCheck: check("wedding_sq_sub_amount_ck", sql`${t.agreedMonthlyAmountCents} > 0`),
  currencyCheck: check("wedding_sq_sub_currency_ck", sql`${t.agreedCurrency} = 'USD'`),
  tierAmountCheck: check("wedding_sq_sub_tier_amount_ck", sql`(${t.tier} = 'premium' AND ${t.agreedMonthlyAmountCents} = 2499) OR (${t.tier} = 'elite' AND ${t.agreedMonthlyAmountCents} = 4999)`),
}));

export const weddingSquareWebhookEvents = pgTable("wedding_square_webhook_events", {
  eventId: text("event_id").notNull(),
  squareEnvironment: text("square_environment").notNull(),
  squareMerchantId: text("square_merchant_id").notNull(),
  eventType: text("event_type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processingStatus: text("processing_status").notNull().default("pending"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (t) => ({
  pk: primaryKey({ columns: [t.squareEnvironment, t.squareMerchantId, t.eventId], name: "wedding_sq_webhook_pk" }),
  environmentCheck: check("wedding_sq_webhook_environment_ck", sql`${t.squareEnvironment} IN ('sandbox','production')`),
  statusCheck: check("wedding_sq_webhook_status_ck", sql`${t.processingStatus} IN ('pending','processing','processed','failed')`),
}));

export const weddingSquareInvoiceEvidence = pgTable("wedding_square_invoice_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  weddingSubscriptionId: uuid("wedding_subscription_id").notNull().references(() => weddingSquareSubscriptions.id),
  squareEnvironment: text("square_environment").notNull(),
  squareMerchantId: text("square_merchant_id").notNull(),
  squareInvoiceId: text("square_invoice_id").notNull(),
  squarePaymentId: text("square_payment_id").notNull(),
  squareSubscriptionId: text("square_subscription_id").notNull(),
  verifiedAmountCents: integer("verified_amount_cents").notNull(),
  verifiedCurrency: text("verified_currency").notNull(),
  providerPaidAt: timestamp("provider_paid_at", { withTimezone: true }).notNull(),
  periodStartsAt: timestamp("period_starts_at", { withTimezone: true }).notNull(),
  periodEndsAt: timestamp("period_ends_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  lastPaymentReconciledAt: timestamp("last_payment_reconciled_at", { withTimezone: true }),
  paymentRevokedAt: timestamp("payment_revoked_at", { withTimezone: true }),
}, (t) => ({
  invoiceUnique: unique("wedding_sq_invoice_identity_uq").on(t.squareEnvironment, t.squareMerchantId, t.squareInvoiceId),
  paymentUnique: unique("wedding_sq_payment_identity_uq").on(t.squareEnvironment, t.squareMerchantId, t.squarePaymentId),
  envCheck: check("wedding_sq_evidence_environment_ck", sql`${t.squareEnvironment} IN ('sandbox','production')`),
  amountCheck: check("wedding_sq_evidence_amount_ck", sql`${t.verifiedAmountCents} > 0`),
  currencyCheck: check("wedding_sq_evidence_currency_ck", sql`${t.verifiedCurrency} = 'USD'`),
  coverageCheck: check("wedding_sq_evidence_period_ck", sql`${t.periodEndsAt} > ${t.periodStartsAt}`),
}));
