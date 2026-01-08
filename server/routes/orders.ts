// server/routes/orders.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { orders, products, users, stores } from "../../shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "../middleware";
import { SUBSCRIPTION_TIERS } from "./subscriptions";
import { calculateSellerPayout, DeliveryMethod, ProductCategory } from "../lib/commissions";
import { sendOrderPlacedNotification, sendOrderStatusNotification } from "../services/notification-service";

const router = Router();

/**
 * ORDER PROCESSING SYSTEM
 * -----------------------
 * Handles checkout, order creation, and commission calculation
 */

// POST /api/orders/checkout - Create an order
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      productId: z.string(),
      quantity: z.number().min(1).max(100),
      deliveryMethod: z.enum(["shipped", "pickup", "in_store", "digital"]).default("shipped"),
      shippingAddress: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zipCode: z.string(),
        country: z.string().default("USA")
      }).optional(),
      fulfillmentMethod: z.enum(["shipping", "local_pickup"]),
      pickupNotes: z.string().optional()
    });

    const body = schema.parse(req.body);
    const buyerId = req.user!.id;

    // Get product details
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, body.productId))
      .limit(1);

    if (!product) {
      return res.status(404).json({ ok: false, error: "Product not found" });
    }

    if (!product.isActive) {
      return res.status(400).json({ ok: false, error: "Product is not available" });
    }

    // Check inventory
    if (product.inventory !== null && product.inventory < body.quantity) {
      return res.status(400).json({
        ok: false,
        error: `Only ${product.inventory} units available`
      });
    }

    // Validate fulfillment method
    if (body.fulfillmentMethod === "shipping" && !product.shippingEnabled) {
      return res.status(400).json({ ok: false, error: "Shipping not available for this product" });
    }

    if (body.fulfillmentMethod === "local_pickup" && !product.localPickupEnabled) {
      return res.status(400).json({ ok: false, error: "Local pickup not available for this product" });
    }

    // Get seller's store to determine subscription tier
    const [sellerStore] = await db
      .select()
      .from(stores)
      .where(eq(stores.userId, product.sellerId))
      .limit(1);

    const sellerTier = (sellerStore as any)?.subscriptionTier || "free";

    // Calculate amounts
    const productPrice = parseFloat(product.price);
    const shippingCost = body.deliveryMethod === "shipped" && product.shippingCost
      ? parseFloat(product.shippingCost)
      : 0;

    const subtotal = productPrice * body.quantity;
    const totalAmount = subtotal + shippingCost;

    // Get product category for commission calculation
    const productCategory = (product as any).productCategory || "physical";

    // Calculate commission based on tier, delivery method, and product category
    const { commission, payout } = calculateSellerPayout(
      subtotal,
      sellerTier,
      body.deliveryMethod as DeliveryMethod,
      productCategory as ProductCategory
    );

    const platformFee = commission;
    const sellerAmount = payout;

    // Create order
    const [newOrder] = await db
      .insert(orders)
      .values({
        buyerId,
        sellerId: product.sellerId,
        productId: product.id,
        quantity: body.quantity,
        totalAmount: totalAmount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        sellerAmount: sellerAmount.toFixed(2),
        deliveryMethod: body.deliveryMethod,
        shippingAddress: body.shippingAddress || null,
        fulfillmentMethod: body.fulfillmentMethod,
        status: "pending"
      })
      .returning();

    // Update product inventory
    if (product.inventory !== null) {
      await db
        .update(products)
        .set({
          inventory: product.inventory - body.quantity,
          salesCount: (product.salesCount || 0) + 1
        })
        .where(eq(products.id, product.id));
    }

    // Update seller's monthly revenue
    const currentRevenue = parseFloat((sellerStore as any)?.monthlyRevenue || "0");
    await db
      .update(users)
      .set({
        monthlyRevenue: (currentRevenue + sellerAmount).toFixed(2)
      })
      .where(eq(users.id, product.sellerId));

    // Send notification to seller
    const [buyer] = await db
      .select({ username: users.username, displayName: users.displayName, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, buyerId))
      .limit(1);

    if (buyer) {
      sendOrderPlacedNotification(
        product.sellerId,
        buyer.username || buyer.displayName || 'A customer',
        buyer.avatar,
        newOrder.id,
        product.name,
        parseFloat(newOrder.totalAmount)
      );
    }

    res.json({
      ok: true,
      message: "Order created successfully",
      order: {
        ...newOrder,
        product: {
          name: product.name,
          price: product.price,
          images: product.images,
          productCategory
        },
        breakdown: {
          subtotal: subtotal.toFixed(2),
          shippingCost: shippingCost.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          platformFee: platformFee.toFixed(2),
          commissionRate: `${((commission / subtotal) * 100).toFixed(1)}%`,
          deliveryMethod: body.deliveryMethod,
          sellerTier,
          sellerGets: sellerAmount.toFixed(2)
        }
      }
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid order data", errors: error.issues });
    }
    console.error("Error creating order:", error);
    res.status(500).json({ ok: false, error: "Failed to create order" });
  }
});

// GET /api/orders/my-purchases - Get buyer's orders
router.get("/my-purchases", requireAuth, async (req, res) => {
  try {
    const buyerId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const userOrders = await db
      .select({
        order: orders,
        product: products,
        seller: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar
        }
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .innerJoin(users, eq(orders.sellerId, users.id))
      .where(eq(orders.buyerId, buyerId))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      ok: true,
      orders: userOrders,
      count: userOrders.length
    });
  } catch (error) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch purchases" });
  }
});

// GET /api/orders/my-sales - Get seller's orders
router.get("/my-sales", requireAuth, async (req, res) => {
  try {
    const sellerId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    let query = db
      .select({
        order: orders,
        product: products,
        buyer: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar
        }
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .innerJoin(users, eq(orders.buyerId, users.id))
      .where(eq(orders.sellerId, sellerId))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    if (status) {
      query = db
        .select({
          order: orders,
          product: products,
          buyer: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatar: users.avatar
          }
        })
        .from(orders)
        .innerJoin(products, eq(orders.productId, products.id))
        .innerJoin(users, eq(orders.buyerId, users.id))
        .where(
          and(
            eq(orders.sellerId, sellerId),
            eq(orders.status, status)
          )
        )
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset) as any;
    }

    const sales = await query;

    // Calculate totals
    const totalRevenue = sales.reduce((sum, sale) =>
      sum + parseFloat(sale.order.sellerAmount), 0
    );
    const totalPlatformFees = sales.reduce((sum, sale) =>
      sum + parseFloat(sale.order.platformFee), 0
    );

    res.json({
      ok: true,
      sales,
      count: sales.length,
      summary: {
        totalRevenue: totalRevenue.toFixed(2),
        totalPlatformFees: totalPlatformFees.toFixed(2),
        totalOrders: sales.length
      }
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch sales" });
  }
});

// PATCH /api/orders/:id/status - Update order status (seller only)
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]),
      trackingNumber: z.string().optional()
    });

    const { status, trackingNumber } = schema.parse(req.body);
    const orderId = req.params.id;
    const userId = req.user!.id;

    // Get order
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }

    // Verify seller owns this order
    if (order.sellerId !== userId) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    // Update order
    const [updated] = await db
      .update(orders)
      .set({
        status,
        trackingNumber: trackingNumber || order.trackingNumber,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Send notification to buyer about status change
    const [product] = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, order.productId))
      .limit(1);

    if (product) {
      sendOrderStatusNotification(
        order.buyerId,
        status,
        orderId,
        product.name
      );
    }

    res.json({
      ok: true,
      message: "Order status updated",
      order: updated
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid status data", errors: error.issues });
    }
    console.error("Error updating order:", error);
    res.status(500).json({ ok: false, error: "Failed to update order" });
  }
});

// GET /api/orders/:id - Get single order details
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user!.id;

    const [orderDetails] = await db
      .select({
        order: orders,
        product: products,
        seller: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar
        }
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .innerJoin(users, eq(orders.sellerId, users.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!orderDetails) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }

    // Verify user is buyer or seller
    if (orderDetails.order.buyerId !== userId && orderDetails.order.sellerId !== userId) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    res.json({
      ok: true,
      order: orderDetails
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch order" });
  }
});

export default router;
