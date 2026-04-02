import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const defineCreatorMembershipSchema = ({ users }: { users: any }) => {
  const creatorMembershipPlans = pgTable(
    "creator_membership_plans",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      slug: varchar("slug", { length: 160 }).notNull(),
      name: varchar("name", { length: 160 }).notNull(),
      description: text("description"),
      priceCents: integer("price_cents").notNull(),
      billingInterval: text("billing_interval").default("monthly").notNull(),
      isActive: boolean("is_active").default(true).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      creatorIdx: uniqueIndex("creator_membership_plans_creator_idx").on(table.creatorUserId),
      slugIdx: uniqueIndex("creator_membership_plans_slug_idx").on(table.slug),
      activeIdx: index("creator_membership_plans_active_idx").on(table.isActive),
    })
  );

  const creatorMemberships = pgTable(
    "creator_memberships",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      planId: varchar("plan_id").references(() => creatorMembershipPlans.id, { onDelete: "cascade" }).notNull(),
      status: text("status").default("active").notNull(),
      startedAt: timestamp("started_at").defaultNow().notNull(),
      endsAt: timestamp("ends_at"),
      canceledAt: timestamp("canceled_at"),
      squareSubscriptionId: text("square_subscription_id"),
      paymentReference: text("payment_reference"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      userIdx: index("creator_memberships_user_idx").on(table.userId),
      creatorIdx: index("creator_memberships_creator_idx").on(table.creatorUserId),
      statusIdx: index("creator_memberships_status_idx").on(table.status),
      userCreatorIdx: uniqueIndex("creator_memberships_user_creator_idx").on(table.userId, table.creatorUserId),
    })
  );

  const creatorMembershipCheckoutSessions = pgTable(
    "creator_membership_checkout_sessions",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      planId: varchar("plan_id").references(() => creatorMembershipPlans.id, { onDelete: "cascade" }).notNull(),
      provider: text("provider").default("square").notNull(),
      status: text("status").default("pending").notNull(),
      amountCents: integer("amount_cents").notNull(),
      currencyCode: text("currency_code").default("USD").notNull(),
      squarePaymentLinkId: text("square_payment_link_id"),
      squareOrderId: text("square_order_id"),
      squarePaymentId: text("square_payment_id"),
      providerReferenceId: text("provider_reference_id").notNull().unique(),
      checkoutUrl: text("checkout_url"),
      lastVerifiedAt: timestamp("last_verified_at"),
      verifiedAt: timestamp("verified_at"),
      failureReason: text("failure_reason"),
      expiresAt: timestamp("expires_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      userIdx: index("creator_membership_checkout_sessions_user_idx").on(table.userId),
      creatorIdx: index("creator_membership_checkout_sessions_creator_idx").on(table.creatorUserId),
      planIdx: index("creator_membership_checkout_sessions_plan_idx").on(table.planId),
      statusIdx: index("creator_membership_checkout_sessions_status_idx").on(table.status),
      paymentLinkIdx: uniqueIndex("creator_membership_checkout_sessions_payment_link_idx").on(table.squarePaymentLinkId),
      orderIdx: uniqueIndex("creator_membership_checkout_sessions_order_idx").on(table.squareOrderId),
    })
  );

  const creatorMembershipSalesLedger = pgTable(
    "creator_membership_sales_ledger",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      membershipId: varchar("membership_id").references(() => creatorMemberships.id, { onDelete: "set null" }),
      checkoutSessionId: varchar("checkout_session_id").references(() => creatorMembershipCheckoutSessions.id, { onDelete: "set null" }),
      planId: varchar("plan_id").references(() => creatorMembershipPlans.id, { onDelete: "set null" }),
      grossAmountCents: integer("gross_amount_cents").notNull(),
      currencyCode: text("currency_code").default("USD").notNull(),
      status: text("status").default("completed").notNull(),
      statusReason: text("status_reason"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      userIdx: index("creator_membership_sales_ledger_user_idx").on(table.userId),
      creatorIdx: index("creator_membership_sales_ledger_creator_idx").on(table.creatorUserId),
      membershipIdx: uniqueIndex("creator_membership_sales_ledger_membership_idx").on(table.membershipId),
      checkoutIdx: uniqueIndex("creator_membership_sales_ledger_checkout_idx").on(table.checkoutSessionId),
      statusIdx: index("creator_membership_sales_ledger_status_idx").on(table.status),
    })
  );

  return {
    creatorMembershipPlans,
    creatorMemberships,
    creatorMembershipCheckoutSessions,
    creatorMembershipSalesLedger,
  };
};
