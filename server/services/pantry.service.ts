// server/services/pantry.service.ts
import { eq, and, sql, asc } from "drizzle-orm";
import { pantryItems } from "@shared/schema";

/**
 * PantryService - Handles all pantry-related database operations
 */
export class PantryService {
  /**
   * Add an item to user's pantry
   */
  static async addPantryItem(
    db: any,
    userId: string,
    item: {
      name: string;
      category?: string;
      quantity?: number;
      unit?: string;
      expirationDate?: Date;
      notes?: string;
    }
  ): Promise<any> {
    const result = await db.insert(pantryItems).values({ userId, ...item }).returning();
    return result[0];
  }

  /**
   * Get all pantry items for a user
   */
  static async getPantryItems(db: any, userId: string): Promise<any[]> {
    return db
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, userId))
      .orderBy(asc(pantryItems.name));
  }

  /**
   * Update a pantry item
   */
  static async updatePantryItem(
    db: any,
    itemId: string,
    updates: { quantity?: number; expirationDate?: Date; notes?: string }
  ): Promise<any> {
    const result = await db
      .update(pantryItems)
      .set(updates)
      .where(eq(pantryItems.id, itemId))
      .returning();
    return result[0];
  }

  /**
   * Delete a pantry item
   */
  static async deletePantryItem(db: any, itemId: string): Promise<boolean> {
    const result = await db.delete(pantryItems).where(eq(pantryItems.id, itemId)).returning();
    return result.length > 0;
  }

  /**
   * Get pantry items expiring soon
   */
  static async getExpiringItems(db: any, userId: string, daysAhead: number): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return db
      .select()
      .from(pantryItems)
      .where(
        and(
          eq(pantryItems.userId, userId),
          sql`${pantryItems.expirationDate} <= ${futureDate}`
        )
      )
      .orderBy(asc(pantryItems.expirationDate));
  }

  /**
   * Get pantry items by category
   */
  static async getPantryItemsByCategory(
    db: any,
    userId: string,
    category: string
  ): Promise<any[]> {
    return db
      .select()
      .from(pantryItems)
      .where(and(eq(pantryItems.userId, userId), eq(pantryItems.category, category)))
      .orderBy(asc(pantryItems.name));
  }

  /**
   * Search pantry items by name
   */
  static async searchPantryItems(db: any, userId: string, searchTerm: string): Promise<any[]> {
    const term = `%${searchTerm}%`;
    return db
      .select()
      .from(pantryItems)
      .where(
        and(
          eq(pantryItems.userId, userId),
          sql`LOWER(${pantryItems.name}) LIKE LOWER(${term})`
        )
      )
      .orderBy(asc(pantryItems.name));
  }

  /**
   * Bulk add pantry items
   */
  static async bulkAddPantryItems(
    db: any,
    userId: string,
    items: Array<{
      name: string;
      category?: string;
      quantity?: number;
      unit?: string;
      expirationDate?: Date;
      notes?: string;
    }>
  ): Promise<any[]> {
    const itemsWithUserId = items.map((item) => ({ userId, ...item }));
    const result = await db.insert(pantryItems).values(itemsWithUserId).returning();
    return result;
  }

  /**
   * Clear all pantry items for a user
   */
  static async clearPantry(db: any, userId: string): Promise<boolean> {
    const result = await db.delete(pantryItems).where(eq(pantryItems.userId, userId));
    return true;
  }

  /**
   * Get pantry statistics
   */
  static async getPantryStats(db: any, userId: string): Promise<{
    totalItems: number;
    itemsByCategory: Record<string, number>;
    expiringCount: number;
  }> {
    const items = await this.getPantryItems(db, userId);
    const expiringItems = await this.getExpiringItems(db, userId, 7); // Expiring in next 7 days

    const itemsByCategory: Record<string, number> = {};
    items.forEach((item) => {
      const category = item.category || "uncategorized";
      itemsByCategory[category] = (itemsByCategory[category] || 0) + 1;
    });

    return {
      totalItems: items.length,
      itemsByCategory,
      expiringCount: expiringItems.length,
    };
  }
}
