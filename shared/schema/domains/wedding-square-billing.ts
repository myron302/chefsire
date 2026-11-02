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
  lastRenewalScanAt: timestamp("last_renewal_scan_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("wedding_square_subscriptions_user_idx").on(t.userId),
  renewalScanIdx: index("wedding_square_subscriptions_renewal_scan_idx").on(t.lastRenewalScanAt.asc().nullsFirst(), t.id).where(sql`${t.squareEnvironment} = 'sandbox' AND ${t.providerStatus} IN ('PENDING','ACTIVE')`),
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
  reconciliationRevision: integer("reconciliation_revision").notNull().default(0),
}, (t) => ({
  invoiceUnique: unique("wedding_sq_invoice_identity_uq").on(t.squareEnvironment, t.squareMerchantId, t.squareInvoiceId),
  paymentUnique: unique("wedding_sq_payment_identity_uq").on(t.squareEnvironment, t.squareMerchantId, t.squarePaymentId),
  envCheck: check("wedding_sq_evidence_environment_ck", sql`${t.squareEnvironment} IN ('sandbox','production')`),
  amountCheck: check("wedding_sq_evidence_amount_ck", sql`${t.verifiedAmountCents} > 0`),
  currencyCheck: check("wedding_sq_evidence_currency_ck", sql`${t.verifiedCurrency} = 'USD'`),
  coverageCheck: check("wedding_sq_evidence_period_ck", sql`${t.periodEndsAt} > ${t.periodStartsAt}`),
}));


/**
 * Owner-scoped card setup intent, committed BEFORE any Square customer/card
 * POST. Never store a Web Payments SDK nonce or verification token.
 * A timeout means needs_reconciliation, never automatic replay.
 */
export const weddingSquareCardSetupAttempts = pgTable("wedding_square_card_setup_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id),
  squareEnvironment: text("square_environment").notNull().default("sandbox"),
  squareMerchantId: text("square_merchant_id").notNull(),
  squareLocationId: text("square_location_id").notNull(),
  tier: text("tier").notNull(),
  consentTermsVersion: text("consent_terms_version").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  consentedAmountCents: integer("consented_amount_cents").notNull(),
  consentedCurrency: text("consented_currency").notNull(),
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
  requestedStartDate: date("requested_start_date"),
  requestedTimezone: text("requested_timezone").notNull().default("UTC"),
  sourceDigest: text("source_digest").notNull(),
  customerIdempotencyKey: text("customer_idempotency_key").notNull().unique("wedding_sq_setup_customer_key_uq"),
  cardIdempotencyKey: text("card_idempotency_key").notNull().unique("wedding_sq_setup_card_key_uq"),
  squareCustomerId: text("square_customer_id"),
  squareCardId: text("square_card_id"),
  status: text("status").notNull().default("reserved"),
  customerPostAttemptedAt: timestamp("customer_post_attempted_at", { withTimezone: true }),
  cardPostAttemptedAt: timestamp("card_post_attempted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  unresolvedUser: uniqueIndex("wedding_square_card_setup_one_unresolved_user_idx").on(t.userId).where(sql`${t.status} IN ('reserved','customer_submitting','customer_confirmed','card_submitting','needs_reconciliation')`),
  providerCard: uniqueIndex("wedding_square_card_setup_provider_card_idx").on(t.squareEnvironment, t.squareMerchantId, t.squareCardId).where(sql`${t.squareCardId} IS NOT NULL`),
  nonceDigest: uniqueIndex("wedding_square_card_setup_source_digest_idx").on(t.squareEnvironment,t.sourceDigest),
  userHistory: index("wedding_square_card_setup_user_history_idx").on(t.userId, t.createdAt.desc()),
  sandboxCheck: check("wedding_sq_setup_sandbox_ck", sql`${t.squareEnvironment} = 'sandbox'`),
  tierCheck: check("wedding_sq_setup_tier_ck", sql`${t.tier} IN ('premium','elite')`),
  currencyCheck: check("wedding_sq_setup_currency_ck", sql`${t.consentedCurrency} = 'USD'`),
  timezoneCheck: check("wedding_sq_setup_timezone_ck", sql`${t.requestedTimezone} = 'UTC'`),
  sourceCheck: check("wedding_sq_setup_source_ck", sql`${t.sourceDigest} ~ '^[0-9a-f]{64}$'`),
  customerKeyCheck: check("wedding_sq_setup_customer_key_ck", sql`length(${t.customerIdempotencyKey}) BETWEEN 1 AND 45`),
  cardKeyCheck: check("wedding_sq_setup_card_key_ck", sql`length(${t.cardIdempotencyKey}) BETWEEN 1 AND 45`),
  statusCheck: check("wedding_sq_setup_status_ck", sql`${t.status} IN ('reserved','customer_submitting','customer_confirmed','card_submitting','needs_reconciliation','confirmed','aborted')`),
  amountCheck: check("wedding_sq_setup_amount_ck", sql`(${t.tier}='premium' AND ${t.consentedAmountCents}=2499) OR (${t.tier}='elite' AND ${t.consentedAmountCents}=4999)`),
  trialDateCheck: check("wedding_sq_setup_trial_date_ck", sql`${t.trialExpiresAt} IS NULL OR (${t.requestedStartDate} IS NOT NULL AND (${t.requestedStartDate}::timestamp AT TIME ZONE 'UTC') >= ${t.trialExpiresAt})`),
  customerProgressCheck: check("wedding_sq_setup_customer_progress_ck", sql`${t.status} NOT IN ('customer_confirmed','card_submitting','confirmed') OR ${t.squareCustomerId} IS NOT NULL`),
  cardConfirmedCheck: check("wedding_sq_setup_card_confirmed_ck", sql`${t.status} <> 'confirmed' OR ${t.squareCardId} IS NOT NULL`),
}));
