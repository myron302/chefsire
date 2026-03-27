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
import { users } from "../domains/users-auth";

export const dmThreads = pgTable(
  "dm_threads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    isGroup: boolean("is_group").notNull().default(false),
    title: text("title"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    isGroupIdx: index("dm_threads_is_group_idx").on(t.isGroup),
  })
);

export type DmAttachment = {
  name: string;
  url: string;
  type?: string;
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
    role: text("role").notNull().default("member"),
    lastReadMessageId: varchar("last_read_message_id"),
    lastReadAt: timestamp("last_read_at"),
    notificationsMuted: boolean("notifications_muted").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index("dm_participants_thread_idx").on(t.threadId),
    userIdx: index("dm_participants_user_idx").on(t.userId),
    uniqThreadUser: uniqueIndex("dm_participants_thread_user_uniq").on(t.threadId, t.userId),
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
    body: text("body").notNull(),
    attachments: jsonb("attachments")
      .$type<DmAttachment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index("dm_messages_thread_idx").on(t.threadId),
    senderIdx: index("dm_messages_sender_idx").on(t.senderId),
    threadCreatedIdx: index("dm_messages_thread_created_idx").on(t.threadId, t.createdAt),
  })
);

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

export type DmThread = typeof dmThreads.$inferSelect;
export type InsertDmThread = z.infer<typeof insertDmThreadSchema>;

export type DmParticipant = typeof dmParticipants.$inferSelect;
export type InsertDmParticipant = z.infer<typeof insertDmParticipantSchema>;

export type DmMessage = typeof dmMessages.$inferSelect;
export type InsertDmMessage = z.infer<typeof insertDmMessageSchema>;
