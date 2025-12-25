// server/services/user.service.ts
import { eq, and, sql, desc, ilike } from "drizzle-orm";
import { users, emailVerificationTokens, type User, type InsertUser } from "@shared/schema";

/**
 * UserService - Handles all user-related database operations
 */
export class UserService {
  /**
   * Get user by ID
   */
  static async getUser(db: any, id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  /**
   * Get user by username
   */
  static async getUserByUsername(db: any, username: string): Promise<User | undefined> {
    /*
     * Use a case‑insensitive match for usernames.
     *
     * Previously this method used the `eq` operator, which performs a
     * case‑sensitive equality check. This meant that a lookup for
     * "Chefsire" would fail even if a user existed with username
     * "chefsire". Switching to `ilike` ensures that the username is
     * compared case‑insensitively. We do not include wildcard characters
     * here so that only exact matches (ignoring case) are returned.
     */
    const result = await db
      .select()
      .from(users)
      .where(ilike(users.username, username))
      .limit(1);
    return result[0];
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(db: any, email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  /**
   * Create a new user
   */
  static async createUser(db: any, insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  /**
   * Update user information
   */
  static async updateUser(db: any, id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  /**
   * Get suggested users for a given user
   */
  static async getSuggestedUsers(db: any, userId: string, limit = 5): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(and(sql`${users.id} != ${userId}`, eq(users.isChef, true)))
      .orderBy(desc(users.followersCount))
      .limit(limit);
  }

  /**
   * Verify user email
   */
  static async verifyUserEmail(db: any, userId: string): Promise<void> {
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, userId));
  }

  /**
   * Enable catering for a chef
   */
  static async enableCatering(
    db: any,
    userId: string,
    location: string,
    radius: number,
    bio?: string
  ): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({
        isCateringEnabled: true,
        cateringLocation: location,
        cateringRadius: radius,
        cateringBio: bio || null,
        cateringAvailable: true,
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  /**
   * Disable catering for a chef
   */
  static async disableCatering(db: any, userId: string): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({
        isCateringEnabled: false,
        cateringAvailable: false,
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  /**
   * Update catering settings
   */
  static async updateCateringSettings(
    db: any,
    userId: string,
    settings: {
      location?: string;
      radius?: number;
      bio?: string;
      available?: boolean;
    }
  ): Promise<User | undefined> {
    const updates: any = {};
    if (settings.location !== undefined) updates.cateringLocation = settings.location;
    if (settings.radius !== undefined) updates.cateringRadius = settings.radius;
    if (settings.bio !== undefined) updates.cateringBio = settings.bio;
    if (settings.available !== undefined) updates.cateringAvailable = settings.available;

    const result = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  /**
   * Enable nutrition premium for a user
   */
  static async enableNutritionPremium(
    db: any,
    userId: string,
    trialDays: number
  ): Promise<User | undefined> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + trialDays);

    const result = await db
      .update(users)
      .set({
        nutritionPremium: true,
        nutritionPremiumExpires: expiresAt,
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  /**
   * Update nutrition goals for a user
   */
  static async updateNutritionGoals(
    db: any,
    userId: string,
    goals: {
      dailyCalorieGoal?: number;
      macroGoals?: { protein: number; carbs: number; fat: number };
      dietaryRestrictions?: string[];
    }
  ): Promise<User | undefined> {
    const updates: any = {};
    if (goals.dailyCalorieGoal !== undefined) updates.dailyCalorieGoal = goals.dailyCalorieGoal;
    if (goals.macroGoals !== undefined) updates.macroGoals = goals.macroGoals;
    if (goals.dietaryRestrictions !== undefined) updates.dietaryRestrictions = goals.dietaryRestrictions;

    const result = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  /**
   * Find verification token (for email verification)
   */
  static async findVerificationToken(db: any, hashedToken: string): Promise<any | undefined> {
    const result = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, hashedToken))
      .limit(1);
    return result[0];
  }

  /**
   * Delete verification token by hash
   */
  static async deleteVerificationToken(db: any, hashedToken: string): Promise<void> {
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, hashedToken));
  }

  /**
   * Delete all verification tokens for a user
   */
  static async deleteVerificationTokensByUserId(db: any, userId: string): Promise<void> {
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));
  }
}
