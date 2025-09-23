// server/routes/marketplace.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const r = Router();

// Create product
r.post("/products", async (req, res) => {
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
      isActive: z.boolean().optional(),
      isExternal: z.boolean().default(false),
      externalUrl: z.string().url().optional(),
    });
    const productData = schema.parse(req.body);

    const product = await storage.createProduct(productData);
    res.status(201).json({ message: "Product created successfully", product });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid product data", errors: e.errors });
    }
    console.error("[marketplace] create product error:", e);
    res.status(500).json({ message: "Failed to create product" });
  }
});

// Get product by id (and bump views)
r.get("/products/:id", async (req, res) => {
  try {
    const product = await storage.getProductWithSeller(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    await storage.updateProduct(req.params.id, {
      viewsCount: (product.viewsCount || 0) + 1,
    });

    res.json(product);
  } catch (e) {
    console.error("[marketplace] get product error:", e);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// Search products
r.get("/products", async (req, res) => {
  try {
    const schema = z.object({
      query: z.string().optional(),
      category: z.enum(["spices", "ingredients", "cookware", "cookbooks", "sauces", "other"]).optional(),
      location: z.string().optional(),
      localPickupOnly: z.coerce.boolean().default(false),
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

    res.json({ products, filters, total: products.length });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid search parameters", errors: e.errors });
    }
    console.error("[marketplace] search error:", e);
    res.status(500).json({ message: "Failed to search products" });
  }
});

// Seller's products
r.get("/sellers/:sellerId/products", async (req, res) => {
  try {
    const offset = parseInt((req.query.offset as string) || "0", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const products = await storage.getUserProducts(req.params.sellerId, offset, limit);
    res.json({ products, total: products.length, sellerId: req.params.sellerId });
  } catch (e) {
    console.error("[marketplace] seller products error:", e);
    res.status(500).json({ message: "Failed to fetch seller products" });
  }
});

// Update product
r.put("/products/:id", async (req, res) => {
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
    res.json({ message: "Product updated successfully", product });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid update data", errors: e.errors });
    }
    console.error("[marketplace] update product error:", e);
    res.status(500).json({ message: "Failed to update product" });
  }
});

// Deactivate / delete product
r.delete("/products/:id", async (req, res) => {
  try {
    const success = await storage.deleteProduct(req.params.id);
    if (!success) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deactivated successfully" });
  } catch (e) {
    console.error("[marketplace] delete product error:", e);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// Categories overview (counts)
r.get("/categories", async (_req, res) => {
  try {
    const allProducts = await storage.searchProducts(undefined, undefined, undefined, 0, 1000);
    const categories = {
      spices: allProducts.filter((p) => p.category === "spices").length,
      ingredients: allProducts.filter((p) => p.category === "ingredients").length,
      cookware: allProducts.filter((p) => p.category === "cookware").length,
      cookbooks: allProducts.filter((p) => p.category === "cookbooks").length,
      sauces: allProducts.filter((p) => p.category === "sauces").length,
      other: allProducts.filter((p) => p.category === "other").length,
    };
    res.json({ categories, totalProducts: allProducts.length });
  } catch (e) {
    console.error("[marketplace] categories error:", e);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// Storefront by username
r.get("/storefront/:username", async (req, res) => {
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
        subscriptionTier: user.subscriptionTier,
      },
    });
  } catch (e) {
    console.error("[marketplace] storefront error:", e);
    res.status(500).json({ message: "Failed to fetch storefront" });
  }
});

// Seller analytics (simple example)
r.get("/sellers/:sellerId/analytics", async (req, res) => {
  try {
    const user = await storage.getUser(req.params.sellerId);
    if (!user) return res.status(404).json({ message: "Seller not found" });

    const products = await storage.getUserProducts(req.params.sellerId, 0, 100);
    const analytics = {
      totalProducts: products.length,
      activeProducts: products.filter((p) => p.isActive).length,
      totalViews: products.reduce((sum, p) => sum + (p.viewsCount || 0), 0),
      totalSales: products.reduce((sum, p) => sum + (p.salesCount || 0), 0),
      monthlyRevenue: parseFloat(user.monthlyRevenue || "0"),
      subscriptionTier: user.subscriptionTier,
      currentCommissionRate:
        user.subscriptionTier === "free"
          ? 10
          : user.subscriptionTier === "starter"
          ? 8
          : user.subscriptionTier === "professional"
          ? 5
          : user.subscriptionTier === "enterprise"
          ? 3
          : 1,
    };

    res.json(analytics);
  } catch (e) {
    console.error("[marketplace] analytics error:", e);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

export default r;
