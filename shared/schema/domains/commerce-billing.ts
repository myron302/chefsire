import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  decimal,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users-auth";

export const products = pgTable(
  "products",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sellerId: varchar("seller_id").references(() => users.id).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    category: text("category").notNull(),
    productCategory: text("product_category").default("physical"),
    images: jsonb("images").$type<string[]>().default(sql`'[]'::jsonb`),
    inventory: integer("inventory").default(0),
    shippingEnabled: boolean("shipping_enabled").default(true),
    localPickupEnabled: boolean("local_pickup_enabled").default(false),
    inStoreOnly: boolean("in_store_only").default(false),
    isDigital: boolean("is_digital").default(false),
    digitalFileUrl: text("digital_file_url"),
    digitalFileName: text("digital_file_name"),
    pickupLocation: text("pickup_location"),
    pickupInstructions: text("pickup_instructions"),
    shippingCost: decimal("shipping_cost", { precision: 8, scale: 2 }),
    isExternal: boolean("is_external").default(false),
    externalUrl: text("external_url"),
    salesCount: integer("sales_count").default(0),
    viewsCount: integer("views_count").default(0),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    categoryIdx: index("products_category_idx").on(table.category),
    productCategoryIdx: index("products_product_category_idx").on(table.productCategory),
    sellerIdx: index("products_seller_idx").on(table.sellerId),
    pickupLocationIdx: index("products_pickup_location_idx").on(table.pickupLocation),
  })
);

export const orders = pgTable(
  "orders",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    buyerId: varchar("buyer_id").references(() => users.id).notNull(),
    sellerId: varchar("seller_id").references(() => users.id).notNull(),
    productId: varchar("product_id").references(() => products.id).notNull(),
    quantity: integer("quantity").notNull(),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    platformFee: decimal("platform_fee", { precision: 8, scale: 2 }).notNull(),
    sellerAmount: decimal("seller_amount", { precision: 10, scale: 2 }).notNull(),
    deliveryMethod: text("delivery_method").notNull().default("shipped"),
    shippingAddress: jsonb("shipping_address").$type<{
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    }>(),
    fulfillmentMethod: text("fulfillment_method").notNull(),
    status: text("status").default("pending"),
    trackingNumber: text("tracking_number"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    buyerIdx: index("orders_buyer_idx").on(table.buyerId),
    sellerIdx: index("orders_seller_idx").on(table.sellerId),
    statusIdx: index("orders_status_idx").on(table.status),
  })
);

export const subscriptionHistory = pgTable("subscription_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tier: text("tier").notNull(),
  amount: decimal("amount", { precision: 8, scale: 2 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull(),
  paymentMethod: text("payment_method"),
  subscriptionType: text("subscription_type").default("marketplace"),
  createdAt: timestamp("created_at").defaultNow(),
});
