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
import { users } from "./schema"; // CHANGE: Import from schema.ts instead

// ===== STORES (user storefronts) =====
export const stores = pgTable(
  "stores",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull().unique(),
    handle: text("handle").notNull().unique(),
    name: text("name").notNull(),
    bio: text("bio"),
    theme: jsonb("theme").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
    layout: jsonb("layout").$type<Record<string, any>>(),
    published: boolean("published").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    handleIdx: index("stores_handle_idx").on(t.handle),
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
