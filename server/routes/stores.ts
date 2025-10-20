// server/routes/stores.ts
import "dotenv/config";
import { Router, Request, Response } from "express";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { and, eq, ilike } from "drizzle-orm";
import { stores } from "../../shared/storeSchema.js";

// If you have a products table, import it here and wire the join.
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
