// server/db/index.ts
import "../lib/load-env"; // <-- hydrate env from Plesk or server/.env before reading it

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

/**
 * Drizzle + Neon connection (ESM friendly)
 * DATABASE_URL must come from Plesk env (prod) or server/.env (dev).
 */
let DATABASE_URL = process.env.DATABASE_URL?.trim();

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Set it in Plesk → Node.js → Custom environment variables, " +
    "or create /httpdocs/server/.env with DATABASE_URL=... (for NPM scripts)."
  );
}

// Ensure Neon SSL unless you already have it
if (!/[?&]sslmode=/.test(DATABASE_URL)) {
  DATABASE_URL += (DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=require";
}

export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool);

// Optional: graceful shutdown in scripts or when Plesk restarts
process.on("beforeExit", () => {
  try { pool.end(); } catch {}
});
// ===== STORES TABLE (user storefronts) =====
// Add this to the bottom of your existing server/db/schema.ts file

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
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    handleIdx: index("stores_handle_idx").on(t.handle),
    userIdIdx: index("stores_user_id_idx").on(t.userId),
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
