import { Router } from "express";
import { db } from "../db";
import { storeDrops, stores, follows, notifications } from "../../shared/schema.js";
import { products } from "../../shared/schema/domains/commerce-billing.js";
import { eq, count, sql, lt, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

// POST /api/stores/:id/drops — create a drop and fan out to followers
// TODO(v2): For merchants with > 50,000 followers, consider a background job for the fan-out
//           instead of blocking the HTTP response on N notification inserts.
router.post("/:id/drops", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { id: storeId } = req.params;
    const { productId, message: rawMessage } = req.body as { productId: string; message?: string };

    // Validate message
    const message = rawMessage?.trim() || null;
    if (message !== null && message.length === 0) {
      return res.status(400).json({ ok: false, error: "Message cannot be blank" });
    }
    if (message && message.length > 140) {
      return res.status(400).json({ ok: false, error: "Message must be 140 characters or fewer" });
    }

    // Ownership check
    const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
    if (!store || store.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    // Validate productId belongs to this store's owner
    if (!productId) {
      return res.status(400).json({ ok: false, error: "productId is required" });
    }
    const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!product || product.sellerId !== req.user.id) {
      return res.status(400).json({ ok: false, error: "Product not found or not owned by you" });
    }

    // Rate limit: one drop per merchant per rolling 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDrops = await db
      .select({ id: storeDrops.id, createdAt: storeDrops.createdAt })
      .from(storeDrops)
      .where(and(eq(storeDrops.ownerId, req.user.id), sql`${storeDrops.createdAt} > ${cutoff}`))
      .limit(1);

    if (recentDrops.length > 0) {
      const nextAllowedAt = new Date(recentDrops[0].createdAt.getTime() + 24 * 60 * 60 * 1000);
      const retryAfterSeconds = Math.ceil((nextAllowedAt.getTime() - Date.now()) / 1000);
      return res.status(429).json({
        ok: false,
        error: "You can only send one drop per 24 hours",
        retryAfterSeconds,
      });
    }

    // Snapshot follower count (consistent with stores-crud.ts fetchSocialProof)
    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(follows)
      .where(eq(follows.followingId, req.user.id));

    const recipientCount = Number(cnt ?? 0);

    // Create the drop record
    const [drop] = await db
      .insert(storeDrops)
      .values({
        storeId,
        ownerId: req.user.id,
        productId,
        message,
        recipientCount,
      })
      .returning();

    // Fan out notifications to all followers
    if (recipientCount > 0) {
      const followerRows = await db
        .select({ followerId: follows.followerId })
        .from(follows)
        .where(eq(follows.followingId, req.user.id));

      if (followerRows.length > 0) {
        await db.insert(notifications).values(
          followerRows.map((row) => ({
            userId: row.followerId,
            type: "store_drop",
            title: `${store.name} dropped a new product`,
            message: message ?? `${product.name} is now available in ${store.name}`,
            imageUrl: (product.images as string[])?.[0] ?? null,
            linkUrl: `/store/${store.handle}?drop=${drop.id}`,
            metadata: {
              dropId: drop.id,
              storeHandle: store.handle,
              productId,
              message,
            } as any,
            priority: "normal",
          })),
        );
      }
    }

    return res.json({
      ok: true,
      drop: {
        id: drop.id,
        recipientCount: drop.recipientCount,
        createdAt: drop.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating store drop:", error);
    return res.status(500).json({ ok: false, error: "Failed to create drop" });
  }
});

// GET /api/stores/:id/drops — list a merchant's drop history
router.get("/:id/drops", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { id: storeId } = req.params;
    const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
    if (!store || store.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    const before = req.query.before ? new Date(req.query.before as string) : null;

    const rows = await db
      .select({
        id: storeDrops.id,
        productId: storeDrops.productId,
        message: storeDrops.message,
        recipientCount: storeDrops.recipientCount,
        clickCount: storeDrops.clickCount,
        createdAt: storeDrops.createdAt,
        productName: products.name,
        productImages: products.images,
        productPrice: products.price,
      })
      .from(storeDrops)
      .leftJoin(products, eq(storeDrops.productId, products.id))
      .where(
        before
          ? and(eq(storeDrops.ownerId, req.user.id), lt(storeDrops.createdAt, before))
          : eq(storeDrops.ownerId, req.user.id),
      )
      .orderBy(desc(storeDrops.createdAt))
      .limit(50);

    return res.json({ ok: true, drops: rows });
  } catch (error) {
    console.error("Error fetching store drops:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drops" });
  }
});

// POST /api/stores/drops/:dropId/click — record a tap-through (public, best-effort)
router.post("/drops/:dropId/click", async (req, res) => {
  try {
    const { dropId } = req.params;
    await db
      .update(storeDrops)
      .set({ clickCount: sql`${storeDrops.clickCount} + 1` })
      .where(eq(storeDrops.id, dropId));
  } catch {
    // best-effort — never surface to caller
  }
  return res.json({ ok: true });
});

export default router;
