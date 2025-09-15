import fetch from 'node-fetch';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { recipes } from '../../shared/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);
const BASE_URL = 'https://www.themealdb.com/api/json/v1/1/';

export async function fetchRecipes() {
  try {
    const categoriesRes = await fetch(`${BASE_URL}categories.php`);
    const categories = (await categoriesRes.json()).categories;
    const allRecipes = [];

    for (const category of categories) {
      const categoryName = category.strCategory;
      console.log(`Fetching ${categoryName}...`);
      
      const filterRes = await fetch(`${BASE_URL}filter.php?c=${categoryName}`);
      const filterData = await filterRes.json();
      const meals = filterData.meals || [];

      for (const meal of meals) {
        try {
          const lookupRes = await fetch(`${BASE_URL}lookup.php?i=${meal.idMeal}`);
          const lookupData = await lookupRes.json();
          const fullMeal = lookupData.meals?.[0];

          if (!fullMeal) {
            console.warn(`No meal data found for ID: ${meal.idMeal}`);
            continue;
          }

          // Validate required fields exist
          if (!fullMeal.strMeal || !fullMeal.strInstructions) {
            console.warn(`Missing required data for meal: ${meal.idMeal}`);
            continue;
          }

          // Build ingredients array
          const ingredients = [];
          for (let i = 1; i <= 20; i++) {
            const ingredient = fullMeal[`strIngredient${i}`];
            const measure = fullMeal[`strMeasure${i}`];
            if (ingredient && ingredient.trim()) {
              ingredients.push(`${measure || ""} ${ingredient}`.trim());
            }
          }

          // Process instructions - handle different line break formats
          let instructions = fullMeal.strInstructions || "";
          instructions = instructions
            .split(/\r\n|\n|\r/) // Split on any line break
            .map((step: string) => step.trim()) // Trim whitespace
            .filter((step: string) => step.length > 0); // Remove empty steps

          // If no line breaks, try to split on periods for better readability
          if (instructions.length === 1 && instructions[0].length > 200) {
            instructions = instructions[0]
              .split(". ")
              .map((step: string) => step.trim())
              .filter((step: string) => step.length > 10) // Only keep substantial steps
              .map((step: string) => step.endsWith(".") ? step : step + ".");
          }

          const recipe = {
            title: fullMeal.strMeal.trim(),
            imageUrl: fullMeal.strMealThumb || null,
            ingredients: ingredients.length > 0 ? ingredients : ["No ingredients listed"],
            instructions: instructions.length > 0 ? instructions : ["No instructions available"],
            cookTime: null, // TheMealDB doesn't provide cook time
            servings: null, // TheMealDB doesn't provide servings
            difficulty: null, // Can be inferred later
            nutrition: {}, // Can be estimated later
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
            fiber: null,
          };

          // Additional validation before adding to array
          if (recipe.title && recipe.ingredients.length > 0 && recipe.instructions.length > 0) {
            allRecipes.push(recipe);
          } else {
            console.warn(`Skipping invalid recipe: ${recipe.title}`);
          }

        } catch (mealError) {
          console.error(`Error processing meal ${meal.idMeal}:`, mealError);
          continue; // Skip this meal and continue with the next one
        }
      }

      // Add delay between category requests to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Processed ${allRecipes.length} valid recipes`);

    if (allRecipes.length === 0) {
      throw new Error("No valid recipes were processed");
    }

    // Insert recipes in batches to avoid overwhelming the database
    const batchSize = 50;
    let insertedCount = 0;

    for (let i = 0; i < allRecipes.length; i += batchSize) {
      const batch = allRecipes.slice(i, i + batchSize);
      try {
        await db.insert(recipes).values(batch).onConflictDoNothing();
        insertedCount += batch.length;
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allRecipes.length / batchSize)}`);
      } catch (batchError) {
        console.error(`Error inserting batch starting at index ${i}:`, batchError);
        // Log the problematic recipes for debugging
        console.error("Problematic batch:", JSON.stringify(batch.slice(0, 2), null, 2));
      }
    }

    console.log(`Successfully inserted ${insertedCount} recipes!`);
    return { 
      success: true, 
      count: insertedCount,
      processed: allRecipes.length 
    };

  } catch (error) {
    console.error("Error in fetchRecipes:", error);
    throw error;
  }
}
