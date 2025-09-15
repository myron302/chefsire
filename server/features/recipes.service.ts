// server/features/recipes/recipes.service.ts
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
      const meals = (await filterRes.json()).meals || [];
      for (const meal of meals) {
        const lookupRes = await fetch(`${BASE_URL}lookup.php?i=${meal.idMeal}`);
        const fullMeal = (await lookupRes.json()).meals[0];
        const recipe = {
          title: fullMeal.strMeal,
          imageUrl: fullMeal.strMealThumb,
          ingredients: [],
          instructions: fullMeal.strInstructions.split('\r\n').filter((step: string) => step.trim()),
          cookTime: null, // TheMealDB doesn't provide cook time
          servings: null, // TheMealDB doesn't provide servings
          difficulty: null, // Can use OpenAI to infer later
          nutrition: {}, // Can use OpenAI to estimate later
          calories: null,
          protein: null,
          carbs: null,
          fat: null,
          fiber: null,
        };
        for (let i = 1; i <= 20; i++) {
          const ingredient = fullMeal[`strIngredient${i}`];
          const measure = fullMeal[`strMeasure${i}`];
          if (ingredient && ingredient.trim()) {
            recipe.ingredients.push(`${measure} ${ingredient}`.trim());
          }
        }
        allRecipes.push(recipe);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    await db.insert(recipes).values(allRecipes).onConflictDoNothing();
    console.log(`Inserted ${allRecipes.length} recipes!`);
    return { success: true, count: allRecipes.length };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}
