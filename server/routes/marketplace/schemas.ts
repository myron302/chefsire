import { z } from "zod";
import { MARKETPLACE_LISTING_CATEGORIES, MARKETPLACE_PRODUCT_CATEGORIES } from "./constants";

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  category: z.string().default("other"),
  images: z.array(z.string().url()).max(5).default([]),
  inventory: z.number().min(0).default(0),
  shippingEnabled: z.boolean().optional(),
  localPickupEnabled: z.boolean().optional(),
  pickupLocation: z.string().optional(),
  pickupInstructions: z.string().optional(),
  shippingCost: z.string().optional(),
  isExternal: z.boolean().default(false),
  externalUrl: z.string().url().optional().or(z.literal("")),
  productCategory: z.enum(MARKETPLACE_PRODUCT_CATEGORIES).default("physical"),
  digitalFileUrl: z.string().optional().nullable(),
  digitalFileName: z.string().optional().nullable(),
  deliveryMethods: z.array(z.string()).optional(),
  isDigital: z.boolean().optional(),
  inStoreOnly: z.boolean().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  inventory: z.number().min(0).optional(),
  category: z.string().optional(),
  images: z.array(z.string().url()).max(5).optional(),
  shippingEnabled: z.boolean().optional(),
  localPickupEnabled: z.boolean().optional(),
  pickupLocation: z.string().optional(),
  pickupInstructions: z.string().optional(),
  shippingCost: z.string().optional(),
  isActive: z.boolean().optional(),
  productCategory: z.enum(MARKETPLACE_PRODUCT_CATEGORIES).optional(),
  digitalFileUrl: z.string().optional().nullable(),
  digitalFileName: z.string().optional().nullable(),
  deliveryMethods: z.array(z.string()).optional(),
  isDigital: z.boolean().optional(),
  inStoreOnly: z.boolean().optional(),
});

export const searchProductsSchema = z.object({
  query: z.string().optional(),
  category: z.enum(MARKETPLACE_LISTING_CATEGORIES).optional(),
  location: z.string().optional(),
  offset: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(50).default(20),
});
