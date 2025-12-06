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
        imageUrl: recipe.imageUrl,
        cuisine: recipe.cuisine,
        mealType: recipe.mealType,
        averageRating: recipe.averageRating,
        reviewCount: recipe.reviewCount,
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

  /**
   * Find or create a recipe from external source (TheMealDB)
   * This allows users to review external recipes by saving them locally
   */
  static async findOrCreateExternalRecipe(
    db: any,
    externalRecipeId: string
  ): Promise<Recipe | null> {
    // Parse external ID (e.g., "mealdb_52772")
    const parts = externalRecipeId.split("_");
    if (parts.length !== 2) {
      console.error("Invalid external recipe ID format:", externalRecipeId);
      return null;
    }

    const [source, externalId] = parts;

    // Check if recipe already exists in database
    const existing = await db
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.externalSource, source),
          eq(recipes.externalId, externalId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log("Recipe already exists in DB:", existing[0].id);
      return existing[0];
    }

    // Fetch full recipe details from external source
    if (source === "mealdb") {
      return await this.fetchAndSaveMealDBRecipe(db, externalId);
    }

    console.error("Unsupported external source:", source);
    return null;
  }

  /**
   * Fetch full recipe details from TheMealDB and save to database
   */
  private static async fetchAndSaveMealDBRecipe(
    db: any,
    mealId: string
  ): Promise<Recipe | null> {
    try {
      console.log("Fetching recipe from MealDB:", mealId);
      const url = `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealId}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error("MealDB API error:", response.status);
        return null;
      }

      const data = await response.json();
      const meal = data.meals?.[0];

      if (!meal) {
        console.error("Recipe not found in MealDB:", mealId);
        return null;
      }

      // Parse ingredients from MealDB format (strIngredient1-20, strMeasure1-20)
      const ingredients: string[] = [];
      for (let i = 1; i <= 20; i++) {
        const ingredient = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];

        if (ingredient && ingredient.trim()) {
          const measurePart = measure && measure.trim() ? `${measure.trim()} ` : "";
          ingredients.push(`${measurePart}${ingredient.trim()}`);
        }
      }

      // Parse instructions - split by periods or newlines for better formatting
      let instructionsText = meal.strInstructions || "";
      const instructionSteps = instructionsText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // If no newlines, try splitting by numbered steps
      if (instructionSteps.length <= 1) {
        const numbered = instructionsText.match(/(?:STEP \d+|^\d+\.?)\s*[^\n]+/gi);
        if (numbered && numbered.length > 1) {
          instructionSteps.length = 0;
          instructionSteps.push(...numbered.map((s) => s.trim()));
        } else {
          // Fall back to original text as single step
          instructionSteps.length = 0;
          instructionSteps.push(instructionsText.trim());
        }
      }

      // Create recipe record
      const recipeData: InsertRecipe = {
        title: meal.strMeal,
        imageUrl: meal.strMealThumb || null,
        ingredients,
        instructions: instructionSteps,
        cuisine: meal.strArea || null,
        mealType: meal.strCategory || null,
        externalSource: "mealdb",
        externalId: mealId,
        sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${mealId}`,
        postId: null, // Not linked to a post
        cookTime: null, // MealDB doesn't provide this
        servings: null, // MealDB doesn't provide this
        difficulty: null,
        nutrition: null,
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
      };

      console.log("Saving MealDB recipe to database:", recipeData.title);
      const savedRecipe = await this.createRecipe(db, recipeData);
      console.log("Recipe saved with ID:", savedRecipe.id);

      return savedRecipe;
    } catch (error) {
      console.error("Error fetching/saving MealDB recipe:", error);
      return null;
    }
  }
}
