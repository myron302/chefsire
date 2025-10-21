import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema"; // re-use existing users table from your current schema.ts

// ===== STORES (user storefronts) =====
export const stores = pgTable(
  "stores",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull().unique(),
    username: text("username").notNull().unique(), // public handle for /store/:username
    name: text("name").notNull(),
    theme: text("theme").default("light"),
    layout: jsonb("layout").$type<Record<string, any>>(),
    published: boolean("published").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    publishedIdx: index("stores_published_idx").on(t.published),
  })
);

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
