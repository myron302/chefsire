// server/routes/marketplace.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const r = Router();

/**
 * Marketplace CRUD + search + simple analytics
 */

// Create product
r.post("/marketplace/products", async (req, res) => {
  try {
    const schema = z.object({
      sellerId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/),
      category: z.enum(["spices", "ingredients", "cookware", "cookbooks", "sauces", "other"]),
      images: z.array(z.string().url()).default([]),
      inventory: z.number().min(0).default(0),
      shippingEnabled: z.boolean().default(true),
      localPickupEnabled: z.boolean().default(false),
      pickupLocation: z.string().optional(),
      pickupInstructions: z.string().optional(),
      shippingCost: z.string().optional(),
      isExternal: z.boolean().default(false),
      externalUrl: z.string().url().optional(),
    });

    const body = schema.parse(req.body);
    const product = await storage.createProduct(body as any);
    res.status(201).json({ message: "Product created", product });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid product data", errors: e.issues });
    console.error("marketplace/create error", e);
    res.status(500).json({ message: "Failed to create product" });
  }
});

// Read product (with seller)
r.get("/marketplace/products/:id", async (req, res) => {
  try {
    const prod = await storage.getProductWithSeller(req.params.id);
    if (!prod) return res.status(404).json({ message: "Product not found" });
    res.json(prod);
  } catch (e) {
    console.error("marketplace/get error", e);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// Search products
r.get("/marketplace/products", async (req, res) => {
  try {
    const schema = z.object({
      query: z.string().optional(),
      category: z.enum(["spices", "ingredients", "cookware", "cookbooks", "sauces", "other"]).optional(),
      location: z.string().optional(),
      offset: z.coerce.number().min(0).default(0),
      limit: z.coerce.number().min(1).max(50).default(20),
    });

    const filters = schema.parse(req.query);
    const products = await storage.searchProducts(
      filters.query,
      filters.category,
      filters.location,
      filters.offset,
      filters.limit
    );

    res.json({ products, total: products.length, filters });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid search parameters", errors: e.issues });
    console.error("marketplace/search error", e);
    res.status(500).json({ message: "Failed to search products" });
  }
});

// Seller's products
r.get("/marketplace/sellers/:sellerId/products", async (req, res) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 20);
    const items = await storage.getUserProducts(req.params.sellerId, offset, limit);
    res.json({ products: items, total: items.length, sellerId: req.params.sellerId });
  } catch (e) {
    console.error("marketplace/seller products error", e);
    res.status(500).json({ message: "Failed to fetch seller products" });
  }
});

// Update product
r.put("/marketplace/products/:id", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      inventory: z.number().min(0).optional(),
      shippingEnabled: z.boolean().optional(),
      localPickupEnabled: z.boolean().optional(),
      pickupLocation: z.string().optional(),
      pickupInstructions: z.string().optional(),
      shippingCost: z.string().optional(),
      isActive: z.boolean().optional(),
    });

    const updates = schema.parse(req.body);
    const product = await storage.updateProduct(req.params.id, updates);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product updated", product });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid update data", errors: e.issues });
    console.error("marketplace/update error", e);
    res.status(500).json({ message: "Failed to update product" });
  }
});

// Deactivate product
r.delete("/marketplace/products/:id", async (req, res) => {
  try {
    const ok = await storage.deleteProduct(req.params.id);
    if (!ok) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deactivated" });
  } catch (e) {
    console.error("marketplace/delete error", e);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// Storefront by username
r.get("/marketplace/storefront/:username", async (req, res) => {
  try {
    const user = await storage.getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ message: "Storefront not found" });

    const products = await storage.getUserProducts(user.id, 0, 50);
    res.json({
      storefront: {
        seller: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          avatar: user.avatar,
          specialty: user.specialty,
          isChef: user.isChef,
          followersCount: user.followersCount,
        },
        products,
        subscriptionTier: (user as any).subscriptionTier,
      },
    });
  } catch (e) {
    console.error("marketplace/storefront error", e);
    res.status(500).json({ message: "Failed to fetch storefront" });
  }
});

// Categories (simple aggregation)
r.get("/marketplace/categories", async (_req, res) => {
  try {
    const all = await storage.searchProducts(undefined, undefined, undefined, 0, 1000);
    const counts = {
      spices: all.filter((p: any) => p.category === "spices").length,
      ingredients: all.filter((p: any) => p.category === "ingredients").length,
      cookware: all.filter((p: any) => p.category === "cookware").length,
      cookbooks: all.filter((p: any) => p.category === "cookbooks").length,
      sauces: all.filter((p: any) => p.category === "sauces").length,
      other: all.filter((p: any) => p.category === "other").length,
    };
    res.json({ categories: counts, totalProducts: all.length });
  } catch (e) {
    console.error("marketplace/categories error", e);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// Simple seller analytics
r.get("/marketplace/sellers/:sellerId/analytics", async (req, res) => {
  try {
    const user = await storage.getUser(req.params.sellerId);
    if (!user) return res.status(404).json({ message: "Seller not found" });

    const products = await storage.getUserProducts(req.params.sellerId, 0, 200);
    const analytics = {
      totalProducts: products.length,
      activeProducts: products.filter((p: any) => p.isActive).length,
      // If your schema has viewsCount / salesCount, you can sum them here — otherwise return zeros.
      totalViews: products.reduce((sum: number, p: any) => sum + (p.viewsCount || 0), 0),
      totalSales: products.reduce((sum: number, p: any) => sum + (p.salesCount || 0), 0),
      monthlyRevenue: parseFloat((user as any).monthlyRevenue || "0"),
      subscriptionTier: (user as any).subscriptionTier || "free",
    };
    res.json(analytics);
  } catch (e) {
    console.error("marketplace/analytics error", e);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

export default r;
