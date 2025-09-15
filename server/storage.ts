import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { eq, desc, and, or, sql, asc, inArray, ilike } from 'drizzle-orm';
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
  searchLocalRecipes(searchParams: { q?: string; cuisines?: string[]; diets?: string[]; mealTypes?: string[]; pageSize?: number; offset?: number; }): Promise<any[]>;

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
  getSuggestedIngredientsForRecipe(recipeId: string, userId: string): Promise<{ recipe: any; missingIngredients: string[]; suggestedSubstitutions: any[]; availableInMarketplace: any[] }>;
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

  async searchLocalRecipes(searchParams: {
    q?: string;
    cuisines?: string[];
    diets?: string[];
    mealTypes?: string[];
    pageSize?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      let query = db.select().from(recipes);
      
      const conditions = [];
      
      // Search by query term in title, ingredients, or instructions
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
      
      // Apply conditions if any exist
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      // Apply limit and offset
      const results = await query
        .limit(searchParams.pageSize || 24)
        .offset(searchParams.offset || 0);
      
      // Transform to match the expected format
      return results.map(recipe => ({
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
        source: 'local'
      }));
    } catch (error) {
      console.error('Local recipe search error:', error);
      return [];
    }
  }
