// server/routes/stores.ts
import "dotenv/config";
import { Router, Request, Response } from "express";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { and, eq, ilike } from "drizzle-orm";
import { stores } from "../../shared/storeSchema.js";

// If you have a products table, import it here and wire the join.import { Router } from "express";
import { and, eq } from "drizzle-orm";

// ⬇️ Adjust these two import paths only if your project structure is different
import { db } from "../db";                    // e.g. server/db.ts exports `db`
import { stores, users } from "../db/schema";  // the file you pasted your schema into

const router = Router();

/** Basic username sanitizer so URLs are clean and unique */
function sanitizeUsername(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

/**
 * GET /api/stores/:username
 * Public storefront fetch by handle. Only returns if `published = true`.
 */
router.get("/:username", async (req, res) => {
  try {
    const username = sanitizeUsername(req.params.username || "");
    const rows = await db
      .select()
      .from(stores)
      .where(and(eq(stores.username, username), eq(stores.published, true)))
      .limit(1);

    const store = rows[0];
    if (!store) return res.status(404).json({ ok: false, error: "Store not found" });

    return res.json({ ok: true, store });
  } catch (err) {
    console.error("GET /stores/:username error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * GET /api/stores/by-user/:userId
 * Owner fetch (can return an unpublished draft too).
 */
router.get("/by-user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const rows = await db.select().from(stores).where(eq(stores.userId, userId)).limit(1);
    return res.json({ ok: true, store: rows[0] ?? null });
  } catch (err) {
    console.error("GET /stores/by-user/:userId error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * POST /api/stores
 * Create or upsert a store for a user.
 * Body: { userId, username, name, theme?, layout? }
 */
router.post("/", async (req, res) => {
  try {
    const { userId, username, name, theme, layout } = req.body || {};
    if (!userId || !username || !name) {
      return res.status(400).json({ ok: false, error: "userId, username, and name are required" });
    }

    // ensure user exists (optional but nice)
    const userExists = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!userExists[0]) {
      return res.status(400).json({ ok: false, error: "User does not exist" });
    }

    const cleanUsername = sanitizeUsername(username);
    const now = new Date();

    // Do we already have a store for this user?
    const existing = await db.select().from(stores).where(eq(stores.userId, userId)).limit(1);

    if (existing[0]) {
      // Update
      const current = existing[0];

      // If the username changed, we rely on unique index to prevent collisions.
      const [updated] = await db
        .update(stores)
        .set({
          username: cleanUsername,
          name,
          theme: theme ?? current.theme,
          layout: layout ?? current.layout,
          updatedAt: now,
        })
        .where(eq(stores.id, current.id))
        .returning();

      return res.json({ ok: true, store: updated });
    }

    // Create new
    const [created] = await db
      .insert(stores)
      .values({
        userId,
        username: cleanUsername,
        name,
        theme: theme ?? "light",
        layout: layout ?? null,
        published: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return res.status(201).json({ ok: true, store: created });
  } catch (err: any) {
    console.error("POST /stores error", err);
    // Handle unique constraint errors nicely
    const message = String(err?.message || "");
    if (message.includes("stores_username_unique_idx")) {
      return res.status(409).json({ ok: false, error: "Username already taken" });
    }
    if (message.includes("stores_user_unique_idx")) {
      return res.status(409).json({ ok: false, error: "User already has a store" });
    }
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * PUT /api/stores/:id
 * Update draft fields. Body: { name?, theme?, layout? }
 */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { name, theme, layout } = req.body || {};
    const now = new Date();

    const rows = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    if (!rows[0]) return res.status(404).json({ ok: false, error: "Store not found" });

    const [updated] = await db
      .update(stores)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(theme !== undefined ? { theme } : {}),
        ...(layout !== undefined ? { layout } : {}),
        updatedAt: now,
      })
      .where(eq(stores.id, id))
      .returning();

    return res.json({ ok: true, store: updated });
  } catch (err) {
    console.error("PUT /stores/:id error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * POST /api/stores/:id/publish
 * Publish a store (simple gate; add your own checks if needed).
 */
router.post("/:id/publish", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    if (!rows[0]) return res.status(404).json({ ok: false, error: "Store not found" });

    const [updated] = await db
      .update(stores)
      .set({ published: true, updatedAt: new Date() })
      .where(eq(stores.id, id))
      .returning();

    return res.json({ ok: true, store: updated });
  } catch (err) {
    console.error("POST /stores/:id/publish error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * GET /api/stores/exists/:username
 * Quick availability check for a handle.
 */
router.get("/exists/:username", async (req, res) => {
  try {
    const username = sanitizeUsername(req.params.username || "");
    const rows = await db.select({ id: stores.id }).from(stores).where(eq(stores.username, username)).limit(1);
    return res.json({ ok: true, exists: Boolean(rows[0]) });
  } catch (err) {
    console.error("GET /stores/exists/:username error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;

// import { products } from "../../shared/schema.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is missing. Set it in server/.env");

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

const router = Router();

// ---- helpers ----
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 64);

// In real app, get userId from auth middleware/session.
const getUserId = (req: Request): string | null => {
  // Example only: accept "x-user-id" header for now
  const id = req.header("x-user-id");
  return id || null;
};

// ---- Routes ----

// GET /api/stores/:handle (public)
router.get("/:handle", async (req: Request, res: Response) => {
  try {
    const { handle } = req.params;
    const [row] = await db.select().from(stores).where(eq(stores.handle, handle)).limit(1);
    if (!row) return res.status(404).json({ error: "Store not found" });
    return res.json({ store: row });
  } catch (e) {
    console.error("GET /stores/:handle error", e);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/stores/by-user/:userId (owner or public preview)
router.get("/by-user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const [row] = await db.select().from(stores).where(eq(stores.userId, userId)).limit(1);
    return res.json({ store: row ?? null });
  } catch (e) {
    console.error("GET /stores/by-user/:userId error", e);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/stores (create or upsert for current user)
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { name, handle: rawHandle, bio } = req.body as { name: string; handle?: string; bio?: string };
    if (!name) return res.status(400).json({ error: "name is required" });

    const handle = rawHandle ? slugify(rawHandle) : slugify(name);

    // do we already have a store?
    const [existing] = await db.select().from(stores).where(eq(stores.userId, userId)).limit(1);
    if (existing) {
      // update minimal fields
      const [updated] = await db
        .update(stores)
        .set({ name, bio: bio ?? existing.bio, handle, updatedAt: new Date() })
        .where(eq(stores.id, existing.id))
        .returning();
      return res.json({ store: updated });
    }

    // create
    const [created] = await db
      .insert(stores)
      .values({
        userId,
        name,
        handle,
        bio: bio ?? "",
        theme: {},
        layout: null,
        published: false,
      })
      .returning();
    return res.status(201).json({ store: created });
  } catch (e) {
    console.error("POST /stores error", e);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/stores/:id (update metadata/theme)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { name, bio, theme, handle } = req.body as {
      name?: string;
      bio?: string;
      theme?: Record<string, unknown>;
      handle?: string;
    };

    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (theme !== undefined) updates.theme = theme;
    if (handle !== undefined) updates.handle = slugify(handle);

    const [row] = await db.update(stores).set(updates).where(eq(stores.id, id)).returning();
    return res.json({ store: row });
  } catch (e) {
    console.error("PUT /stores/:id error", e);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/stores/:id/layout (save CraftJS JSON)
router.put("/:id/layout", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { layout } = req.body as { layout: unknown };

    const [row] = await db.update(stores).set({ layout, updatedAt: new Date() }).where(eq(stores.id, id)).returning();
    return res.json({ store: row });
  } catch (e) {
    console.error("PUT /stores/:id/layout error", e);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/stores/:id/publish
router.put("/:id/publish", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { published } = req.body as { published: boolean };

    const [row] = await db.update(stores).set({ published, updatedAt: new Date() }).where(eq(stores.id, id)).returning();
    return res.json({ store: row });
  } catch (e) {
    console.error("PUT /stores/:id/publish error", e);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/stores/:handle/products (public; optional join if you have products)
router.get("/:handle/products", async (req: Request, res: Response) => {
  try {
    const { handle } = req.params;
    const [store] = await db.select().from(stores).where(eq(stores.handle, handle)).limit(1);
    if (!store) return res.status(404).json({ error: "Store not found" });

    // If you have products, query here by storeId or sellerUserId.
    // const rows = await db.select().from(products).where(eq(products.storeId, store.id));
    const rows: any[] = []; // placeholder to avoid breaking if products not ready
    return res.json({ products: rows });
  } catch (e) {
    console.error("GET /stores/:handle/products error", e);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
