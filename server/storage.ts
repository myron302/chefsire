import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { eq, desc, and, or, sql, asc, inArray } from 'drizzle-orm';
import {
  users,
  posts,
  recipes,
  stories,
  likes,
  comments,
  follows,
  cateringInquiries,
  products,
  orders,
  mealPlans,
  mealPlanEntries,
  pantryItems,
  nutritionLogs,
  ingredientSubstitutions,
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
  type ProductWithSeller
} from '@shared/schema';

// Create database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getSuggestedUsers(userId: string, limit?: number): Promise<User[]>;

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

  // Stories, Likes, Comments, Follows
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
  followUser(followerId: string, followingId: string): Promise<Follow>;
  unfollowUser(followerId: string, followingId: string): Promise<boolean>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  getFollowers(userId: string): Promise<User[]>;
  getFollowing(userId: string): Promise<User[]>;

  // Catering
  enableCatering(userId: string, location: string, radius: number, bio?: string): Promise<User | undefined>;
  disableCatering(userId: string): Promise<User | undefined>;
  updateCateringSettings(userId: string, settings: { location?: string; radius?: number; bio?: string; available?: boolean }): Promise<User | undefined>;
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

  // Nutrition Tracking
  enableNutritionPremium(userId: string, trialDays: number): Promise<User | undefined>;
  updateNutritionGoals(userId: string, goals: { dailyCalorieGoal?: number; macroGoals?: { protein: number; carbs: number; fat: number }; dietaryRestrictions?: string[] }): Promise<User | undefined>;
  logNutrition(userId: string, log: { date: Date; mealType: string; recipeId?: string; customFoodName?: string; servings: number; calories: number; protein?: number; carbs?: number; fat?: number; fiber?: number; imageUrl?: string }): Promise<any>;
  getDailyNutritionSummary(userId: string, date: Date): Promise<any>;
  getNutritionLogs(userId: string, startDate: Date, endDate: Date): Promise<any[]>;
  createMealPlan(userId: string, plan: { name: string; startDate: Date; endDate: Date; isTemplate: boolean }): Promise<any>;
  getMealPlan(id: string): Promise<any>;
  getUserMealPlans(userId: string): Promise<any[]>;
  addMealPlanEntry(planId: string, entry: { recipeId?: string; date: Date; mealType: string; servings: number; customName?: string; customCalories?: number }): Promise<any>;

  // Pantry
  addPantryItem(userId: string, item: { name: string; category?: string; quantity?: number; unit?: string; expirationDate?: Date; notes?: string }): Promise<any>;
  getPantryItems(userId: string): Promise<any[]>;
  updatePantryItem(itemId: string, updates: { quantity?: number; expirationDate?: Date; notes?: string }): Promise<any>;
  deletePantryItem(itemId: string): Promise<boolean>;
  getExpiringItems(userId: string, daysAhead: number): Promise<any[]>;

  // Ingredient Substitutions
  addIngredientSubstitution(originalIngredient: string, substituteIngredient: string, ratio: string, notes?: string, category?: string): Promise<any>;
  getIngredientSubstitutions(ingredient: string): Promise<any[]>;
  getAllSubstitutions(): Promise<any[]>;
  searchSubstitutions(query: string): Promise<any[]>;

  // Pantry-Based Recipe Suggestions
  getRecipesFromPantryItems(userId: string, options: { requireAllIngredients?: boolean; maxMissingIngredients?: number; includeExpiringSoon?: boolean; limit?: number }): Promise<any[]>;
  getSuggestedIngredientsForRecipe(recipeId: string, userId: string): Promise<any>;
}

export class DrizzleStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getSuggestedUsers(userId: string, limit = 5): Promise<User[]> {
    return db.select()
      .from(users)
      .where(and(
        sql`${users.id} != ${userId}`,
        eq(users.isChef, true)
      ))
      .orderBy(desc(users.followersCount))
      .limit(limit);
  }

  async getPost(id: string): Promise<Post | undefined> {
    const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return result[0];
  }

  async getPostWithUser(id: string): Promise<PostWithUser | undefined> {
    const result = await db.select({
      post: posts,
      user: users,
      recipe: recipes
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .leftJoin(recipes, eq(recipes.postId, posts.id))
    .where(eq(posts.id, id))
    .limit(1);

    if (!result[0]) return undefined;

    return {
      ...result[0].post,
      user: result[0].user,
      recipe: result[0].recipe || undefined
    };
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const result = await db.insert(posts).values(insertPost).returning();
    
    await db.update(users)
      .set({ postsCount: sql`${users.postsCount} + 1` })
      .where(eq(users.id, insertPost.userId));
    
    return result[0];
  }

  async updatePost(id: string, updates: Partial<Post>): Promise<Post | undefined> {
    const result = await db.update(posts).set(updates).where(eq(posts.id, id)).returning();
    return result[0];
  }

  async deletePost(id: string): Promise<boolean> {
    const result = await db.delete(posts).where(eq(posts.id, id)).returning();
    if (result[0]) {
      await db.update(users)
        .set({ postsCount: sql`${users.postsCount} - 1` })
        .where(eq(users.id, result[0].userId));
      return true;
    }
    return false;
  }

  async getFeedPosts(userId: string, offset = 0, limit = 10): Promise<PostWithUser[]> {
    const result = await db.select({
      post: posts,
      user: users,
      recipe: recipes
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .leftJoin(recipes, eq(recipes.postId, posts.id))
    .orderBy(desc(posts.createdAt))
    .offset(offset)
    .limit(limit);

    return result.map(row => ({
      ...row.post,
      user: row.user,
      recipe: row.recipe || undefined
    }));
  }

  async getUserPosts(userId: string, offset = 0, limit = 10): Promise<PostWithUser[]> {
    const result = await db.select({
      post: posts,
      user: users,
      recipe: recipes
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .leftJoin(recipes, eq(recipes.postId, posts.id))
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt))
    .offset(offset)
    .limit(limit);

    return result.map(row => ({
      ...row.post,
      user: row.user,
      recipe: row.recipe || undefined
    }));
  }

  async getExplorePosts(offset = 0, limit = 10): Promise<PostWithUser[]> {
    return this.getFeedPosts("", offset, limit);
  }

  async getRecipe(id: string): Promise<Recipe | undefined> {
    const result = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
    return result[0];
  }

  async getRecipeByPostId(postId: string): Promise<Recipe | undefined> {
    const result = await db.select().from(recipes).where(eq(recipes.postId, postId)).limit(1);
    return result[0];
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const result = await db.insert(recipes).values(insertRecipe).returning();
    return result[0];
  }

  async updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe | undefined> {
    const result = await db.update(recipes).set(updates).where(eq(recipes.id, id)).returning();
    return result[0];
  }

  async getTrendingRecipes(limit = 5): Promise<(Recipe & { post: PostWithUser })[]> {
    const result = await db.select({
      recipe: recipes,
      post: posts,
      user: users
    })
    .from(recipes)
    .innerJoin(posts, eq(recipes.postId, posts.id))
    .innerJoin(users, eq(posts.userId, users.id))
    .orderBy(desc(posts.likesCount))
    .limit(limit);

    return result.map(row => ({
      ...row.recipe,
      post: { ...row.post, user: row.user }
    }));
  }

  async getStory(id: string): Promise<Story | undefined> {
    const result = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
    return result[0];
  }

  async createStory(insertStory: InsertStory): Promise<Story> {
    const result = await db.insert(stories).values(insertStory).returning();
    return result[0];
  }

  async getActiveStories(userId: string): Promise<StoryWithUser[]> {
    const result = await db.select({
      story: stories,
      user: users
    })
    .from(stories)
    .innerJoin(users, eq(stories.userId, users.id))
    .where(sql`${stories.expiresAt} > NOW()`)
    .orderBy(desc(stories.createdAt));

    return result.map(row => ({ ...row.story, user: row.user }));
  }

  async getUserStories(userId: string): Promise<Story[]> {
    return db.select().from(stories).where(eq(stories.userId, userId)).orderBy(desc(stories.createdAt));
  }

  async likePost(userId: string, postId: string): Promise<Like> {
    const result = await db.insert(likes).values({ userId, postId }).returning();
    await db.update(posts).set({ likesCount: sql`${posts.likesCount} + 1` }).where(eq(posts.id, postId));
    return result[0];
  }

  async unlikePost(userId: string, postId: string): Promise<boolean> {
    const result = await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.postId, postId))).returning();
    if (result[0]) {
      await db.update(posts).set({ likesCount: sql`${posts.likesCount} - 1` }).where(eq(posts.id, postId));
      return true;
    }
    return false;
  }

  async isPostLiked(userId: string, postId: string): Promise<boolean> {
    const result = await db.select().from(likes).where(and(eq(likes.userId, userId), eq(likes.postId, postId))).limit(1);
    return result.length > 0;
  }

  async getPostLikes(postId: string): Promise<Like[]> {
    return db.select().from(likes).where(eq(likes.postId, postId));
  }

  async getComment(id: string): Promise<Comment | undefined> {
    const result = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    return result[0];
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values(insertComment).returning();
    await db.update(posts).set({ commentsCount: sql`${posts.commentsCount} + 1` }).where(eq(posts.id, insertComment.postId));
    return result[0];
  }

  async deleteComment(id: string): Promise<boolean> {
    const result = await db.delete(comments).where(eq(comments.id, id)).returning();
    if (result[0]) {
      await db.update(posts).set({ commentsCount: sql`${posts.commentsCount} - 1` }).where(eq(posts.id, result[0].postId));
      return true;
    }
    return false;
  }

  async getPostComments(postId: string): Promise<CommentWithUser[]> {
    const result = await db.select({
      comment: comments,
      user: users
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

    return result.map(row => ({ ...row.comment, user: row.user }));
  }

  async followUser(followerId: string, followingId: string): Promise<Follow> {
    const result = await db.insert(follows).values({ followerId, followingId }).returning();
    
    await db.update(users).set({ followingCount: sql`${users.followingCount} + 1` }).where(eq(users.id, followerId));
    await db.update(users).set({ followersCount: sql`${users.followersCount} + 1` }).where(eq(users.id, followingId));
    
    return result[0];
  }

  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    const result = await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))).returning();
    
    if (result[0]) {
      await db.update(users).set({ followingCount: sql`${users.followingCount} - 1` }).where(eq(users.id, followerId));
      await db.update(users).set({ followersCount: sql`${users.followersCount} - 1` }).where(eq(users.id, followingId));
      return true;
    }
    return false;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const result = await db.select().from(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))).limit(1);
    return result.length > 0;
  }

  async getFollowers(userId: string): Promise<User[]> {
    const result = await db.select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId));
    
    return result.map(row => row.user);
  }

  async getFollowing(userId: string): Promise<User[]> {
    const result = await db.select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId));
    
    return result.map(row => row.user);
  }

  async enableCatering(userId: string, location: string, radius: number, bio?: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        cateringEnabled: true,
        cateringLocation: location,
        cateringRadius: radius,
        cateringBio: bio,
        cateringAvailable: true
      })
      .where(eq(users.id, userId))
      .returning();
    
    return result[0];
  }

  async disableCatering(userId: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        cateringEnabled: false,
        cateringAvailable: false
      })
      .where(eq(users.id, userId))
      .returning();
    
    return result[0];
  }

  async updateCateringSettings(userId: string, settings: { location?: string; radius?: number; bio?: string; available?: boolean }): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        ...(settings.location && { cateringLocation: settings.location }),
        ...(settings.radius && { cateringRadius: settings.radius }),
        ...(settings.bio !== undefined && { cateringBio: settings.bio }),
        ...(settings.available !== undefined && { cateringAvailable: settings.available })
      })
      .where(eq(users.id, userId))
      .returning();
    
    return result[0];
  }

  async findChefsInRadius(postalCode: string, radiusMiles: number, limit = 20): Promise<ChefWithCatering[]> {
    const result = await db.select()
      .from(users)
      .where(
        and(
          eq(users.cateringEnabled, true),
          eq(users.cateringAvailable, true),
          sql`${users.cateringRadius} >= ${radiusMiles}`
        )
      )
      .limit(limit);

    return result.map(user => ({
      ...user,
      availableForCatering: true,
      distance: Math.floor(Math.random() * radiusMiles)
    }));
  }

  async createCateringInquiry(inquiry: InsertCateringInquiry): Promise<CateringInquiry> {
    const result = await db.insert(cateringInquiries).values(inquiry).returning();
    return result[0];
  }

  async getCateringInquiries(chefId: string): Promise<CateringInquiry[]> {
    return db.select()
      .from(cateringInquiries)
      .where(eq(cateringInquiries.chefId, chefId))
      .orderBy(desc(cateringInquiries.createdAt));
  }

  async updateCateringInquiry(id: string, updates: { status?: string; message?: string }): Promise<CateringInquiry | undefined> {
    const result = await db.update(cateringInquiries)
      .set(updates)
      .where(eq(cateringInquiries.id, id))
      .returning();
    
    return result[0];
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(insertProduct).returning();
    return result[0];
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return result[0];
  }

  async getProductWithSeller(id: string): Promise<ProductWithSeller | undefined> {
    const result = await db.select({
      product: products,
      seller: users
    })
    .from(products)
    .innerJoin(users, eq(products.sellerId, users.id))
    .where(eq(products.id, id))
    .limit(1);

    if (!result[0]) return undefined;

    return {
      ...result[0].product,
      seller: result[0].seller
    };
  }

  async getUserProducts(sellerId: string, offset = 0, limit = 10): Promise<ProductWithSeller[]> {
    const result = await db.select({
      product: products,
      seller: users
    })
    .from(products)
    .innerJoin(users, eq(products.sellerId, users.id))
    .where(and(eq(products.sellerId, sellerId), eq(products.isActive, true)))
    .orderBy(desc(products.createdAt))
    .offset(offset)
    .limit(limit);

    return result.map(row => ({
      ...row.product,
      seller: row.seller
    }));
  }

  async searchProducts(query?: string, category?: string, location?: string, offset = 0, limit = 20): Promise<ProductWithSeller[]> {
    const conditions = [eq(products.isActive, true)];
    
    if (category) {
      conditions.push(eq(products.category, category));
    }
    
    if (location) {
      conditions.push(eq(products.pickupLocation, location));
    }
    
    if (query) {
      conditions.push(
        or(
          sql`${products.name} ILIKE ${'%' + query + '%'}`,
          sql`${products.description} ILIKE ${'%' + query + '%'}`
        )!
      );
    }

    const result = await db.select({
      product: products,
      seller: users
    })
    .from(products)
    .innerJoin(users, eq(products.sellerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .offset(offset)
    .limit(limit);

    return result.map(row => ({
      ...row.product,
      seller: row.seller
    }));
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const result = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.update(products)
      .set({ isActive: false })
      .where(eq(products.id, id))
      .returning();
    
    return result.length > 0;
  }

  async enableNutritionPremium(userId: string, trialDays: number): Promise<User | undefined> {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + trialDays);
    
    const result = await db.update(users)
      .set({
        isNutritionPremium: true,
        nutritionTrialEnd: trialEndDate
      })
      .where(eq(users.id, userId))
      .returning();
    
    return result[0];
  }

  async updateNutritionGoals(userId: string, goals: { dailyCalorieGoal?: number; macroGoals?: { protein: number; carbs: number; fat: number }; dietaryRestrictions?: string[] }): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        dailyCalorieGoal: goals.dailyCalorieGoal,
        macroGoals: goals.macroGoals,
        dietaryRestrictions: goals.dietaryRestrictions
      })
      .where(eq(users.id, userId))
      .returning();
    
    return result[0];
  }

  async logNutrition(userId: string, log: { date: Date; mealType: string; recipeId?: string; customFoodName?: string; servings: number; calories: number; protein?: number; carbs?: number; fat?: number; fiber?: number; imageUrl?: string }): Promise<any> {
    const result = await db.insert(nutritionLogs).values({
      userId,
      ...log
    }).returning();
    
    return result[0];
  }

  async getDailyNutritionSummary(userId: string, date: Date): Promise<any> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db.select({
      totalCalories: sql`SUM(${nutritionLogs.calories} * ${nutritionLogs.servings})`.as('totalCalories'),
      totalProtein: sql`SUM(${nutritionLogs.protein} * ${nutritionLogs.servings})`.as('totalProtein'),
      totalCarbs: sql`SUM(${nutritionLogs.carbs} * ${nutritionLogs.servings})`.as('totalCarbs'),
      totalFat: sql`SUM(${nutritionLogs.fat} * ${nutritionLogs.servings})`.as('totalFat'),
      totalFiber: sql`SUM(${nutritionLogs.fiber} * ${nutritionLogs.servings})`.as('totalFiber')
    })
    .from(nutritionLogs)
    .where(and(
      eq(nutritionLogs.userId, userId),
      sql`${nutritionLogs.date} >= ${startOfDay}`,
      sql`${nutritionLogs.date} <= ${endOfDay}`
    ));

    return result[0];
  }

  async getNutritionLogs(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return db.select()
      .from(nutritionLogs)
      .where(and(
        eq(nutritionLogs.userId, userId),
        sql`${nutritionLogs.date} >= ${startDate}`,
        sql`${nutritionLogs.date} <= ${endDate}`
      ))
      .orderBy(asc(nutritionLogs.date));
  }

  async createMealPlan(userId: string, plan: { name: string; startDate: Date; endDate: Date; isTemplate: boolean }): Promise<any> {
    const result = await db.insert(mealPlans).values({
      userId,
      ...plan
    }).returning();
    
    return result[0];
  }

  async getMealPlan(id: string): Promise<any> {
    const result = await db.select().from(mealPlans).where(eq(mealPlans.id, id)).limit(1);
    return result[0];
  }

  async getUserMealPlans(userId: string): Promise<any[]> {
    return db.select()
      .from(mealPlans)
      .where(eq(mealPlans.userId, userId))
      .orderBy(desc(mealPlans.createdAt));
  }

  async addMealPlanEntry(planId: string, entry: { recipeId?: string; date: Date; mealType: string; servings: number; customName?: string; customCalories?: number }): Promise<any> {
    const result = await db.insert(mealPlanEntries).values({
      mealPlanId: planId,
      ...entry
    }).returning();
    
    return result[0];
  }

  async addPantryItem(userId: string, item: { name: string; category?: string; quantity?: number; unit?: string; expirationDate?: Date; notes?: string }): Promise<any> {
    const result = await db.insert(pantryItems).values({
      userId,
      ...item
    }).returning();
    
    return result[0];
  }

  async getPantryItems(userId: string): Promise<any[]> {
    return db.select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, userId))
      .orderBy(asc(pantryItems.name));
  }

  async updatePantryItem(itemId: string, updates: { quantity?: number; expirationDate?: Date; notes?: string }): Promise<any> {
    const result = await db.update(pantryItems)
      .set(updates)
      .where(eq(pantryItems.id, itemId))
      .returning();
    
    return result[0];
  }

  async deletePantryItem(itemId: string): Promise<boolean> {
    const result = await db.delete(pantryItems).where(eq(pantryItems.id, itemId)).returning();
    return result.length > 0;
  }

  async getExpiringItems(userId: string, daysAhead: number): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return db.select()
      .from(pantryItems)
      .where(and(
        eq(pantryItems.userId, userId),
        sql`${pantryItems.expirationDate} <= ${futureDate}`
      ))
      .orderBy(asc(pantryItems.expirationDate));
  }

  async addIngredientSubstitution(originalIngredient: string, substituteIngredient: string, ratio: string, notes?: string, category?: string): Promise<any> {
    const result = await db.insert(ingredientSubstitutions).values({
      originalIngredient,
      substituteIngredient,
      ratio,
      notes,
      category
    }).returning();
    
    return result[0];
  }

  async getIngredientSubstitutions(ingredient: string): Promise<any[]> {
    return db.select()
      .from(ingredientSubstitutions)
      .where(or(
        eq(ingredientSubstitutions.originalIngredient, ingredient),
        eq(ingredientSubstitutions.substituteIngredient, ingredient)
      ));
  }

  async getAllSubstitutions(): Promise<any[]> {
    return db.select()
      .from(ingredientSubstitutions)
      .orderBy(asc(ingredientSubstitutions.originalIngredient));
  }

  async searchSubstitutions(query: string): Promise<any[]> {
    return db.select()
      .from(ingredientSubstitutions)
      .where(or(
        sql`${ingredientSubstitutions.originalIngredient} ILIKE ${'%' + query + '%'}`,
        sql`${ingredientSubstitutions.substituteIngredient} ILIKE ${'%' + query + '%'}`,
        sql`${ingredientSubstitutions.notes} ILIKE ${'%' + query + '%'}`
      ))
      .orderBy(asc(ingredientSubstitutions.originalIngredient));
  }

  async getRecipesFromPantryItems(userId: string, options: { requireAllIngredients?: boolean; maxMissingIngredients?: number; includeExpiringSoon?: boolean; limit?: number } = {}): Promise<any[]> {
    const { requireAllIngredients = false, maxMissingIngredients = 2, includeExpiringSoon = false, limit = 10 } = options;
    
    const pantryItems = await this.getPantryItems(userId);
    const pantryItemNames = pantryItems.map(item => item.name.toLowerCase());
    
    let query = db.select({
      recipe: recipes,
      post: posts,
      user: users
    })
    .from(recipes)
    .innerJoin(posts, eq(recipes.postId, posts.id))
    .innerJoin(users, eq(posts.userId, users.id));
    
    if (includeExpiringSoon) {
      const expiringItems = await this.getExpiringItems(userId, 7);
      const expiringItemNames = expiringItems.map(item => item.name.toLowerCase());
      query = query.where(
        sql`EXISTS (
          SELECT 1
          FROM jsonb_array_elements(${recipes.ingredients}) AS ingredient
          WHERE LOWER(ingredient->>'name') = ANY(${expiringItemNames})
        )`
      );
    }
    
    const recipesResult = await query.orderBy(desc(posts.createdAt)).limit(limit);
    
    const filteredRecipes = recipesResult.filter(row => {
      const recipeIngredients = row.recipe.ingredients.map((ing: any) => ing.name.toLowerCase());
      const missingIngredients = recipeIngredients.filter((ing: string) => !pantryItemNames.includes(ing));
      
      if (requireAllIngredients) {
        return missingIngredients.length === 0;
      }
      return missingIngredients.length <= maxMissingIngredients;
    });
    
    return filteredRecipes.map(row => ({
      ...row.recipe,
      post: { ...row.post, user: row.user }
    }));
  }

  async getSuggestedIngredientsForRecipe(recipeId: string, userId: string): Promise<any> {
    const recipe = await this.getRecipe(recipeId);
    if (!recipe) return { missingIngredients: [], substitutions: [] };
    
    const pantryItems = await this.getPantryItems(userId);
    const pantryItemNames = pantryItems.map(item => item.name.toLowerCase());
    
    const recipeIngredients = recipe.ingredients.map((ing: any) => ing.name.toLowerCase());
    const missingIngredients = recipeIngredients.filter((ing: string) => !pantryItemNames.includes(ing));
    
    const substitutions = await Promise.all(
      missingIngredients.map(async (ingredient: string) => {
        const subs = await this.getIngredientSubstitutions(ingredient);
        return { ingredient, substitutes: subs };
      })
    );
    
    return {
      missingIngredients,
      substitutions: substitutions.filter(sub => sub.substitutes.length > 0)
    };
  }
}
