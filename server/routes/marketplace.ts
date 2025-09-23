// server/routes/marketplace.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

/**
 * POST /api/marketplace/products
 * Body: { sellerId, name, description?, price, category, images?, inventory?, ... }
 */
r.post("/products", async (req, res, next) => {
  try {
    const created = await storage.createProduct(req.body);
    res.status(201).json({ message: "Product created successfully", product: created });
  } catch (e) { next(e); }
});

/**
 * GET /api/marketplace/products/:id
 */
r.get("/products/:id", async (req, res, next) => {
  try {
    const product = await storage.getProductWithSeller(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // naive view increment (best-effort)
    const currentViews = (product as any).viewsCount ?? 0;
    await storage.updateProduct(req.params.id, { viewsCount: Number(currentViews) + 1 });

    res.json(product);
  } catch (e) { next(e); }
});

/**
 * GET /api/marketplace/products?query=&category=&location=&offset=&limit=
 */
r.get("/products", async (req, res, next) => {
  try {
    const query    = typeof req.query.query === "string" ? req.query.query : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const location = typeof req.query.location === "string" ? req.query.location : undefined;
    const offset   = Number(req.query.offset ?? 0);
    const limit    = Number(req.query.limit ?? 20);

    const products = await storage.searchProducts(query, category, location, offset, limit);
    res.json({ products, filters: { query, category, location }, total: products.length, offset, limit });
  } catch (e) { next(e); }
});

/**
 * GET /api/marketplace/sellers/:sellerId/products?offset=&limit=
 */
r.get("/sellers/:sellerId/products", async (req, res, next) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    const limit  = Number(req.query.limit ?? 20);
    const items  = await storage.getUserProducts(req.params.sellerId, offset, limit);
    res.json({ products: items, total: items.length, sellerId: req.params.sellerId, offset, limit });
  } catch (e) { next(e); }
});

/**
 * PUT /api/marketplace/products/:id
 */
r.put("/products/:id", async (req, res, next) => {
  try {
    const updated = await storage.updateProduct(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product updated successfully", product: updated });
  } catch (e) { next(e); }
});

/**
 * DELETE /api/marketplace/products/:id
 * Soft-delete (isActive=false)
 */
r.delete("/products/:id", async (req, res, next) => {
  try {
    const ok = await storage.deleteProduct(req.params.id);
    if (!ok) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deactivated successfully" });
  } catch (e) { next(e); }
});

/**
 * GET /api/marketplace/categories
 * Tallies counts by category (spices, ingredients, cookware, cookbooks, sauces, other)
 */
r.get("/categories", async (_req, res, next) => {
  try {
    const all = await storage.searchProducts(undefined, undefined, undefined, 0, 1000);
    const categories = {
      spices:      all.filter(p => p.category === "spices").length,
      ingredients: all.filter(p => p.category === "ingredients").length,
      cookware:    all.filter(p => p.category === "cookware").length,
      cookbooks:   all.filter(p => p.category === "cookbooks").length,
      sauces:      all.filter(p => p.category === "sauces").length,
      other:       all.filter(p => p.category === "other").length,
    };
    res.json({ categories, totalProducts: all.length });
  } catch (e) { next(e); }
});

/**
 * GET /api/marketplace/storefront/:username
 * Seller storefront by username
 */
r.get("/storefront/:username", async (req, res, next) => {
  try {
    const user = await storage.getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ message: "Storefront not found" });
    const products = await storage.getUserProducts(user.id, 0, 50);
    res.json({
      storefront: {
        seller: {
          id: user.id,
          username: user.username,
          displayName: (user as any).displayName,
          bio: (user as any).bio,
          avatar: (user as any).avatar,
          specialty: (user as any).specialty,
          isChef: (user as any).isChef,
          followersCount: (user as any).followersCount,
        },
        products,
        subscriptionTier: (user as any).subscriptionTier,
      },
    });
  } catch (e) { next(e); }
});

/**
 * GET /api/marketplace/sellers/:sellerId/analytics
 * Simple derived analytics for a seller
 */
r.get("/sellers/:sellerId/analytics", async (req, res, next) => {
  try {
    const user = await storage.getUser(req.params.sellerId);
    if (!user) return res.status(404).json({ message: "Seller not found" });
    const items = await storage.getUserProducts(req.params.sellerId, 0, 100);

    const analytics = {
      totalProducts: items.length,
      activeProducts: items.filter(p => (p as any).isActive !== false).length,
      totalViews: items.reduce((sum, p: any) => sum + (p.viewsCount || 0), 0),
      totalSales: items.reduce((sum, p: any) => sum + (p.salesCount || 0), 0),
      monthlyRevenue: Number((user as any).monthlyRevenue || 0),
      subscriptionTier: (user as any).subscriptionTier,
    };

    res.json(analytics);
  } catch (e) { next(e); }
});

export default r;
