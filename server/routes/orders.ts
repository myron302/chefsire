// server/routes/orders.ts
import { Router } from "express";
import path from "node:path";
import { z } from "zod";
import { db } from "../db";
import { orders, products, users, stores } from "../../shared/schema";
import { eq, and, desc, getTableColumns, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../middleware";
import { effectiveMarketplaceTier } from "../lib/subscription-security";
import { calculateSellerPayout, DeliveryMethod, ProductCategory } from "../lib/commissions";
import { sendOrderPlacedNotification, sendOrderStatusNotification } from "../services/notification-service";
import { hasLegacyPaymentIndicators, isVerifiedMarketplaceEarning, toClientOrder, verifiedMarketplaceEarningWhere } from "../lib/marketplace-payment";
import { marketplaceDigitalFilePath } from "../lib/marketplace-digital-file";
import { isDigitalMarketplaceProduct, resolveMarketplaceShippingCost } from "../../shared/marketplace-fulfillment";
import { isSampleProduct, SAMPLE_LISTING_CODE, SAMPLE_LISTING_MESSAGE } from "../../shared/marketplace-sample";
import { canMarkShipped } from "../../shared/marketplace-order-status";

const router = Router();

// Every order column a buyer or seller may see. The stored Square capture
// request (single-use payment token, verification token, buyer email) is
// server-only and is never selected into a client response.
const { captureRequestSnapshot: _serverOnlyCaptureRequest, ...clientOrderColumns } = getTableColumns(orders);
const { digitalFileUrl: _privateDownload, ...clientProductColumns } = getTableColumns(products);

function checkoutInputsMatch(order: typeof orders.$inferSelect, input: {
  productId: string;
  quantity: number;
  fulfillmentMethod: string;
  shippingAddress?: unknown;
}) {
  return order.productId === input.productId
    && order.quantity === input.quantity
    && order.fulfillmentMethod === input.fulfillmentMethod
    && JSON.stringify(order.shippingAddress ?? null) === JSON.stringify(input.shippingAddress ?? null);
}

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
      quantity: z.number().int().min(1).max(100),
      checkoutIdempotencyKey: z.string().uuid(),
      shippingAddress: z.object({
        street: z.string().trim().min(1).max(200),
        city: z.string().trim().min(1).max(100),
        state: z.string().trim().min(1).max(100),
        zipCode: z.string().trim().min(1).max(24),
        country: z.string().default("USA")
      }).optional(),
      fulfillmentMethod: z.enum(["shipping", "local_pickup"]),
    }).strict();

    const body = schema.parse(req.body);
    const buyerId = req.user!.id;

    // A retry returns the original immutable order instead of creating another
    // reservation. Reusing the identity for different inputs fails closed.
    const [existingOrder] = await db.select().from(orders).where(and(
      eq(orders.buyerId, buyerId),
      eq(orders.checkoutIdempotencyKey, body.checkoutIdempotencyKey),
    )).limit(1);
    if (existingOrder) {
      if (!checkoutInputsMatch(existingOrder, body)) {
        return res.status(409).json({ ok: false, code: "CHECKOUT_IDEMPOTENCY_CONFLICT", error: "Checkout identity was already used for different inputs" });
      }
      return res.json({ ok: true, message: "Order already created", order: toClientOrder(existingOrder) });
    }

    // Load every price, seller, availability and commission input from the DB.
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, body.productId))
      .limit(1);

    if (!product) {
      return res.status(404).json({ ok: false, error: "Product not found" });
    }

    if (!product.isActive || product.inStoreOnly || product.isExternal) {
      return res.status(400).json({ ok: false, error: "Product is not available" });
    }

    // Seeded demo listings are shown as examples only and never become payable orders.
    if (isSampleProduct(product)) {
      return res.status(409).json({ ok: false, code: SAMPLE_LISTING_CODE, error: SAMPLE_LISTING_MESSAGE });
    }

    // This check improves checkout feedback. Inventory is not mutated here;
    // the payment-preparation transaction owns the authoritative reservation.
    if (product.inventory !== null && product.inventory < body.quantity) {
      return res.status(400).json({
        ok: false,
        error: `Only ${product.inventory} units available`
      });
    }

    const productCategory = (product as any).productCategory || "physical";
    const isDigital = isDigitalMarketplaceProduct({ isDigital: product.isDigital, productCategory });

    if (isDigital && !await marketplaceDigitalFilePath(product.sellerId, product.digitalFileUrl)) {
      return res.status(409).json({ ok: false, error: "The seller must upload a secure download before this product can be purchased" });
    }

    // Validate fulfillment method against server-owned product capabilities.
    if (!isDigital && body.fulfillmentMethod === "shipping" && !product.shippingEnabled) {
      return res.status(400).json({ ok: false, error: "Shipping not available for this product" });
    }
    if (!isDigital && body.fulfillmentMethod === "shipping" && !body.shippingAddress) {
      return res.status(400).json({ ok: false, error: "Shipping address is required" });
    }

    if (!isDigital && body.fulfillmentMethod === "local_pickup" && !product.localPickupEnabled) {
      return res.status(400).json({ ok: false, error: "Local pickup not available for this product" });
    }

    // Get seller's store to determine subscription tier
    const [sellerStore] = await db
      .select()
      .from(stores)
      .where(eq(stores.userId, product.sellerId))
      .limit(1);

    const sellerTier = effectiveMarketplaceTier({ subscriptionTier: (sellerStore as any)?.subscriptionTier });

    // Calculate amounts
    const productPrice = parseFloat(product.price);
    const deliveryMethod = isDigital
      ? DeliveryMethod.DIGITAL
      : body.fulfillmentMethod === "local_pickup"
        ? DeliveryMethod.PICKUP
        : DeliveryMethod.SHIPPED;
    const shippingCost = resolveMarketplaceShippingCost(
      { isDigital: product.isDigital, productCategory, shippingCost: product.shippingCost },
      body.fulfillmentMethod,
    );

    const subtotal = productPrice * body.quantity;
    const totalAmount = subtotal + shippingCost;

    // Calculate commission based on tier, delivery method, and product category
    const { commission, payout } = calculateSellerPayout(
      subtotal,
      sellerTier,
      deliveryMethod,
      productCategory as ProductCategory
    );

    const platformFee = commission;
    const sellerAmount = payout;
    const commissionRate = subtotal > 0 ? (commission / subtotal) * 100 : 0;

    // Creating an order is not a sale and does not mutate inventory. The
    // checkout identity makes this insert retry safe; payment preparation later
    // reserves inventory atomically with capture_pending.
    let newOrder: typeof orders.$inferSelect;
    try {
      [newOrder] = await db.insert(orders).values({
        buyerId,
        sellerId: product.sellerId,
        productId: product.id,
        quantity: body.quantity,
        totalAmount: totalAmount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        sellerAmount: sellerAmount.toFixed(2),
        checkoutIdempotencyKey: body.checkoutIdempotencyKey,
        sellerTierSnapshot: sellerTier,
        commissionRateSnapshot: commissionRate.toFixed(2),
        inventoryStatus: "unreserved",
        deliveryMethod,
        shippingAddress: body.shippingAddress || null,
        fulfillmentMethod: body.fulfillmentMethod,
        status: "pending"
        }).returning();
    } catch (error: any) {
      if (error?.code === "23505") {
        const [replayed] = await db.select().from(orders).where(and(
          eq(orders.buyerId, buyerId),
          eq(orders.checkoutIdempotencyKey, body.checkoutIdempotencyKey),
        )).limit(1);
        if (replayed && checkoutInputsMatch(replayed, body)) {
          return res.json({ ok: true, message: "Order already created", order: toClientOrder(replayed) });
        }
        if (replayed) {
          return res.status(409).json({ ok: false, code: "CHECKOUT_IDEMPOTENCY_CONFLICT", error: "Checkout identity was already used for different inputs" });
        }
      }
      throw error;
    }

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
        ...toClientOrder(newOrder),
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
          commissionRate: `${commissionRate.toFixed(1)}%`,
          deliveryMethod,
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
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit), 10) || 50));
    const offset = Math.max(0, Number.parseInt(String(req.query.offset), 10) || 0);

    const userOrders = await db
      .select({
        order: clientOrderColumns,
        product: clientProductColumns,
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
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(limit + 1)
      .offset(offset);

    res.json({
      ok: true,
      orders: userOrders.slice(0, limit).map((entry: (typeof userOrders)[number]) => ({ ...entry, verifiedPaid: isVerifiedMarketplaceEarning(entry.order) })),
      count: Math.min(userOrders.length, limit),
      hasMore: userOrders.length > limit
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
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit), 10) || 50));
    const offset = Math.max(0, Number.parseInt(String(req.query.offset), 10) || 0);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const paidOnly = req.query.paidOnly === "true";

    const rows = await db
      .select({
        order: clientOrderColumns,
        product: clientProductColumns,
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
      .where(and(
        eq(orders.sellerId, sellerId),
        status ? eq(orders.status, status) : undefined,
        paidOnly ? verifiedMarketplaceEarningWhere(orders) : undefined,
      ))
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(limit + 1)
      .offset(offset);
    const sales = rows.slice(0, limit);

    // Calculate totals
    // Quoted order economics are not verified earnings. Only independently
    // captured payments contribute to the seller-facing financial summary.
    const verifiedSales = sales.filter((sale: any) => isVerifiedMarketplaceEarning(sale.order));
    const totalRevenue = verifiedSales.reduce((sum: number, sale: any) =>
      sum + parseFloat(sale.order.sellerAmount), 0
    );
    const totalPlatformFees = verifiedSales.reduce((sum: number, sale: any) =>
      sum + parseFloat(sale.order.platformFee), 0
    );

    res.json({
      ok: true,
      sales: sales.map((entry: (typeof sales)[number]) => ({ ...entry, verifiedPaid: isVerifiedMarketplaceEarning(entry.order) })),
      count: sales.length,
      hasMore: rows.length > limit,
      summary: {
        totalRevenue: totalRevenue.toFixed(2),
        totalPlatformFees: totalPlatformFees.toFixed(2),
        totalOrders: sales.length,
        verifiedPaidOrders: verifiedSales.length,
        earningsVerification: "provider_capture_required"
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
      trackingNumber: z.string().max(100).optional()
    }).strict();

    const parsed = schema.parse(req.body);
    const status = parsed.status;
    const trackingNumber = parsed.trackingNumber?.trim() || undefined;
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

    const transitions: Record<string, readonly string[]> = {
      pending: ["processing", "cancelled"],
      processing: ["shipped", "delivered", "cancelled"],
      shipped: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
      refunded: [],
      // Historical rows used `paid` as a mixed payment/fulfillment value.
      paid: ["processing", "shipped", "delivered", "cancelled"],
    };
    if (status !== order.status && !(transitions[order.status ?? "pending"] ?? []).includes(status)) {
      return res.status(409).json({ ok: false, code: "INVALID_FULFILLMENT_TRANSITION", error: "Invalid fulfillment transition" });
    }
    // Pickup, in-store and digital orders are never shipped.
    if (status === "shipped" && status !== order.status && !canMarkShipped(order.deliveryMethod)) {
      return res.status(409).json({ ok: false, code: "INVALID_FULFILLMENT_TRANSITION", error: "Only shipped orders can be marked shipped" });
    }
    // Tracking numbers belong to shipping: they are accepted only on the way to (or while in) "shipped".
    if (trackingNumber && status !== "shipped") {
      return res.status(400).json({ ok: false, code: "TRACKING_NOT_APPLICABLE", error: "A tracking number can only be added to a shipped order" });
    }
    // Adding or changing the tracking number of an order that is already shipped.
    const trackingOnly = status === order.status && status === "shipped" && !!trackingNumber && trackingNumber !== order.trackingNumber;
    // A repeated request (double click, retry) for the status the order already has changes nothing and does not
    // notify the buyer again.
    if (status === order.status && !trackingOnly) {
      return res.json({ ok: true, message: "Order status unchanged", order: toClientOrder(order) });
    }
    if (["processing", "shipped", "delivered"].includes(status) && !isVerifiedMarketplaceEarning(order)) {
      return res.status(409).json({
        ok: false,
        code: "PAYMENT_CAPTURE_UNVERIFIED",
        error: "Order cannot enter fulfillment without verified captured payment",
      });
    }
    const cancellablePaymentStates = ["unverified", "refunded"];
    if (status === "cancelled" && order.paymentStatus === "unverified" && hasLegacyPaymentIndicators(order)) {
      return res.status(409).json({
        ok: false,
        code: "LEGACY_PAYMENT_RECONCILIATION_REQUIRED",
        error: "Historical payment activity must be reconciled before this order can be cancelled",
      });
    }
    if (status === "cancelled" && order.inventoryStatus === "legacy_unverified") {
      return res.status(409).json({
        ok: false,
        code: "LEGACY_INVENTORY_RECONCILIATION_REQUIRED",
        error: "Historical inventory state must be reconciled before this order can be cancelled",
      });
    }
    if (status === "cancelled" && !cancellablePaymentStates.includes(order.paymentStatus)) {
      return res.status(409).json({
        ok: false,
        code: "PAYMENT_RECONCILIATION_REQUIRED",
        error: "An in-progress or captured payment must be reconciled before cancellation",
      });
    }

    // Compare-and-set prevents delivery racing cancellation (or another update).
    // No payment evidence is accepted by the strict request schema or changed here.
    const updated = await db.transaction(async (tx: any) => {
      const [next] = await tx.update(orders).set({
          status,
          trackingNumber: trackingNumber || order.trackingNumber,
          ...(status === "cancelled" && order.inventoryStatus === "reserved" ? { inventoryStatus: "released" } : {}),
          updatedAt: new Date()
        }).where(and(
          eq(orders.id, orderId),
          eq(orders.status, order.status!),
          eq(orders.paymentStatus, order.paymentStatus),
          eq(orders.sellerRevenueStatus, order.sellerRevenueStatus),
          // Two concurrent tracking edits can't both win: the loser gets FULFILLMENT_STATE_CONFLICT.
          sql`${orders.trackingNumber} IS NOT DISTINCT FROM ${order.trackingNumber}`,
          ...(status === "cancelled" ? [inArray(orders.paymentStatus, cancellablePaymentStates)] : []),
          ...(status === "cancelled" ? [eq(orders.inventoryStatus, order.inventoryStatus)] : []),
        )).returning();
      if (!next) return undefined;
      if (status === "cancelled" && order.inventoryStatus === "reserved") {
        await tx.update(products).set({
          inventory: sql`${products.inventory} + ${order.quantity}`,
        }).where(and(eq(products.id, order.productId), sql`${products.inventory} IS NOT NULL`));
      }
      return next;
    });

    if (!updated) {
      return res.status(409).json({ ok: false, code: "FULFILLMENT_STATE_CONFLICT", error: "Order status changed; reload and retry" });
    }

    // Send notification to buyer about status change
    const [product] = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, order.productId))
      .limit(1);

    if (product) {
      sendOrderStatusNotification(
        order.buyerId,
        trackingOnly ? "tracking_updated" : status,
        orderId,
        product.name,
        order.deliveryMethod
      );
    }

    res.json({
      ok: true,
      message: "Order status updated",
      order: toClientOrder(updated)
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid status data", errors: error.issues });
    }
    console.error("Error updating order:", error);
    res.status(500).json({ ok: false, error: "Failed to update order" });
  }
});

// Download authority is scoped to the buyer and the current verified payment.
router.get("/:id/download", requireAuth, async (req, res, next) => {
  try {
    const [entry] = await db.select({
      order: clientOrderColumns,
      file: products.digitalFileUrl,
      filename: products.digitalFileName,
    }).from(orders).innerJoin(products, eq(orders.productId, products.id)).where(and(
      eq(orders.id, req.params.id),
      eq(orders.buyerId, req.user!.id),
      eq(products.sellerId, orders.sellerId),
    )).limit(1);
    if (!entry || entry.order.deliveryMethod !== DeliveryMethod.DIGITAL || !isVerifiedMarketplaceEarning(entry.order)) {
      return res.status(404).json({ ok: false, error: "Download not available" });
    }
    const filename = await marketplaceDigitalFilePath(entry.order.sellerId, entry.file);
    if (!filename) return res.status(404).json({ ok: false, error: "Contact the seller to make the download available" });
    res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Type": "application/octet-stream" });
    res.download(path.basename(filename), entry.filename || "download", { root: path.dirname(filename) });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id - Get single order details
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user!.id;

    const [orderDetails] = await db
      .select({
        order: clientOrderColumns,
        product: clientProductColumns,
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
      order: orderDetails,
      verifiedPaid: isVerifiedMarketplaceEarning(orderDetails.order),
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch order" });
  }
});

export default router;
