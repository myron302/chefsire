// server/services/marketplace.service.ts
import { eq, desc, and, or, ilike } from "drizzle-orm";
import {
  products,
  users,
  type Product,
  type InsertProduct,
  type ProductWithSeller,
} from "@shared/schema";

/**
 * MarketplaceService - Handles all marketplace/product database operations
 */
export class MarketplaceService {
  /**
   * Create a new product
   */
  static async createProduct(db: any, product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }

  /**
   * Get product by ID
   */
  static async getProduct(db: any, id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return result[0];
  }

  /**
   * Get product with seller information
   */
  static async getProductWithSeller(db: any, id: string): Promise<ProductWithSeller | undefined> {
    const result = await db
      .select({ product: products, seller: users })
      .from(products)
      .innerJoin(users, eq(products.sellerId, users.id))
      .where(eq(products.id, id))
      .limit(1);

    if (!result[0]) return undefined;
    return { ...result[0].product, seller: result[0].seller };
  }

  /**
   * Get all products for a specific seller
   */
  static async getUserProducts(
    db: any,
    sellerId: string,
    offset = 0,
    limit = 10
  ): Promise<ProductWithSeller[]> {
    const result = await db
      .select({ product: products, seller: users })
      .from(products)
      .innerJoin(users, eq(products.sellerId, users.id))
      .where(and(eq(products.sellerId, sellerId), eq(products.isActive, true)))
      .orderBy(desc(products.createdAt))
      .offset(offset)
      .limit(limit);

    return result.map((row) => ({ ...row.product, seller: row.seller }));
  }

  /**
   * Search products with filters
   */
  static async searchProducts(
    db: any,
    query?: string,
    category?: string,
    location?: string,
    offset = 0,
    limit = 10
  ): Promise<ProductWithSeller[]> {
    const conditions = [eq(products.isActive, true)];

    if (query) {
      const searchTerm = `%${query}%`;
      conditions.push(
        or(
          ilike(products.name, searchTerm),
          ilike(products.description, searchTerm)
        )!
      );
    }

    if (category) {
      conditions.push(eq(products.category, category));
    }

    if (location) {
      conditions.push(ilike(products.location, `%${location}%`));
    }

    const result = await db
      .select({ product: products, seller: users })
      .from(products)
      .innerJoin(users, eq(products.sellerId, users.id))
      // @ts-expect-error drizzle typing
      .where(and(...conditions))
      .orderBy(desc(products.createdAt))
      .offset(offset)
      .limit(limit);

    return result.map((row) => ({ ...row.product, seller: row.seller }));
  }

  /**
   * Update a product
   */
  static async updateProduct(
    db: any,
    id: string,
    updates: Partial<Product>
  ): Promise<Product | undefined> {
    const result = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return result[0];
  }

  /**
   * Delete (soft delete) a product
   */
  static async deleteProduct(db: any, id: string): Promise<boolean> {
    const result = await db
      .update(products)
      .set({ isActive: false })
      .where(eq(products.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Get products by category
   */
  static async getProductsByCategory(
    db: any,
    category: string,
    offset = 0,
    limit = 10
  ): Promise<ProductWithSeller[]> {
    return this.searchProducts(db, undefined, category, undefined, offset, limit);
  }

  /**
   * Get featured/trending products
   */
  static async getFeaturedProducts(db: any, limit = 10): Promise<ProductWithSeller[]> {
    const result = await db
      .select({ product: products, seller: users })
      .from(products)
      .innerJoin(users, eq(products.sellerId, users.id))
      .where(eq(products.isActive, true))
      .orderBy(desc(products.createdAt))
      .limit(limit);

    return result.map((row) => ({ ...row.product, seller: row.user }));
  }
}
