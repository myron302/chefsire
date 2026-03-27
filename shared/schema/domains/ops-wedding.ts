import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, date, bigserial, jsonb, decimal, index } from "drizzle-orm/pg-core";
import { users } from "./users-auth";
import { orders } from "./commerce-billing";

/* ===== STORES TABLE ===== */
export const stores = pgTable(
  "stores",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull()
      .unique(),
    handle: text("handle").notNull().unique(),
    name: text("name").notNull(),
    bio: text("bio"),
    theme: jsonb("theme").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
    layout: jsonb("layout").$type<Record<string, any>>(),
    published: boolean("published").default(false),
    viewCount: integer("view_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    handleIdx: index("stores_handle_idx").on(t.handle),
    userIdIdx: index("stores_user_id_idx").on(t.userId),
    publishedIdx: index("stores_published_idx").on(t.published),
  })
);

/* ===== PAYMENT METHODS ===== */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    provider: text("provider").notNull(), // square, stripe, paypal
    providerId: text("provider_id").notNull(), // external account ID from provider
    accountStatus: text("account_status").default("pending"), // pending, active, disabled, rejected
    accountType: text("account_type"), // individual, business
    accountEmail: text("account_email"),
    accountDetails: jsonb("account_details").$type<{
      merchantId?: string;
      locationId?: string;
      accessToken?: string; // encrypted
      refreshToken?: string; // encrypted
      tokenExpiresAt?: string;
    }>(),
    isDefault: boolean("is_default").default(false),
    verifiedAt: timestamp("verified_at"),
    lastVerifiedAt: timestamp("last_verified_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    userIdx: index("payment_methods_user_idx").on(t.userId),
    providerIdx: index("payment_methods_provider_idx").on(t.provider),
    statusIdx: index("payment_methods_status_idx").on(t.accountStatus),
  })
);

/* ===== COMMISSIONS ===== */
export const commissions = pgTable(
  "commissions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orderId: varchar("order_id").references(() => orders.id).notNull(),
    sellerId: varchar("seller_id").references(() => users.id).notNull(),
    subscriptionTier: text("subscription_tier").notNull(),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(), // percentage
    orderTotal: decimal("order_total", { precision: 10, scale: 2 }).notNull(),
    commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
    sellerAmount: decimal("seller_amount", { precision: 10, scale: 2 }).notNull(),
    payoutId: varchar("payout_id").references(() => payouts.id),
    status: text("status").default("pending"), // pending, paid, refunded
    createdAt: timestamp("created_at").defaultNow(),
    paidAt: timestamp("paid_at"),
  },
  (t) => ({
    orderIdx: index("commissions_order_idx").on(t.orderId),
    sellerIdx: index("commissions_seller_idx").on(t.sellerId),
    payoutIdx: index("commissions_payout_idx").on(t.payoutId),
    statusIdx: index("commissions_status_idx").on(t.status),
  })
);

/* ===== PAYOUTS ===== */
export const payouts = pgTable(
  "payouts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sellerId: varchar("seller_id").references(() => users.id).notNull(),
    paymentMethodId: varchar("payment_method_id").references(() => paymentMethods.id),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").default("USD"),
    provider: text("provider").notNull(), // square, stripe, paypal
    providerPayoutId: text("provider_payout_id"), // external payout ID from provider
    status: text("status").default("pending"), // pending, processing, completed, failed, cancelled
    failureReason: text("failure_reason"),
    scheduledFor: timestamp("scheduled_for"),
    processedAt: timestamp("processed_at"),
    completedAt: timestamp("completed_at"),
    metadata: jsonb("metadata").$type<{
      ordersCount?: number;
      dateRange?: { from: string; to: string };
      accountDetails?: Record<string, any>;
    }>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    sellerIdx: index("payouts_seller_idx").on(t.sellerId),
    statusIdx: index("payouts_status_idx").on(t.status),
    scheduledIdx: index("payouts_scheduled_idx").on(t.scheduledFor),
    providerPayoutIdx: index("payouts_provider_payout_idx").on(t.providerPayoutId),
  })
);

/* ===== PAYOUT SCHEDULES ===== */
export const payoutSchedules = pgTable(
  "payout_schedules",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sellerId: varchar("seller_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
    frequency: text("frequency").default("weekly"), // daily, weekly, biweekly, monthly
    dayOfWeek: integer("day_of_week"), // 0-6 for weekly (Sunday = 0)
    dayOfMonth: integer("day_of_month"), // 1-31 for monthly
    minimumAmount: decimal("minimum_amount", { precision: 10, scale: 2 }).default("25.00"), // minimum payout threshold
    isActive: boolean("is_active").default(true),
    lastPayoutAt: timestamp("last_payout_at"),
    nextPayoutAt: timestamp("next_payout_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    sellerIdx: index("payout_schedules_seller_idx").on(t.sellerId),
    activeIdx: index("payout_schedules_active_idx").on(t.isActive),
    nextPayoutIdx: index("payout_schedules_next_payout_idx").on(t.nextPayoutAt),
  })
);

/* ===== ✅ NEW: EMAIL VERIFICATION TOKENS ===== */
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    // keep consistent with your string UUID style
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    // references users.id (varchar UUID)
    userId: varchar("user_id").references(() => users.id).notNull(),

    // SHA-256 hex string (64 chars)
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),

    // email being verified
    email: varchar("email", { length: 255 }).notNull(),

    // 30 minute default expiry
    expiresAt: timestamp("expires_at").notNull().default(sql`now() + interval '30 minutes'`),

    // set once used
    consumedAt: timestamp("consumed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("evt_user_idx").on(t.userId),
    tokenIdx: index("evt_token_hash_idx").on(t.tokenHash),
  })
);

// Wedding RSVP Invitations Table
export const weddingRsvpInvitations = pgTable(
  "wedding_rsvp_invitations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    // The user who created the wedding event (couple)
    userId: varchar("user_id").references(() => users.id).notNull(),

    // Guest information
    guestName: varchar("guest_name", { length: 255 }).notNull(),
    guestEmail: varchar("guest_email", { length: 255 }).notNull(),

    // RSVP token (hashed)
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),

    // RSVP status
    rsvpStatus: varchar("rsvp_status", { length: 20 }).notNull().default("pending"), // 'pending', 'accepted', 'declined'

    // Plus one allowed
    plusOne: boolean("plus_one").default(false),

    // Name of the guest's plus-one (if provided). When a guest RSVP's with a
    // companion, this field stores the companion's name so the couple can
    // accurately track attendance. Nullable because many invitations will
    // either not allow a plus-one or the guest may decline to provide the
    // name. The frontend should only display this field if the invitation
    // explicitly allows a plus-one.
    plusOneName: varchar("plus_one_name", { length: 255 }),

    // Optional: Wedding event details
    eventDate: timestamp("event_date"),
    eventLocation: text("event_location"),
    eventMessage: text("event_message"),

    // Token expiry (30 days by default)
    expiresAt: timestamp("expires_at").notNull().default(sql`now() + interval '30 days'`),

    // When the guest responded
    respondedAt: timestamp("responded_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("wri_user_idx").on(t.userId),
    tokenIdx: index("wri_token_hash_idx").on(t.tokenHash),
    emailIdx: index("wri_email_idx").on(t.guestEmail),
  })
);


// Wedding Event Details (saved per user/couple)
// Stores partner names, ceremony/reception details, and the chosen email template.
// One row per user; we use user_id as the primary key so upserts are easy.
export const weddingEventDetails = pgTable(
  "wedding_event_details",
  {
    userId: varchar("user_id").primaryKey().references(() => users.id).notNull(),

    partner1Name: varchar("partner1_name", { length: 255 }),
    partner2Name: varchar("partner2_name", { length: 255 }),

    ceremonyDate: timestamp("ceremony_date"),
    ceremonyTime: varchar("ceremony_time", { length: 20 }),
    ceremonyLocation: text("ceremony_location"),

    receptionDate: timestamp("reception_date"),
    receptionTime: varchar("reception_time", { length: 20 }),
    receptionLocation: text("reception_location"),

    useSameLocation: boolean("use_same_location").default(false),

    customMessage: text("custom_message"),
    selectedTemplate: varchar("selected_template", { length: 32 }).default("elegant"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("wedding_event_details_user_idx").on(t.userId),
  })
);

// Wedding Planning Calendar Events (saved per user/couple)
export const weddingCalendarEvents = pgTable(
  "wedding_calendar_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: varchar("user_id").references(() => users.id).notNull(),
    eventDate: date("event_date").notNull(),
    eventTime: varchar("event_time", { length: 10 }), // optional HH:MM
    title: text("title").notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    notes: text("notes"),
    reminder: boolean("reminder").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("wedding_calendar_events_user_idx").on(t.userId),
    dateIdx: index("wedding_calendar_events_date_idx").on(t.eventDate),
  })
);
