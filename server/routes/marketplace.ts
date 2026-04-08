// server/routes/marketplace.ts
import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware";
import { SUBSCRIPTION_TIERS } from "./subscriptions";
import {
  addDeliveryMethods,
  mapProductsWithDeliveryMethods,
  parseDeliveryMethods,
} from "./marketplace/deliveryMethods";
import { createProductSchema, searchProductsSchema, updateProductSchema } from "./marketplace/schemas";
import { countProductsByCategory } from "./marketplace/utils";

const r = Router();

/**
 * Marketplace CRUD + search + simple analytics
 */

// Create product
r.post("/products", requireAuth, async (req, res) => {
  try {
    const sellerId = req.user!.id; // Use authenticated user

    // Check tier limits before allowing product creation
    const seller = await storage.getUser(sellerId);
    if (!seller) {
      return res.status(404).json({ message: "User not found" });
    }

    const tierName = (seller as any).subscriptionTier || "free";
    const tierInfo = SUBSCRIPTION_TIERS[tierName as keyof typeof SUBSCRIPTION_TIERS];

    // Check product limit - get existing products for all tiers
    const existingProducts = tierInfo.limits.maxProducts !== -1
      ? await storage.getUserProducts(sellerId, 0, tierInfo.limits.maxProducts + 1)
      : [];

    if (tierInfo.limits.maxProducts !== -1 && existingProducts.length >= tierInfo.limits.maxProducts) {
      return res.status(403).json({
        message: `Product limit reached. ${tierInfo.name} tier allows ${tierInfo.limits.maxProducts} products.`,
        error: "tier_limit_reached",
        currentTier: tierName,
        limit: tierInfo.limits.maxProducts,
        current: existingProducts.length,
        upgradeMessage: "Upgrade your subscription to list more products"
      });
    }

    const body = createProductSchema.parse(req.body);

    const deliveryData = parseDeliveryMethods(body.deliveryMethods);

    const product = await storage.createProduct({
      ...body,
      ...deliveryData,
      sellerId
    } as any);

    res.status(201).json({
      message: "Product created successfully",
      product: addDeliveryMethods(product),
      tierInfo: {
        name: tierInfo.name,
        productsRemaining: tierInfo.limits.maxProducts === -1 ?
          "unlimited" :
          tierInfo.limits.maxProducts - (existingProducts.length + 1)
      }
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid product data", details: e.issues });
    console.error("marketplace/create error:", e);
    console.error("Error details:", e.message, e.stack);
    res.status(500).json({ error: e.message || "Failed to create product" });
  }
});

// Read product (with seller)
r.get("/products/:id", async (req, res) => {
  try {
    const prod = await storage.getProductWithSeller(req.params.id);
    if (!prod) return res.status(404).json({ message: "Product not found" });
    res.json(addDeliveryMethods(prod));
  } catch (error) {
    console.error("marketplace/get error", error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// Search products
r.get("/products", async (req, res) => {
  try {
    const filters = searchProductsSchema.parse(req.query);
    const products = await storage.searchProducts(
      filters.query,
      filters.category,
      filters.location,
      filters.offset,
      filters.limit
    );

    const productsWithDelivery = mapProductsWithDeliveryMethods(products);
    res.json({ products: productsWithDelivery, total: productsWithDelivery.length, filters });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid search parameters", errors: e.issues });
    console.error("marketplace/search error", e);
    res.status(500).json({ message: "Failed to search products" });
  }
});

// Seller's products
r.get("/sellers/:sellerId/products", async (req, res) => {
  try {
    const parsedOffset = Number(req.query.offset ?? 0);
    const parsedLimit = Number(req.query.limit ?? 20);
    const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
    const limit = Number.isFinite(parsedLimit) && parsedLimit >= 1 ? Math.min(parsedLimit, 50) : 20;
    const items = await storage.getUserProducts(req.params.sellerId, offset, limit);
    const itemsWithDelivery = mapProductsWithDeliveryMethods(items);
    res.json({ products: itemsWithDelivery, total: itemsWithDelivery.length, sellerId: req.params.sellerId });
  } catch (error) {
    console.error("marketplace/seller products error", error);
    res.status(500).json({ message: "Failed to fetch seller products" });
  }
});

// Update product
r.put("/products/:id", requireAuth, async (req, res) => {
  try {
    const existingProduct = await storage.getProduct(req.params.id);
    if (!existingProduct) return res.status(404).json({ error: "Product not found" });
    if (existingProduct.sellerId !== req.user!.id) {
      return res.status(403).json({ error: "Not allowed to update this product" });
    }

    const body = updateProductSchema.parse(req.body);

    const deliveryData = parseDeliveryMethods(body.deliveryMethods);

    const updates = {
      ...body,
      ...deliveryData
    };

    const product = await storage.updateProduct(req.params.id, updates);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product updated", product: addDeliveryMethods(product) });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid update data", details: e.issues });
    console.error("marketplace/update error:", e);
    console.error("Error details:", e.message, e.stack);
    res.status(500).json({ error: e.message || "Failed to update product" });
  }
});

// Deactivate product
r.delete("/products/:id", requireAuth, async (req, res) => {
  try {
    const existingProduct = await storage.getProduct(req.params.id);
    if (!existingProduct) return res.status(404).json({ message: "Product not found" });
    if (existingProduct.sellerId !== req.user!.id) {
      return res.status(403).json({ message: "Not allowed to delete this product" });
    }

    const ok = await storage.deleteProduct(req.params.id);
    if (!ok) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deactivated" });
  } catch (error) {
    console.error("marketplace/delete error", error);
    res.status(500).json({ message: "Failed to delete product" });
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
        products: products.map(addDeliveryMethods),
        subscriptionTier: (user as any).subscriptionTier,
      },
    });
  } catch (error) {
    console.error("marketplace/storefront error", error);
    res.status(500).json({ message: "Failed to fetch storefront" });
  }
});

// Categories (simple aggregation)
r.get("/categories", async (_req, res) => {
  try {
    const all = await storage.searchProducts(undefined, undefined, undefined, 0, 1000);
    const counts = countProductsByCategory(all);
    res.json({ categories: counts, totalProducts: all.length });
  } catch (error) {
    console.error("marketplace/categories error", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// Simple seller analytics
r.get("/sellers/:sellerId/analytics", async (req, res) => {
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
  } catch (error) {
    console.error("marketplace/analytics error", error);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

export default r;
