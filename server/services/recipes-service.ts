// server/services/recipes-service.ts
import fetch from "node-fetch";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { recipes } from "../../shared/schema";

// ---- Safe DB init (won't crash if DATABASE_URL missing) ----
const hasDbUrl = !!process.env.DATABASE_URL;
const sql = hasDbUrl ? neon(process.env.DATABASE_URL!) : null;
const db = hasDbUrl ? drizzle(sql!) : null;

const BASE_URL = "https://www.themealdb.com/api/json/v1/1/";

export type FetchRecipesResult = {
  success: boolean;
  count: number;      // inserted count (or 0 if no DB)
  processed: number;  // number of valid recipes processed
};

type TheMeal = {
  idMeal: string;
  strMeal: string | null;
  strMealThumb?: string | null;
  strInstructions?: string | null;
  [key: string]: any; // for strIngredientX / strMeasureX access
};

export async function fetchRecipes(): Promise<FetchRecipesResult> {
  try {
    // 1) Get categories
    const categoriesRes = await fetch(`${BASE_URL}categories.php`);
    if (!categoriesRes.ok) {
      throw new Error(`Failed to fetch categories: ${categoriesRes.status}`);
    }
    const categoriesJson = (await categoriesRes.json()) as { categories?: any[] };
    const categories = categoriesJson.categories ?? [];

    const allRecipes: any[] = [];

    // 2) For each category, get meals, then full details
    for (const category of categories) {
      const categoryName = String(category?.strCategory ?? "").trim();
      if (!categoryName) continue;

      console.log(`[recipes-service] Fetching category: ${categoryName}`);
      const filterRes = await fetch(`${BASE_URL}filter.php?c=${encodeURIComponent(categoryName)}`);
      if (!filterRes.ok) {
        console.warn(`[recipes-service] filter.php failed for ${categoryName}: ${filterRes.status}`);
        continue;
      }

      const filterData = (await filterRes.json()) as { meals?: { idMeal: string }[] };
      const meals = filterData.meals || [];

      for (const meal of meals) {
        const mealId = meal?.idMeal;
        if (!mealId) continue;

        try {
          const lookupRes = await fetch(`${BASE_URL}lookup.php?i=${encodeURIComponent(mealId)}`);
          if (!lookupRes.ok) {
            console.warn(`[recipes-service] lookup.php failed for ${mealId}: ${lookupRes.status}`);
            continue;
          }

          const lookupData = (await lookupRes.json()) as { meals?: TheMeal[] };
          const fullMeal = lookupData.meals?.[0];
          if (!fullMeal) {
            console.warn(`[recipes-service] No meal data for ID ${mealId}`);
            continue;
          }

          // Require at least a title + some instructions
          const title = (fullMeal.strMeal ?? "").trim();
          const rawInstructions = (fullMeal.strInstructions ?? "").trim();
          if (!title || !rawInstructions) {
            console.warn(`[recipes-service] Missing required fields for meal ${mealId}`);
            continue;
          }

          // Build ingredients list (up to 20 slots in TheMealDB)
          const ingredients: string[] = [];
          for (let i = 1; i <= 20; i++) {
            const ing = fullMeal[`strIngredient${i}`];
            const meas = fullMeal[`strMeasure${i}`];
            if (ing && String(ing).trim()) {
              const line = `${meas || ""} ${ing}`.trim();
              if (line) ingredients.push(line);
            }
          }

          // Normalize instructions into steps
          let steps: string[] = rawInstructions
            .split(/\r\n|\n|\r/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          // Fallback: split long paragraph on ". "
          if (steps.length === 1 && steps[0].length > 200) {
            steps = steps[0]
              .split(". ")
              .map((s) => s.trim())
              .filter((s) => s.length > 10)
              .map((s) => (s.endsWith(".") ? s : s + "."));
          }

          const recipe = {
            // These field names should match your `recipes` table columns in shared/schema
            title,
            imageUrl: fullMeal.strMealThumb || null,
            ingredients: ingredients.length > 0 ? ingredients : ["No ingredients listed"],
            instructions: steps.length > 0 ? steps : ["No instructions available"],
            // TheMealDB doesn’t include these; keep nullable so schema accepts them
            cookTime: null,
            servings: null,
            difficulty: null,
            // nutrition can be estimated later; keep an empty object for now if JSON column
            nutrition: {},
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
            fiber: null,
          };

          // Extra validation before adding
          if (recipe.title && recipe.ingredients.length && recipe.instructions.length) {
            allRecipes.push(recipe);
          }
        } catch (mealError) {
          console.error(`[recipes-service] Error processing meal ${mealId}:`, mealError);
          continue;
        }
      }

      // Be polite to the API between categories
      await delay(800);
    }

    console.log(`[recipes-service] Processed ${allRecipes.length} valid recipes`);

    // 3) Insert into DB in batches (if DB configured)
    let insertedCount = 0;
    if (!hasDbUrl || !db) {
      console.warn("[recipes-service] DATABASE_URL not set. Skipping DB insert.");
    } else {
      const batchSize = 50;
      for (let i = 0; i < allRecipes.length; i += batchSize) {
        const batch = allRecipes.slice(i, i + batchSize);
        try {
          // Adjust conflict handling depending on your schema's unique constraints.
          // If you have a unique index on (title) or (title,imageUrl), use onConflictDoNothing().
          // @ts-ignore - some Drizzle adapters don't type onConflictDoNothing in neon-http yet
          await db.insert(recipes).values(batch).onConflictDoNothing();
          insertedCount += batch.length;
          console.log(
            `[recipes-service] Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
              allRecipes.length / batchSize
            )}`
          );
        } catch (batchError) {
          console.error(`[recipes-service] Error inserting batch starting at ${i}:`, batchError);
          // Log a small sample for debugging
          try {
            console.error(
              "[recipes-service] Example problematic rows:",
              JSON.stringify(batch.slice(0, 2), null, 2)
            );
          } catch {}
        }
      }
    }

    console.log(`[recipes-service] Successfully inserted ${insertedCount} recipes`);
    return {
      success: true,
      count: insertedCount,
      processed: allRecipes.length,
    };
  } catch (error) {
    console.error("[recipes-service] Error in fetchRecipes:", error);
    throw error;
  }
}

// Small helper to pause between category requests
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
