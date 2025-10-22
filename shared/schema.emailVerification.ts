// shared/schema.emailVerification.ts
import { pgTable, serial, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  // store SHA-256 of the token, not the token itself
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().default(sql`now() + interval '30 minutes'`),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
