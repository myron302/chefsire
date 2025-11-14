// server/routes/marketplace.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "../middleware";
import { SUBSCRIPTION_TIERS } from "./subscriptions";

const r = Router();

/**
 * Marketplace CRUD + search + simple analytics
 */

// Helper function to add deliveryMethods array to product objects
function addDeliveryMethods(product: any) {
  const deliveryMethods: string[] = [];
  if (product.shippingEnabled) deliveryMethods.push('shipped');
  if (product.localPickupEnabled) deliveryMethods.push('pickup');
  if (product.inStoreOnly) deliveryMethods.push('in_store');
  if (product.isDigital) deliveryMethods.push('digital_download');
  return { ...product, deliveryMethods };
}

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

    // Check product limit
    if (tierInfo.limits.maxProducts !== -1) {
      const existingProducts = await storage.getUserProducts(sellerId, 0, tierInfo.limits.maxProducts + 1);

      if (existingProducts.length >= tierInfo.limits.maxProducts) {
        return res.status(403).json({
          message: `Product limit reached. ${tierInfo.name} tier allows ${tierInfo.limits.maxProducts} products.`,
          error: "tier_limit_reached",
          currentTier: tierName,
          limit: tierInfo.limits.maxProducts,
          current: existingProducts.length,
          upgradeMessage: "Upgrade your subscription to list more products"
        });
      }
    }

    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/),
      category: z.string().default("other"), // Accept any string, default to "other"
      images: z.array(z.string().url()).default([]),
      inventory: z.number().min(0).default(0),
      imageUrl: z.string().optional().nullable(), // Allow empty string
      shippingEnabled: z.boolean().optional(),
      localPickupEnabled: z.boolean().optional(),
      pickupLocation: z.string().optional(),
      pickupInstructions: z.string().optional(),
      shippingCost: z.string().optional(),
      isExternal: z.boolean().default(false),
      externalUrl: z.string().url().optional().or(z.literal("")),
      productCategory: z.enum(["physical", "digital", "cookbook", "course", "ingredient", "tool"]).default("physical"),
      digitalFileUrl: z.string().optional().nullable(),
      digitalFileName: z.string().optional().nullable(),
      // Accept delivery methods array from frontend
      deliveryMethods: z.array(z.string()).optional(),
      isDigital: z.boolean().optional(),
      inStoreOnly: z.boolean().optional(),
    });

    const body = schema.parse(req.body);

    // Convert deliveryMethods array to individual boolean fields
    const deliveryData: any = {};
    if (body.deliveryMethods && body.deliveryMethods.length > 0) {
      deliveryData.shippingEnabled = body.deliveryMethods.includes('shipped');
      deliveryData.localPickupEnabled = body.deliveryMethods.includes('pickup');
      deliveryData.inStoreOnly = body.deliveryMethods.includes('in_store') &&
                                  !body.deliveryMethods.includes('shipped') &&
                                  !body.deliveryMethods.includes('pickup');
      deliveryData.isDigital = body.deliveryMethods.includes('digital_download');
    }

    // If imageUrl is provided and valid, add to images array
    const images = (body.imageUrl && body.imageUrl.trim() && !body.images.includes(body.imageUrl))
      ? [body.imageUrl, ...body.images]
      : body.images;

    const product = await storage.createProduct({
      ...body,
      ...deliveryData,
      images,
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
    const schema = z.object({
      query: z.string().optional(),
      category: z.enum(["spices", "ingredients", "cookware", "cookbooks", "sauces", "baked_goods", "prepared_foods", "beverages", "other"]).optional(),
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

    // Add deliveryMethods array to each product
    const productsWithDelivery = products.map(addDeliveryMethods);
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
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 20);
    const items = await storage.getUserProducts(req.params.sellerId, offset, limit);
    // Add deliveryMethods array to each product
    const itemsWithDelivery = items.map(addDeliveryMethods);
    res.json({ products: itemsWithDelivery, total: itemsWithDelivery.length, sellerId: req.params.sellerId });
  } catch (error) {
    console.error("marketplace/seller products error", error);
    res.status(500).json({ message: "Failed to fetch seller products" });
  }
});

// Update product
r.put("/products/:id", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      inventory: z.number().min(0).optional(),
      category: z.string().optional(),
      imageUrl: z.string().optional().nullable(),
      images: z.array(z.string().url()).optional(),
      shippingEnabled: z.boolean().optional(),
      localPickupEnabled: z.boolean().optional(),
      pickupLocation: z.string().optional(),
      pickupInstructions: z.string().optional(),
      shippingCost: z.string().optional(),
      isActive: z.boolean().optional(),
      productCategory: z.enum(["physical", "digital", "cookbook", "course", "ingredient", "tool"]).optional(),
      digitalFileUrl: z.string().optional().nullable(),
      digitalFileName: z.string().optional().nullable(),
      deliveryMethods: z.array(z.string()).optional(),
      isDigital: z.boolean().optional(),
      inStoreOnly: z.boolean().optional(),
    });

    const body = schema.parse(req.body);

    // Convert deliveryMethods array to individual boolean fields
    const deliveryData: any = {};
    if (body.deliveryMethods && body.deliveryMethods.length > 0) {
      deliveryData.shippingEnabled = body.deliveryMethods.includes('shipped');
      deliveryData.localPickupEnabled = body.deliveryMethods.includes('pickup');
      deliveryData.inStoreOnly = body.deliveryMethods.includes('in_store') &&
                                  !body.deliveryMethods.includes('shipped') &&
                                  !body.deliveryMethods.includes('pickup');
      deliveryData.isDigital = body.deliveryMethods.includes('digital_download');
    }

    // If imageUrl is provided and valid, add to images array
    let images = body.images;
    if (body.imageUrl && body.imageUrl.trim() && images && !images.includes(body.imageUrl)) {
      images = [body.imageUrl, ...images];
    }

    const updates = {
      ...body,
      ...deliveryData,
      ...(images ? { images } : {})
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
    const counts = {
      spices: all.filter((p: any) => p.category === "spices").length,
      ingredients: all.filter((p: any) => p.category === "ingredients").length,
      cookware: all.filter((p: any) => p.category === "cookware").length,
      cookbooks: all.filter((p: any) => p.category === "cookbooks").length,
      sauces: all.filter((p: any) => p.category === "sauces").length,
      baked_goods: all.filter((p: any) => p.category === "baked_goods").length,
      prepared_foods: all.filter((p: any) => p.category === "prepared_foods").length,
      beverages: all.filter((p: any) => p.category === "beverages").length,
      other: all.filter((p: any) => p.category === "other").length,
    };
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
