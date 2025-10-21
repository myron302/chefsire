// /httpdocs/server/db/schema/users.ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  decimal,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Minimal users table compatible with your app + Square updates.
 * (Includes the subscription fields used by /routes/square.ts)
 */
export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    // basic identity (keep if you already had these columns in prod)
    username: text("username").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),

    // Profile bits you already use in the UI (safe to keep)
    bio: text("bio"),
    avatar: text("avatar"),
    isChef: boolean("is_chef").default(false),
    followersCount: integer("followers_count").default(0),
    followingCount: integer("following_count").default(0),
    postsCount: integer("posts_count").default(0),

    // 🔐 Square subscription fields (what the webhook updates)
    subscriptionTier: text("subscription_tier").default("free"),          // "free" | "pro" | "enterprise"
    subscriptionStatus: text("subscription_status").default("inactive"),  // "inactive" | "active" | "trialing" | "paused" | "canceled"
    subscriptionEndsAt: timestamp("subscription_ends_at"),

    // Optional revenue stat you had in the big schema
    monthlyRevenue: decimal("monthly_revenue", { precision: 10, scale: 2 }).default("0"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    usernameIdx: index("users_username_idx").on(t.username),
    emailIdx: index("users_email_idx").on(t.email),
    subscriptionTierIdx: index("users_subscription_tier_idx").on(t.subscriptionTier),
  })
);

// (Optionally export types if you want them here)
// export type User = typeof users.$inferSelect;
