// server/storage.ts — COMPLETE FILE WITH DRINKS
import "./lib/load-env";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { eq, desc, and, or, sql, asc, ilike } from "drizzle-orm";

import {
  users,
  posts,
  recipes,
  stories,
  likes,
  comments,
  commentLikes,
  follows,
  cateringInquiries,
  products,
  mealPlans,
  mealPlanEntries,
  pantryItems,
  nutritionLogs,
  customDrinks,
  drinkPhotos,
  drinkLikes,
  drinkSaves,
  recipeSaves,
  userDrinkStats,
  emailVerificationTokens,
  type User,
  type InsertUser,
  type Post,
  type InsertPost,
  type Recipe,
  type InsertRecipe,
  type Story,
  type InsertStory,
  type Like,
  type InsertLike,
  type Comment,
  type InsertComment,
  type Follow,
  type InsertFollow,
  type PostWithUser,
  type StoryWithUser,
  type CommentWithUser,
  type CateringInquiry,
  type InsertCateringInquiry,
  type ChefWithCatering,
  type Product,
  type InsertProduct,
  type ProductWithSeller,
  type CustomDrink,
  type InsertCustomDrink,
  type DrinkPhoto,
  type InsertDrinkPhoto,
  type DrinkLike,
  type InsertDrinkLike,
  type DrinkSave,
  type InsertDrinkSave,
  type RecipeSave,
  type InsertRecipeSave,
  type UserDrinkStats,
  type InsertUserDrinkStats,
  type CustomDrinkWithUser,
  type CommentLike,
  type InsertCommentLike,
} from "@shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;
let _db: ReturnType<typeof drizzle> | null = null;

if (DATABASE_URL) {
  const pool = new Pool({ connectionString: DATABASE_URL });
  _db = drizzle(pool);
} else {
  console.warn(
    "[storage] DATABASE_URL not set – API can run, but DB-backed endpoints will return 503"
  );
}

function getDb() {
  if (!_db) {
    const err: any = new Error("Database not configured (set DATABASE_URL).");
    err.status = 503;
    throw err;
  }
  return _db;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getSuggestedUsers(userId: string, limit?: number): Promise<User[]>;

  // Email Verification
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  findVerificationToken(hashedToken: string): Promise<any | undefined>;
  verifyUserEmail(userId: string): Promise<void>;
  deleteVerificationToken(hashedToken: string): Promise<void>;
  deleteVerificationTokensByUserId(userId: string): Promise<void>;

  // Posts
  getPost(id: string): Promise<Post | undefined>;
  getPostWithUser(id: string): Promise<PostWithUser | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, updates: Partial<Post>): Promise<Post | undefined>;
  deletePost(id: string): Promise<boolean>;
  getFeedPosts(userId: string, offset?: number, limit?: number): Promise<PostWithUser[]>;
  getUserPosts(userId: string, offset?: number, limit?: number): Promise<PostWithUser[]>;
  getExplorePosts(offset?: number, limit?: number): Promise<PostWithUser[]>;

  // Recipes
  getRecipe(id: string): Promise<Recipe | undefined>;
  getRecipeByPostId(postId: string): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe | undefined>;
  getTrendingRecipes(limit?: number): Promise<(Recipe & { post: PostWithUser })[]>;
  searchLocalRecipes(searchParams: {
    q?: string;
    cuisines?: string[];
    diets?: string[];
    mealTypes?: string[];
    pageSize?: number;
    offset?: number;
  }): Promise<any[]>;

  // Stories/Bites, Likes, Comments, Follows
  getStory(id: string): Promise<Story | undefined>;
  createStory(story: InsertStory): Promise<Story>;
  getActiveStories(userId: string): Promise<StoryWithUser[]>;
  getUserStories(userId: string): Promise<Story[]>;
  likePost(userId: string, postId: string): Promise<Like>;
  unlikePost(userId: string, postId: string): Promise<boolean>;
  isPostLiked(userId: string, postId: string): Promise<boolean>;
  getPostLikes(postId: string): Promise<Like[]>;
  getComment(id: string): Promise<Comment | undefined>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: string): Promise<boolean>;
  getPostComments(postId: string): Promise<CommentWithUser[]>;
  /** Like a comment */
  likeComment(userId: string, commentId: string): Promise<CommentLike>;
  /** Unlike a previously liked comment */
  unlikeComment(userId: string, commentId: string): Promise<boolean>;
  /** Check if a given user has liked a particular comment */
  isCommentLiked(userId: string, commentId: string): Promise<boolean>;
  /** Retrieve all likes for a specific comment */
  getCommentLikes(commentId: string): Promise<CommentLike[]>;
  followUser(followerId: string, followingId: string): Promise<Follow>;
  unfollowUser(followerId: string, followingId: string): Promise<boolean>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  getFollowers(userId: string): Promise<User[]>;
  getFollowing(userId: string): Promise<User[]>;

  // Catering
  enableCatering(
    userId: string,
    location: string,
    radius: number,
    bio?: string
  ): Promise<User | undefined>;
  disableCatering(userId: string): Promise<User | undefined>;
  updateCateringSettings(userId: string, settings: {
    location?: string;
    radius?: number;
    bio?: string;
    available?: boolean;
  }): Promise<User | undefined>;
  findChefsInRadius(postalCode: string, radiusMiles: number, limit?: number): Promise<ChefWithCatering[]>;
  createCateringInquiry(inquiry: InsertCateringInquiry): Promise<CateringInquiry>;
  getCateringInquiries(chefId: string): Promise<CateringInquiry[]>;
  updateCateringInquiry(id: string, updates: { status?: string; message?: string }): Promise<CateringInquiry | undefined>;

  // Marketplace
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductWithSeller(id: string): Promise<ProductWithSeller | undefined>;
  getUserProducts(sellerId: string, offset?: number, limit?: number): Promise<ProductWithSeller[]>;
  searchProducts(query?: string, category?: string, location?: string, offset?: number, limit?: number): Promise<ProductWithSeller[]>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Nutrition
  enableNutritionPremium(userId: string, trialDays: number): Promise<User | undefined>;
  updateNutritionGoals(userId: string, goals: {
    dailyCalorieGoal?: number;
    macroGoals?: { protein: number; carbs: number; fat: number };
    dietaryRestrictions?: string[];
  }): Promise<User | undefined>;
  logNutrition(userId: string, log: {
    date: Date;
    mealType: string;
    recipeId?: string;
    customFoodName?: string;
    servings: number;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    imageUrl?: string;
  }): Promise<any>;
  getDailyNutritionSummary(userId: string, date: Date): Promise<any>;
  getNutritionLogs(userId: string, startDate: Date, endDate: Date): Promise<any[]>;

  // Meal Plans
  createMealPlan(userId: string, plan: {
    name: string;
    startDate: Date;
    endDate: Date;
    isTemplate: boolean;
  }): Promise<any>;
  getMealPlan(id: string): Promise<any>;
  getUserMealPlans(userId: string): Promise<any[]>;
  addMealPlanEntry(planId: string, entry: {
    recipeId?: string;
    date: Date;
    mealType: string;
    servings: number;
    customName?: string;
    customCalories?: number;
  }): Promise<any>;

  // Pantry
  addPantryItem(userId: string, item: {
    name: string;
    category?: string;
    quantity?: number;
    unit?: string;
    expirationDate?: Date;
    notes?: string;
  }): Promise<any>;
  getPantryItems(userId: string): Promise<any[]>;
  updatePantryItem(itemId: string, updates: {
    quantity?: number;
    expirationDate?: Date;
    notes?: string;
  }): Promise<any>;
  deletePantryItem(itemId: string): Promise<boolean>;
  getExpiringItems(userId: string, daysAhead: number): Promise<any[]>;

  // Pantry-based suggestions
  getRecipesFromPantryItems(userId: string, options: {
    requireAllIngredients?: boolean;
    maxMissingIngredients?: number;
    includeExpiringSoon?: boolean;
    limit?: number;
  }): Promise<any[]>;
  getSuggestedIngredientsForRecipe(recipeId: string, userId: string): Promise<{
    recipe: any;
    missingIngredients: string[];
    availableInMarketplace: any[];
  }>;

  // Custom Drinks
  getCustomDrink(id: string): Promise<CustomDrink | undefined>;
  getCustomDrinkWithUser(id: string): Promise<CustomDrinkWithUser | undefined>;
  getUserCustomDrinks(userId: string, category?: string): Promise<CustomDrink[]>;
  getPublicCustomDrinks(category?: string, limit?: number): Promise<CustomDrinkWithUser[]>;
  createCustomDrink(drink: InsertCustomDrink): Promise<CustomDrink>;
  updateCustomDrink(id: string, updates: Partial<CustomDrink>): Promise<CustomDrink | undefined>;
  deleteCustomDrink(id: string): Promise<boolean>;
  
  // Drink Photos
  createDrinkPhoto(photo: InsertDrinkPhoto): Promise<DrinkPhoto>;
  getDrinkPhotos(drinkId: string): Promise<DrinkPhoto[]>;
  deleteDrinkPhoto(id: string): Promise<boolean>;
  
  // Drink Likes
  likeDrink(userId: string, drinkId: string): Promise<DrinkLike>;
  unlikeDrink(userId: string, drinkId: string): Promise<boolean>;
  isDrinkLiked(userId: string, drinkId: string): Promise<boolean>;
  
  // Drink Saves
  saveDrink(userId: string, drinkId: string): Promise<DrinkSave>;
  unsaveDrink(userId: string, drinkId: string): Promise<boolean>;
  isDrinkSaved(userId: string, drinkId: string): Promise<boolean>;
  getUserSavedDrinks(userId: string, category?: string): Promise<CustomDrinkWithUser[]>;
  
  // Recipe Saves
  saveRecipe(userId: string, recipeId: string): Promise<RecipeSave>;
  unsaveRecipe(userId: string, recipeId: string): Promise<boolean>;
  isRecipeSaved(userId: string, recipeId: string): Promise<boolean>;
  getUserSavedRecipes(userId: string): Promise<Recipe[]>;
  
  // User Drink Stats
  getUserDrinkStats(userId: string): Promise<UserDrinkStats | undefined>;
  createUserDrinkStats(userId: string): Promise<UserDrinkStats>;
  updateUserDrinkStats(userId: string, updates: Partial<UserDrinkStats>): Promise<UserDrinkStats | undefined>;
  incrementDrinkCount(userId: string, category: string): Promise<void>;
  updateStreak(userId: string): Promise<void>;
  addBadge(userId: string, badge: string): Promise<void>;
}

export class DrizzleStorage implements IStorage {
  // ---------- Users ----------
  async getUser(id: string): Promise<User | undefined> {
    const db = getDb();
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const db = getDb();
    /*
     * Use a case‑insensitive match for usernames.
     *
     * Previously this function used the `eq` operator, which performs a
     * case‑sensitive equality check. This caused direct message user lookups
     * to fail when the entered username differed in case from the stored
     * value (e.g. "Chefsire" vs "chefsire"). Switching to `ilike`
     * performs a PostgreSQL `ILIKE` comparison, ensuring usernames are
     * matched regardless of case. The pattern passed to `ilike` is the
     * exact username, so this still requires an exact match but without
     * case sensitivity.
     */
    const result = await db
      .select()
      .from(users)
      .where(ilike(users.username, username))
      .limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = getDb();
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const db = getDb();
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const db = getDb();
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getSuggestedUsers(userId: string, limit = 5): Promise<User[]> {
    const db = getDb();
    return db
      .select()
      .from(users)
      .where(and(sql`${users.id} != ${userId}`, eq(users.isChef, true)))
      .orderBy(desc(users.followersCount))
      .limit(limit);
  }

  // ---------- Email Verification ----------
  async findByEmail(email: string): Promise<User | undefined> {
    return this.getUserByEmail(email);
  }

  async findById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async findVerificationToken(hashedToken: string): Promise<any | undefined> {
    const db = getDb();
    const result = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, hashedToken))
      .limit(1);
    return result[0];
  }

  async verifyUserEmail(userId: string): Promise<void> {
    const db = getDb();
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async deleteVerificationToken(hashedToken: string): Promise<void> {
    const db = getDb();
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, hashedToken));
  }

  async deleteVerificationTokensByUserId(userId: string): Promise<void> {
    const db = getDb();
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));
  }

  // ---------- Posts ----------
  async getPost(id: string): Promise<Post | undefined> {
    const db = getDb();
    const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return result[0];
  }

  async getPostWithUser(id: string): Promise<PostWithUser | undefined> {
    const db = getDb();
    const result = await db
      .select({ post: posts, user: users, recipe: recipes })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .leftJoin(recipes, eq(recipes.postId, posts.id))
      .where(eq(posts.id, id))
      .limit(1);

    if (!result[0]) return undefined;
    return { ...result[0].post, user: result[0].user, recipe: result[0].recipe || undefined };
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const db = getDb();
    const result = await db.insert(posts).values(insertPost).returning();

    await db
      .update(users)
      .set({ postsCount: sql`${users.postsCount} + 1` })
      .where(eq(users.id, insertPost.userId));

    return result[0];
  }

  async updatePost(id: string, updates: Partial<Post>): Promise<Post | undefined> {
    const db = getDb();
    const result = await db.update(posts).set(updates).where(eq(posts.id, id)).returning();
    return result[0];
  }

  async deletePost(id: string): Promise<boolean> {
    const db = getDb();

    try {
      console.log("deletePost: Starting delete for post ID:", id);

      // First, get the post to know the userId
      const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
      if (!post) {
        console.log("deletePost: Post not found");
        return false;
      }

      console.log("deletePost: Found post, deleting related records...");

      // Delete all related records first (to avoid foreign key constraint violations)
      // Delete comments
      const deletedComments = await db.delete(comments).where(eq(comments.postId, id));
      console.log("deletePost: Deleted comments");

      // Delete likes
      const deletedLikes = await db.delete(likes).where(eq(likes.postId, id));
      console.log("deletePost: Deleted likes");

      // Delete any recipe saves associated with this post's recipe.  Posts
      // themselves do not have a standalone saves table, but recipes can be
      // saved by users in the recipeSaves table.  We first find the recipe
      // attached to this post (if any) and remove all corresponding saves.  This
      // avoids dangling references when the recipe is deleted below.
      const [postRecipe] = await db.select().from(recipes).where(eq(recipes.postId, id)).limit(1);
      if (postRecipe) {
        await db.delete(recipeSaves).where(eq(recipeSaves.recipeId, postRecipe.id));
        console.log("deletePost: Deleted recipe saves");
      }

      // Delete recipe if this is a recipe post
      const deletedRecipes = await db.delete(recipes).where(eq(recipes.postId, id));
      console.log("deletePost: Deleted recipe (if any)");

      // Now delete the post itself
      console.log("deletePost: Deleting post...");
      const result = await db.delete(posts).where(eq(posts.id, id)).returning();

      if (result[0]) {
        console.log("deletePost: Post deleted, updating user post count...");
        // Decrement user's post count
        await db
          .update(users)
          .set({ postsCount: sql`${users.postsCount} - 1` })
          .where(eq(users.id, result[0].userId));

        console.log("deletePost: ✅ Delete successful");
        return true;
      }

      console.log("deletePost: ❌ Delete failed - no result");
      return false;
    } catch (err: any) {
      console.error("deletePost: ❌ Error:", err);
      console.error("deletePost: Error message:", err.message);
      console.error("deletePost: Error stack:", err.stack);
      throw err; // Re-throw so the API can return proper error
    }
  }

  async getFeedPosts(_userId: string, offset = 0, limit = 10): Promise<PostWithUser[]> {
    const db = getDb();
    const result = await db
      .select({
        post: posts,
        user: users,
        recipe: recipes,
        isLiked: sql<boolean>`CASE WHEN ${likes.userId} IS NOT NULL THEN true ELSE false END`.as('isLiked')
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .leftJoin(recipes, eq(recipes.postId, posts.id))
      .leftJoin(likes, and(
        eq(likes.postId, posts.id),
        eq(likes.userId, _userId)
      ))
      .orderBy(desc(posts.createdAt))
      .offset(offset)
      .limit(limit);

    return result.map((row) => ({
      ...row.post,
      user: row.user,
      recipe: row.recipe || undefined,
      isLiked: row.isLiked
    }));
  }

  async getUserPosts(userId: string, offset = 0, limit = 10, currentUserId?: string): Promise<PostWithUser[]> {
    const db = getDb();
    const result = await db
      .select({
        post: posts,
        user: users,
        recipe: recipes,
        isLiked: currentUserId
          ? sql<boolean>`CASE WHEN ${likes.userId} IS NOT NULL THEN true ELSE false END`.as('isLiked')
          : sql<boolean>`false`.as('isLiked')
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .leftJoin(recipes, eq(recipes.postId, posts.id))
      .leftJoin(likes, currentUserId ? and(
        eq(likes.postId, posts.id),
        eq(likes.userId, currentUserId)
      ) : undefined)
      .where(eq(posts.userId, userId))
      .orderBy(desc(posts.createdAt))
      .offset(offset)
      .limit(limit);

    return result.map((row) => ({
      ...row.post,
      user: row.user,
      recipe: row.recipe || undefined,
      isLiked: row.isLiked
    }));
  }

  async getExplorePosts(offset = 0, limit = 10, currentUserId?: string): Promise<PostWithUser[]> {
    const db = getDb();
    const result = await db
      .select({
        post: posts,
        user: users,
        recipe: recipes,
        isLiked: currentUserId
          ? sql<boolean>`CASE WHEN ${likes.userId} IS NOT NULL THEN true ELSE false END`.as('isLiked')
          : sql<boolean>`false`.as('isLiked')
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .leftJoin(recipes, eq(recipes.postId, posts.id))
      .leftJoin(likes, currentUserId ? and(
        eq(likes.postId, posts.id),
        eq(likes.userId, currentUserId)
      ) : undefined)
      .orderBy(desc(posts.createdAt))
      .offset(offset)
      .limit(limit);

    return result.map((row) => ({
      ...row.post,
      user: row.user,
      recipe: row.recipe || undefined,
      isLiked: row.isLiked
    }));
  }

  // ---------- Recipes ----------
  async getRecipe(id: string): Promise<Recipe | undefined> {
    const db = getDb();
    const result = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
    return result[0];
  }

  async getRecipeByPostId(postId: string): Promise<Recipe | undefined> {
    const db = getDb();
    const result = await db.select().from(recipes).where(eq(recipes.postId, postId)).limit(1);
    return result[0];
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const db = getDb();
    const result = await db.insert(recipes).values(insertRecipe).returning();
    return result[0];
  }

  async updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe | undefined> {
    const db = getDb();
    const result = await db.update(recipes).set(updates).where(eq(recipes.id, id)).returning();
    return result[0];
  }

  async getTrendingRecipes(limit = 10): Promise<(Recipe & { post: PostWithUser })[]> {
    const db = getDb();
    
    // Get recipes from posts in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const result = await db
      .select({ recipe: recipes, post: posts, user: users })
      .from(recipes)
      .innerJoin(posts, eq(recipes.postId, posts.id))
      .innerJoin(users, eq(posts.userId, users.id))
      .where(
        sql`${posts.createdAt} >= ${sevenDaysAgo.toISOString()}`
      )
      .orderBy(
        desc(sql`(${posts.likesCount} * 2 + ${posts.commentsCount})`)
      )
      .limit(limit);

    return result.map((row) => ({
      ...row.recipe,
      post: { ...row.post, user: row.user },
    }));
  }

  async searchLocalRecipes(searchParams: {
    q?: string;
    cuisines?: string[];
    diets?: string[];
    mealTypes?: string[];
    pageSize?: number;
    offset?: number;
  }): Promise<any[]> {
    const db = getDb();
    try {
      let query = db.select().from(recipes);
      const conditions = [];

      if (searchParams.q) {
        const searchTerm = `%${searchParams.q}%`;
        conditions.push(
          or(
            ilike(recipes.title, searchTerm),
            sql`${recipes.ingredients}::text ILIKE ${searchTerm}`,
            sql`${recipes.instructions}::text ILIKE ${searchTerm}`
          )!
        );
      }

      if (conditions.length > 0) {
        // @ts-expect-error drizzle typing
        query = query.where(and(...conditions));
      }

      const results = await query
        .limit(searchParams.pageSize || 24)
        .offset(searchParams.offset || 0);

      return results.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        fiber: recipe.fiber,
        source: "local",
      }));
    } catch (error) {
      console.error("Local recipe search error:", error);
      return [];
    }
  }

  // ---------- Stories / Bites ----------
  async getStory(id: string): Promise<Story | undefined> {
    const db = getDb();
    const result = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
    return result[0];
  }

  async createStory(insertStory: InsertStory): Promise<Story> {
    const db = getDb();
    const result = await db.insert(stories).values(insertStory).returning();
    return result[0];
  }

  async getActiveStories(_userId: string): Promise<StoryWithUser[]> {
    const db = getDb();
    const result = await db
      .select({ story: stories, user: users })
      .from(stories)
      .innerJoin(users, eq(stories.userId, users.id))
      .where(sql`${stories.expiresAt} > NOW()`)
      .orderBy(desc(stories.createdAt));

    return result.map((row) => ({ ...row.story, user: row.user }));
  }

  async getUserStories(userId: string): Promise<Story[]> {
    const db = getDb();
    return db
      .select()
      .from(stories)
      .where(eq(stories.userId, userId))
      .orderBy(desc(stories.createdAt));
  }

  // ---------- Likes ----------
  async likePost(userId: string, postId: string): Promise<Like> {
    const db = getDb();
    const result = await db.insert(likes).values({ userId, postId }).returning();
    await db
      .update(posts)
      .set({ likesCount: sql`${posts.likesCount} + 1` })
      .where(eq(posts.id, postId));
    return result[0];
  }

  async unlikePost(userId: string, postId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(likes)
      .where(and(eq(likes.userId, userId), eq(likes.postId, postId)))
      .returning();
    if (result[0]) {
      await db
        .update(posts)
        .set({ likesCount: sql`${posts.likesCount} - 1` })
        .where(eq(posts.id, postId));
      return true;
    }
    return false;
  }

  async isPostLiked(userId: string, postId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select()
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.postId, postId)))
      .limit(1);
    return result.length > 0;
  }

  async getPostLikes(postId: string): Promise<Like[]> {
    const db = getDb();
    return db.select().from(likes).where(eq(likes.postId, postId));
  }

  // ---------- Comment Likes ----------
  /**
   * Record a like on a comment.  Returns the newly created CommentLike row.  If the
   * like already exists (user already liked the comment) the database's unique
   * index on (userId, commentId) will prevent duplicates and nothing will be
   * inserted.  When a new like is created we also increment the comment's
   * likesCount column.
   */
  async likeComment(userId: string, commentId: string): Promise<CommentLike> {
    const db = getDb();
    // Ensure the comment exists before attempting to like
    const existingComment = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!existingComment[0]) {
      throw new Error("Comment not found");
    }
    // Insert like if it doesn't already exist
    const [like] = await db
      .insert(commentLikes)
      .values({ userId, commentId })
      .onConflictDoNothing()
      .returning();
    // If a new like was inserted, return it.  If the like already existed the
    // database will not insert a duplicate, and we simply return the existing
    // record.  We do not maintain a separate likes count on the comments table
    // because the underlying schema does not include such a column.
    if (like) {
      return like;
    }
    // Return a synthetic result when the like already exists
    return { id: '', userId, commentId, createdAt: new Date().toISOString() } as any;
  }

  /**
   * Remove a user's like from a comment.  Returns true if a like was removed,
   * otherwise false.  When a like is removed we decrement the comment's likes
   * count.
   */
  async unlikeComment(userId: string, commentId: string): Promise<boolean> {
    const db = getDb();
    const [like] = await db
      .delete(commentLikes)
      .where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId)))
      .returning();
    if (like) {
      return true;
    }
    return false;
  }

  /**
   * Check whether a user has liked a particular comment.
   */
  async isCommentLiked(userId: string, commentId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select()
      .from(commentLikes)
      .where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId)))
      .limit(1);
    return result.length > 0;
  }

  /**
   * Return all likes for a given comment.  You can join this with the users
   * table externally to get display names or avatars.
   */
  async getCommentLikes(commentId: string): Promise<CommentLike[]> {
    const db = getDb();
    return db.select().from(commentLikes).where(eq(commentLikes.commentId, commentId));
  }

  // ---------- Comments ----------
  async getComment(id: string): Promise<Comment | undefined> {
    const db = getDb();
    const result = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    return result[0];
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const db = getDb();
    const result = await db.insert(comments).values(insertComment).returning();
    await db
      .update(posts)
      .set({ commentsCount: sql`${posts.commentsCount} + 1` })
      .where(eq(posts.id, insertComment.postId));
    return result[0];
  }

  async deleteComment(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(comments).where(eq(comments.id, id)).returning();
    if (result[0]) {
      await db
        .update(posts)
        .set({ commentsCount: sql`${posts.commentsCount} - 1` })
        .where(eq(posts.id, result[0].postId));
      return true;
    }
    return false;
  }

  async getPostComments(postId: string): Promise<CommentWithUser[]> {
    const db = getDb();
    const result = await db
      .select({ comment: comments, user: users })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.postId, postId))
      .orderBy(asc(comments.createdAt));

    return result.map((row) => ({ ...row.comment, user: row.user }));
  }

  // ---------- Follows ----------
  async followUser(followerId: string, followingId: string): Promise<Follow> {
    const db = getDb();
    const result = await db
      .insert(follows)
      .values({ followerId, followingId })
      .returning();

    await db
      .update(users)
      .set({ followingCount: sql`${users.followingCount} + 1` })
      .where(eq(users.id, followerId));
    await db
      .update(users)
      .set({ followersCount: sql`${users.followersCount} + 1` })
      .where(eq(users.id, followingId));

    return result[0];
  }

  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
      .returning();

    if (result[0]) {
      await db
        .update(users)
        .set({ followingCount: sql`${users.followingCount} - 1` })
        .where(eq(users.id, followerId));
      await db
        .update(users)
        .set({ followersCount: sql`${users.followersCount} - 1` })
        .where(eq(users.id, followingId));
      return true;
    }
    return false;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
      .limit(1);
    return result.length > 0;
  }

  async getFollowers(userId: string): Promise<User[]> {
    const db = getDb();
    const result = await db
      .select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId));
    return result.map((row) => row.user);
  }

  async getFollowing(userId: string): Promise<User[]> {
    const db = getDb();
    const result = await db
      .select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId));
    return result.map((row) => row.user);
  }

  // ---------- Catering ----------
  async enableCatering(
    userId: string,
    location: string,
    radius: number,
    bio?: string
  ): Promise<User | undefined> {
    const db = getDb();
    const result = await db
      .update(users)
      .set({
        cateringEnabled: true,
        cateringLocation: location,
        cateringRadius: radius,
        cateringBio: bio,
        cateringAvailable: true,
      })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async disableCatering(userId: string): Promise<User | undefined> {
    const db = getDb();
    const result = await db
      .update(users)
      .set({ cateringEnabled: false, cateringAvailable: false })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async updateCateringSettings(userId: string, settings: {
    location?: string;
    radius?: number;
    bio?: string;
    available?: boolean;
  }): Promise<User | undefined> {
    const db = getDb();
    const result = await db
      .update(users)
      .set({
        ...(settings.location && { cateringLocation: settings.location }),
        ...(settings.radius && { cateringRadius: settings.radius }),
        ...(settings.bio !== undefined && { cateringBio: settings.bio }),
        ...(settings.available !== undefined && { cateringAvailable: settings.available }),
      })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async findChefsInRadius(_postalCode: string, radiusMiles: number, limit = 20): Promise<ChefWithCatering[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.cateringEnabled, true),
          eq(users.cateringAvailable, true),
          sql`${users.cateringRadius} >= ${radiusMiles}`
        )
      )
      .limit(limit);

    return result.map((u) => ({
      ...u,
      availableForCatering: true,
      distance: Math.floor(Math.random() * radiusMiles),
    }));
  }

  async createCateringInquiry(inquiry: InsertCateringInquiry): Promise<CateringInquiry> {
    const db = getDb();
    const result = await db.insert(cateringInquiries).values(inquiry).returning();
    return result[0];
  }

  async getCateringInquiries(chefId: string): Promise<CateringInquiry[]> {
    const db = getDb();
    return db
      .select()
      .from(cateringInquiries)
      .where(eq(cateringInquiries.chefId, chefId))
      .orderBy(desc(cateringInquiries.createdAt));
  }

  async updateCateringInquiry(
    id: string,
    updates: { status?: string; message?: string }
  ): Promise<CateringInquiry | undefined> {
    const db = getDb();
    const result = await db
      .update(cateringInquiries)
      .set(updates)
      .where(eq(cateringInquiries.id, id))
      .returning();

    return result[0];
  }

  // ---------- Marketplace ----------
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const db = getDb();
    const result = await db.insert(products).values(insertProduct).returning();
    return result[0];
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const db = getDb();
    const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return result[0];
  }

  async getProductWithSeller(id: string): Promise<ProductWithSeller | undefined> {
    const db = getDb();
    const result = await db
      .select({ product: products, seller: users })
      .from(products)
      .innerJoin(users, eq(products.sellerId, users.id))
      .where(eq(products.id, id))
      .limit(1);

    if (!result[0]) return undefined;
    return { ...result[0].product, seller: result[0].seller };
  }

  async getUserProducts(sellerId: string, offset = 0, limit = 10): Promise<ProductWithSeller[]> {
    const db = getDb();
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

  async searchProducts(
    query?: string,
    category?: string,
    location?: string,
    offset = 0,
    limit = 20
  ): Promise<ProductWithSeller[]> {
    const db = getDb();
    const conditions: any[] = [eq(products.isActive, true)];

    if (category) conditions.push(eq(products.category, category));
    if (location) conditions.push(eq(products.pickupLocation, location));
    if (query) {
      conditions.push(
        or(
          sql`${products.name} ILIKE ${"%" + query + "%"}`,
          sql`${products.description} ILIKE ${"%" + query + "%"}`
        )!
      );
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

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const db = getDb();
    const result = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .update(products)
      .set({ isActive: false })
      .where(eq(products.id, id))
      .returning();

    return result.length > 0;
  }

  // ---------- Nutrition ----------
  async enableNutritionPremium(userId: string, trialDays: number): Promise<User | undefined> {
    const db = getDb();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + trialDays);

    const result = await db
      .update(users)
      .set({ nutritionPremium: true, nutritionTrialEndsAt: trialEndDate })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async updateNutritionGoals(
    userId: string,
    goals: {
      dailyCalorieGoal?: number;
      macroGoals?: { protein: number; carbs: number; fat: number };
      dietaryRestrictions?: string[];
    }
  ): Promise<User | undefined> {
    const db = getDb();
    const result = await db
      .update(users)
      .set({
        dailyCalorieGoal: goals.dailyCalorieGoal,
        macroGoals: goals.macroGoals,
        dietaryRestrictions: goals.dietaryRestrictions,
      })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async logNutrition(
    userId: string,
    log: {
      date: Date;
      mealType: string;
      recipeId?: string;
      customFoodName?: string;
      servings: number;
      calories: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      fiber?: number;
      imageUrl?: string;
    }
  ): Promise<any> {
    const db = getDb();
    const result = await db.insert(nutritionLogs).values({ userId, ...log }).returning();
    return result[0];
  }

  async getDailyNutritionSummary(userId: string, date: Date): Promise<any> {
    const db = getDb();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db
      .select({
        totalCalories: sql`SUM(${nutritionLogs.calories} * ${nutritionLogs.servings})`.as("totalCalories"),
        totalProtein: sql`SUM(${nutritionLogs.protein} * ${nutritionLogs.servings})`.as("totalProtein"),
        totalCarbs: sql`SUM(${nutritionLogs.carbs} * ${nutritionLogs.servings})`.as("totalCarbs"),
        totalFat: sql`SUM(${nutritionLogs.fat} * ${nutritionLogs.servings})`.as("totalFat"),
        totalFiber: sql`SUM(${nutritionLogs.fiber} * ${nutritionLogs.servings})`.as("totalFiber"),
      })
      .from(nutritionLogs)
      .where(
        and(
          eq(nutritionLogs.userId, userId),
          sql`${nutritionLogs.date} >= ${startOfDay}`,
          sql`${nutritionLogs.date} <= ${endOfDay}`
        )
      );

    return (
      result[0] ?? {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
      }
    );
  }

  async getNutritionLogs(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const db = getDb();
    return db
      .select()
      .from(nutritionLogs)
      .where(
        and(
          eq(nutritionLogs.userId, userId),
          sql`${nutritionLogs.date} >= ${startDate}`,
          sql`${nutritionLogs.date} <= ${endDate}`
        )
      )
      .orderBy(asc(nutritionLogs.date));
  }

  // ---------- Meal Plans ----------
  async createMealPlan(
    userId: string,
    plan: { name: string; startDate: Date; endDate: Date; isTemplate: boolean }
  ): Promise<any> {
    const db = getDb();
    const result = await db.insert(mealPlans).values({ userId, ...plan }).returning();
    return result[0];
  }

  async getMealPlan(id: string): Promise<any> {
    const db = getDb();
    const result = await db.select().from(mealPlans).where(eq(mealPlans.id, id)).limit(1);
    return result[0];
  }

  async getUserMealPlans(userId: string): Promise<any[]> {
    const db = getDb();
    return db
      .select()
      .from(mealPlans)
      .where(eq(mealPlans.userId, userId))
      .orderBy(desc(mealPlans.createdAt));
  }

  async addMealPlanEntry(
    planId: string,
    entry: {
      recipeId?: string;
      date: Date;
      mealType: string;
      servings: number;
      customName?: string;
      customCalories?: number;
    }
  ): Promise<any> {
    const db = getDb();
    const result = await db
      .insert(mealPlanEntries)
      .values({ mealPlanId: planId, ...entry })
      .returning();
    return result[0];
  }

  // ---------- Pantry ----------
  async addPantryItem(
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
    const db = getDb();
    const result = await db.insert(pantryItems).values({ userId, ...item }).returning();
    return result[0];
  }

  async getPantryItems(userId: string): Promise<any[]> {
    const db = getDb();
    return db
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, userId))
      .orderBy(asc(pantryItems.name));
  }

  async updatePantryItem(
    itemId: string,
    updates: { quantity?: number; expirationDate?: Date; notes?: string }
  ): Promise<any> {
    const db = getDb();
    const result = await db.update(pantryItems).set(updates).where(eq(pantryItems.id, itemId)).returning();
    return result[0];
  }

  async deletePantryItem(itemId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(pantryItems).where(eq(pantryItems.id, itemId)).returning();
    return result.length > 0;
  }

  async getExpiringItems(userId: string, daysAhead: number): Promise<any[]> {
    const db = getDb();
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return db
      .select()
      .from(pantryItems)
      .where(
        and(
          eq(pantryItems.userId, userId),
          sql`${pantryItems.expirationDate} > ${now}`,
          sql`${pantryItems.expirationDate} <= ${futureDate}`
        )
      )
      .orderBy(asc(pantryItems.expirationDate));
  }

  // ---------- Pantry-based recipe suggestions ----------
  async getRecipesFromPantryItems(
    userId: string,
    options: {
      requireAllIngredients?: boolean;
      maxMissingIngredients?: number;
      includeExpiringSoon?: boolean;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    const {
      requireAllIngredients = false,
      maxMissingIngredients = 3,
      includeExpiringSoon = true,
      limit = 20,
    } = options;

    const pantry = await this.getPantryItems(userId);
    if (pantry.length === 0) return [];

    const db = getDb();
    const allRecipes = await db
      .select({ recipe: recipes, post: posts, user: users })
      .from(recipes)
      .innerJoin(posts, eq(recipes.postId, posts.id))
      .innerJoin(users, eq(posts.userId, users.id))
      .limit(200);

    const pantrySet = new Set(pantry.map((i) => (i.name || "").toLowerCase().trim()));

    const scored = allRecipes.map((row) => {
      const r = row.recipe as any;
      const list: string[] = (r.ingredients as any) || [];
      let matches = 0;
      const missing: string[] = [];

      list.forEach((ing) => {
        const norm = (ing || "").toLowerCase().trim();
        const has = Array.from(pantrySet).some((p) => p.includes(norm) || norm.includes(p));
        if (has) matches++;
        else missing.push(ing);
      });

      const total = list.length;
      const matchScore = total > 0 ? (matches / total) * 100 : 0;

      return {
        ...r,
        post: { ...row.post, user: row.user },
        matchScore,
        ingredientMatches: matches,
        totalIngredients: total,
        missingIngredients: missing,
        missingCount: missing.length,
        canMake: missing.length === 0,
      };
    });

    let filtered = scored;
    if (requireAllIngredients) {
      filtered = scored.filter((r) => r.canMake);
    } else {
      filtered = scored.filter((r) => r.missingCount <= maxMissingIngredients);
    }

    filtered.sort((a, b) => {
      if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;
      return a.missingCount - b.missingCount;
    });

    return filtered.slice(0, limit);
  }

  async getSuggestedIngredientsForRecipe(
    recipeId: string,
    userId: string
  ): Promise<{
    recipe: any;
    missingIngredients: string[];
    availableInMarketplace: any[];
  }> {
    const recipe = await this.getRecipe(recipeId);
    if (!recipe) throw new Error("Recipe not found");

    const pantry = await this.getPantryItems(userId);
    const pantrySet = new Set(pantry.map((i) => (i.name || "").toLowerCase().trim()));

    const missing: string[] = [];
    const list: string[] = ((recipe as any).ingredients as any) || [];

    list.forEach((ing) => {
      const norm = (ing || "").toLowerCase().trim();
      const has = Array.from(pantrySet).some((p) => p.includes(norm) || norm.includes(p));
      if (!has) missing.push(ing);
    });

    const availableInMarketplace: any[] = [];
    for (const ing of missing) {
      const items = await this.searchProducts(ing, "ingredients", undefined, 0, 5);
      if (items.length > 0) {
        availableInMarketplace.push({ ingredient: ing, products: items });
      }
    }

    return {
      recipe,
      missingIngredients: missing,
      availableInMarketplace,
    };
  }

  // ---------- Custom Drinks ----------
  async getCustomDrink(id: string): Promise<CustomDrink | undefined> {
    const db = getDb();
    const result = await db.select().from(customDrinks).where(eq(customDrinks.id, id)).limit(1);
    return result[0];
  }

  async getCustomDrinkWithUser(id: string): Promise<CustomDrinkWithUser | undefined> {
    const db = getDb();
    const result = await db
      .select({ drink: customDrinks, user: users })
      .from(customDrinks)
      .innerJoin(users, eq(customDrinks.userId, users.id))
      .where(eq(customDrinks.id, id))
      .limit(1);

    if (!result[0]) return undefined;

    const photos = await this.getDrinkPhotos(id);
    return { 
      ...result[0].drink, 
      user: result[0].user,
      photos 
    };
  }

  async getUserCustomDrinks(userId: string, category?: string): Promise<CustomDrink[]> {
    const db = getDb();
    const conditions = [eq(customDrinks.userId, userId)];
    if (category) {
      conditions.push(eq(customDrinks.category, category));
    }

    return db
      .select()
      .from(customDrinks)
      // @ts-expect-error drizzle typing
      .where(and(...conditions))
      .orderBy(desc(customDrinks.createdAt));
  }

  async getPublicCustomDrinks(category?: string, limit = 20): Promise<CustomDrinkWithUser[]> {
    const db = getDb();
    const conditions = [eq(customDrinks.isPublic, true)];
    if (category) {
      conditions.push(eq(customDrinks.category, category));
    }

    const result = await db
      .select({ drink: customDrinks, user: users })
      .from(customDrinks)
      .innerJoin(users, eq(customDrinks.userId, users.id))
      // @ts-expect-error drizzle typing
      .where(and(...conditions))
      .orderBy(desc(customDrinks.likesCount), desc(customDrinks.createdAt))
      .limit(limit);

    return result.map((row) => ({ ...row.drink, user: row.user }));
  }

  async createCustomDrink(drink: InsertCustomDrink): Promise<CustomDrink> {
    const db = getDb();
    const result = await db.insert(customDrinks).values(drink).returning();
    
    await this.incrementDrinkCount(drink.userId, drink.category);
    await this.updateStreak(drink.userId);
    
    return result[0];
  }

  async updateCustomDrink(id: string, updates: Partial<CustomDrink>): Promise<CustomDrink | undefined> {
    const db = getDb();
    const result = await db
      .update(customDrinks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customDrinks.id, id))
      .returning();
    return result[0];
  }

  async deleteCustomDrink(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(customDrinks).where(eq(customDrinks.id, id)).returning();
    return result.length > 0;
  }

  // ---------- Drink Photos ----------
  async createDrinkPhoto(photo: InsertDrinkPhoto): Promise<DrinkPhoto> {
    const db = getDb();
    const result = await db.insert(drinkPhotos).values(photo).returning();
    return result[0];
  }

  async getDrinkPhotos(drinkId: string): Promise<DrinkPhoto[]> {
    const db = getDb();
    return db
      .select()
      .from(drinkPhotos)
      .where(eq(drinkPhotos.drinkId, drinkId))
      .orderBy(desc(drinkPhotos.createdAt));
  }

  async deleteDrinkPhoto(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(drinkPhotos).where(eq(drinkPhotos.id, id)).returning();
    return result.length > 0;
  }

  // ---------- Drink Likes ----------
  async likeDrink(userId: string, drinkId: string): Promise<DrinkLike> {
    const db = getDb();
    const result = await db.insert(drinkLikes).values({ userId, drinkId }).returning();
    
    await db
      .update(customDrinks)
      .set({ likesCount: sql`${customDrinks.likesCount} + 1` })
      .where(eq(customDrinks.id, drinkId));
    
    return result[0];
  }

  async unlikeDrink(userId: string, drinkId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(drinkLikes)
      .where(and(eq(drinkLikes.userId, userId), eq(drinkLikes.drinkId, drinkId)))
      .returning();
    
    if (result[0]) {
      await db
        .update(customDrinks)
        .set({ likesCount: sql`${customDrinks.likesCount} - 1` })
        .where(eq(customDrinks.id, drinkId));
      return true;
    }
    return false;
  }

  async isDrinkLiked(userId: string, drinkId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select()
      .from(drinkLikes)
      .where(and(eq(drinkLikes.userId, userId), eq(drinkLikes.drinkId, drinkId)))
      .limit(1);
    return result.length > 0;
  }

  // ---------- Drink Saves ----------
  async saveDrink(userId: string, drinkId: string): Promise<DrinkSave> {
    const db = getDb();
    const result = await db.insert(drinkSaves).values({ userId, drinkId }).returning();
    
    await db
      .update(customDrinks)
      .set({ savesCount: sql`${customDrinks.savesCount} + 1` })
      .where(eq(customDrinks.id, drinkId));
    
    return result[0];
  }

  async unsaveDrink(userId: string, drinkId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(drinkSaves)
      .where(and(eq(drinkSaves.userId, userId), eq(drinkSaves.drinkId, drinkId)))
      .returning();
    
    if (result[0]) {
      await db
        .update(customDrinks)
        .set({ savesCount: sql`${customDrinks.savesCount} - 1` })
        .where(eq(customDrinks.id, drinkId));
      return true;
    }
    return false;
  }

  async isDrinkSaved(userId: string, drinkId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select()
      .from(drinkSaves)
      .where(and(eq(drinkSaves.userId, userId), eq(drinkSaves.drinkId, drinkId)))
      .limit(1);
    return result.length > 0;
  }

  async getUserSavedDrinks(userId: string, category?: string): Promise<CustomDrinkWithUser[]> {
    const db = getDb();
    const conditions = [eq(drinkSaves.userId, userId)];
    
    if (category) {
      conditions.push(eq(customDrinks.category, category));
    }

    const result = await db
      .select({ drink: customDrinks, user: users })
      .from(drinkSaves)
      .innerJoin(customDrinks, eq(drinkSaves.drinkId, customDrinks.id))
      .innerJoin(users, eq(customDrinks.userId, users.id))
      // @ts-expect-error drizzle typing
      .where(and(...conditions))
      .orderBy(desc(drinkSaves.createdAt));

    return result.map((row) => ({ 
      ...row.drink, 
      user: row.user,
      isSaved: true 
    }));
  }

  // ---------- Recipe Saves ----------
  async saveRecipe(userId: string, recipeId: string): Promise<RecipeSave> {
    const db = getDb();
    const result = await db.insert(recipeSaves).values({ userId, recipeId }).returning();
    return result[0];
  }

  async unsaveRecipe(userId: string, recipeId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(recipeSaves)
      .where(and(eq(recipeSaves.userId, userId), eq(recipeSaves.recipeId, recipeId)))
      .returning();
    return result.length > 0;
  }

  async isRecipeSaved(userId: string, recipeId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select()
      .from(recipeSaves)
      .where(and(eq(recipeSaves.userId, userId), eq(recipeSaves.recipeId, recipeId)))
      .limit(1);
    return result.length > 0;
  }

  async getUserSavedRecipes(userId: string): Promise<Recipe[]> {
    const db = getDb();
    const result = await db
      .select({ recipe: recipes })
      .from(recipeSaves)
      .innerJoin(recipes, eq(recipeSaves.recipeId, recipes.id))
      .where(eq(recipeSaves.userId, userId))
      .orderBy(desc(recipeSaves.createdAt));
    
    return result.map(row => row.recipe);
  }

  // ---------- User Drink Stats ----------
  async getUserDrinkStats(userId: string): Promise<UserDrinkStats | undefined> {
    const db = getDb();
    const result = await db
      .select()
      .from(userDrinkStats)
      .where(eq(userDrinkStats.userId, userId))
      .limit(1);
    
    if (!result[0]) {
      return this.createUserDrinkStats(userId);
    }
    
    return result[0];
  }

  async createUserDrinkStats(userId: string): Promise<UserDrinkStats> {
    const db = getDb();
    const result = await db
      .insert(userDrinkStats)
      .values({ userId })
      .returning();
    return result[0];
  }

  async updateUserDrinkStats(
    userId: string, 
    updates: Partial<UserDrinkStats>
  ): Promise<UserDrinkStats | undefined> {
    const db = getDb();
    const result = await db
      .update(userDrinkStats)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userDrinkStats.userId, userId))
      .returning();
    return result[0];
  }

  async incrementDrinkCount(userId: string, category: string): Promise<void> {
    const db = getDb();
    
    await this.getUserDrinkStats(userId);
    
    const updates: any = {
      totalDrinksMade: sql`${userDrinkStats.totalDrinksMade} + 1`,
      totalPoints: sql`${userDrinkStats.totalPoints} + 100`,
    };

    if (category === 'smoothies') {
      updates.smoothiesMade = sql`${userDrinkStats.smoothiesMade} + 1`;
    } else if (category === 'protein-shakes') {
      updates.proteinShakesMade = sql`${userDrinkStats.proteinShakesMade} + 1`;
    } else if (category === 'detoxes') {
      updates.detoxesMade = sql`${userDrinkStats.detoxesMade} + 1`;
    } else if (category === 'potent-potables') {
      updates.cocktailsMade = sql`${userDrinkStats.cocktailsMade} + 1`;
    }

    await db
      .update(userDrinkStats)
      .set(updates)
      .where(eq(userDrinkStats.userId, userId));

    const stats = await this.getUserDrinkStats(userId);
    if (stats) {
      const newLevel = Math.floor(stats.totalPoints / 1000) + 1;
      if (newLevel > stats.level) {
        await this.updateUserDrinkStats(userId, { level: newLevel });
      }
    }
  }

  async updateStreak(userId: string): Promise<void> {
    const db = getDb();
    const stats = await this.getUserDrinkStats(userId);
    if (!stats) return;

    const now = new Date();
    const lastDrink = stats.lastDrinkDate;

    if (!lastDrink) {
      await this.updateUserDrinkStats(userId, {
        currentStreak: 1,
        longestStreak: 1,
        lastDrinkDate: now,
      });
      return;
    }

    const hoursSinceLastDrink = (now.getTime() - new Date(lastDrink).getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastDrink < 24) {
      await this.updateUserDrinkStats(userId, { lastDrinkDate: now });
    } else if (hoursSinceLastDrink < 48) {
      const newStreak = stats.currentStreak + 1;
      await this.updateUserDrinkStats(userId, {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, stats.longestStreak),
        lastDrinkDate: now,
      });
      
      if (newStreak % 7 === 0) {
        await db
          .update(userDrinkStats)
          .set({ totalPoints: sql`${userDrinkStats.totalPoints} + 500` })
          .where(eq(userDrinkStats.userId, userId));
      }
    } else {
      await this.updateUserDrinkStats(userId, {
        currentStreak: 1,
        lastDrinkDate: now,
      });
    }
  }

  async addBadge(userId: string, badge: string): Promise<void> {
    const db = getDb();
    const stats = await this.getUserDrinkStats(userId);
    if (!stats) return;

    const currentBadges = (stats.badges as string[]) || [];
    if (!currentBadges.includes(badge)) {
      await db
        .update(userDrinkStats)
        .set({ 
          badges: sql`${userDrinkStats.badges} || ${JSON.stringify([badge])}::jsonb`
        })
        .where(eq(userDrinkStats.userId, userId));
    }
  }
}

export const storage = new DrizzleStorage();
