// server/services/recipe.service.ts
import { eq, desc, and, or, sql, ilike } from "drizzle-orm";
import { recipes, posts, users, type Recipe, type InsertRecipe, type PostWithUser } from "@shared/schema";

/**
 * RecipeService - Handles all recipe-related database operations
 */
export class RecipeService {
  /**
   * Get recipe by ID
   */
  static async getRecipe(db: any, id: string): Promise<Recipe | undefined> {
    const result = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
    return result[0];
  }

  /**
   * Get recipe by post ID
   */
  static async getRecipeByPostId(db: any, postId: string): Promise<Recipe | undefined> {
    const result = await db.select().from(recipes).where(eq(recipes.postId, postId)).limit(1);
    return result[0];
  }

  /**
   * Create a new recipe
   */
  static async createRecipe(db: any, insertRecipe: InsertRecipe): Promise<Recipe> {
    const result = await db.insert(recipes).values(insertRecipe).returning();
    return result[0];
  }

  /**
   * Update recipe
   */
  static async updateRecipe(db: any, id: string, updates: Partial<Recipe>): Promise<Recipe | undefined> {
    const result = await db.update(recipes).set(updates).where(eq(recipes.id, id)).returning();
    return result[0];
  }

  /**
   * Get trending recipes
   */
  static async getTrendingRecipes(
    db: any,
    limit = 5
  ): Promise<(Recipe & { post: PostWithUser })[]> {
    const result = await db
      .select({ recipe: recipes, post: posts, user: users })
      .from(recipes)
      .innerJoin(posts, eq(recipes.postId, posts.id))
      .innerJoin(users, eq(posts.userId, users.id))
      .orderBy(desc(posts.likesCount))
      .limit(limit);

    return result.map((row) => ({
      ...row.recipe,
      post: { ...row.post, user: row.user },
    }));
  }

  /**
   * Search local recipes
   */
  static async searchLocalRecipes(
    db: any,
    searchParams: {
      q?: string;
      cuisines?: string[];
      diets?: string[];
      mealTypes?: string[];
      pageSize?: number;
      offset?: number;
    }
  ): Promise<any[]> {
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

  /**
   * Get recipes based on pantry items
   * This includes intelligent matching and scoring
   */
  static async getRecipesFromPantryItems(
    db: any,
    pantryItems: any[],
    options: {
      requireAllIngredients?: boolean;
      maxMissingIngredients?: number;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    const {
      requireAllIngredients = false,
      maxMissingIngredients = 3,
      limit = 20,
    } = options;

    if (pantryItems.length === 0) return [];

    const allRecipes = await db
      .select({ recipe: recipes, post: posts, user: users })
      .from(recipes)
      .innerJoin(posts, eq(recipes.postId, posts.id))
      .innerJoin(users, eq(posts.userId, users.id))
      .limit(200);

    const pantrySet = new Set(
      pantryItems.map((i) => (i.name || "").toLowerCase().trim())
    );

    const scored = this.scoreRecipesByPantry(allRecipes, pantrySet);

    // Filter based on options
    let filtered = scored;
    if (requireAllIngredients) {
      filtered = scored.filter((r) => r.canMake);
    } else {
      filtered = scored.filter((r) => r.missingCount <= maxMissingIngredients);
    }

    // Sort by match score, then by missing count
    filtered.sort((a, b) => {
      if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;
      return a.missingCount - b.missingCount;
    });

    return filtered.slice(0, limit);
  }

  /**
   * Score recipes based on pantry items
   * Extracted for better testability and reusability
   */
  private static scoreRecipesByPantry(
    recipes: any[],
    pantrySet: Set<string>
  ): any[] {
    return recipes.map((row) => {
      const r = row.recipe as any;
      const list: string[] = (r.ingredients as any) || [];
      let matches = 0;
      const missing: string[] = [];

      list.forEach((ing) => {
        const norm = (ing || "").toLowerCase().trim();
        const has = Array.from(pantrySet).some(
          (p) => p.includes(norm) || norm.includes(p)
        );
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
  }

  /**
   * Get missing ingredients for a recipe based on user's pantry
   */
  static getMissingIngredients(
    recipe: Recipe,
    pantryItems: any[]
  ): string[] {
    const pantrySet = new Set(
      pantryItems.map((i) => (i.name || "").toLowerCase().trim())
    );

    const missing: string[] = [];
    const list: string[] = ((recipe as any).ingredients as any) || [];

    list.forEach((ing) => {
      const norm = (ing || "").toLowerCase().trim();
      const has = Array.from(pantrySet).some(
        (p) => p.includes(norm) || norm.includes(p)
      );
      if (!has) missing.push(ing);
    });

    return missing;
  }
}
