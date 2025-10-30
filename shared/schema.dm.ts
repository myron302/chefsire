// shared/schema.dm.ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Reuse your existing users table for foreign keys
// (This file MUST NOT be imported by shared/schema.ts to avoid cycles)
import { users } from "./schema.ts";

/* =========================================================================
   Direct Messages (DM) schema
   Tables:
     - dm_threads
     - dm_participants
     - dm_messages
   ========================================================================= */

export const dmThreads = pgTable(
  "dm_threads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    isGroup: boolean("is_group").notNull().default(false),
    title: text("title"), // optional: for group chats
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    isGroupIdx: index("dm_threads_is_group_idx").on(t.isGroup),
  })
);

// Attachment structure stored with each message
export type DmAttachment = {
  name: string;
  url: string; // presigned or public URL
  type?: string; // mime type hint
};

export const dmParticipants = pgTable(
  "dm_participants",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    threadId: varchar("thread_id")
      .notNull()
      .references(() => dmThreads.id, { onDelete: "cascade" }),

    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    role: text("role").notNull().default("member"), // owner | admin | member

    // Read state
    lastReadMessageId: varchar("last_read_message_id"),
    lastReadAt: timestamp("last_read_at"),

    // Notifications
    notificationsMuted: boolean("notifications_muted").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index("dm_participants_thread_idx").on(t.threadId),
    userIdx: index("dm_participants_user_idx").on(t.userId),
    uniqThreadUser: uniqueIndex("dm_participants_thread_user_uniq").on(
      t.threadId,
      t.userId
    ),
  })
);

export const dmMessages = pgTable(
  "dm_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    threadId: varchar("thread_id")
      .notNull()
      .references(() => dmThreads.id, { onDelete: "cascade" }),

    senderId: varchar("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    body: text("body").notNull(), // message text

    attachments: jsonb("attachments")
      .$type<DmAttachment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index("dm_messages_thread_idx").on(t.threadId),
    threadCreatedIdx: index("dm_messages_thread_created_idx").on(
      t.threadId,
      t.createdAt
    ),
  })
);

/* =========================================================================
   Insert Schemas (optional but consistent with your style)
   ========================================================================= */
export const insertDmThreadSchema = createInsertSchema(dmThreads).omit({
  id: true,
  createdAt: true,
});

export const insertDmParticipantSchema = createInsertSchema(dmParticipants).omit({
  id: true,
  createdAt: true,
  lastReadAt: true,
  lastReadMessageId: true,
  notificationsMuted: true,
});

export const insertDmMessageSchema = createInsertSchema(dmMessages).omit({
  id: true,
  createdAt: true,
});

/* =========================================================================
   Types
   ========================================================================= */
export type DmThread = typeof dmThreads.$inferSelect;
export type InsertDmThread = z.infer<typeof insertDmThreadSchema>;

export type DmParticipant = typeof dmParticipants.$inferSelect;
export type InsertDmParticipant = z.infer<typeof insertDmParticipantSchema>;

export type DmMessage = typeof dmMessages.$inferSelect;
export type InsertDmMessage = z.infer<typeof insertDmMessageSchema>;
