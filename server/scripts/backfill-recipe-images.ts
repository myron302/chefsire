// Backfill missing images for recipes saved from TheMealDB
import { db } from "../db";
import { recipes } from "../../shared/schema";
import { eq, and, or, isNull } from "drizzle-orm";

async function backfillRecipeImages() {
  console.log("🔍 Finding recipes without images from TheMealDB...");

  // Find all MealDB recipes without images
  const recipesWithoutImages = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.externalSource, "mealdb"),
        or(
          isNull(recipes.imageUrl),
          eq(recipes.imageUrl, "")
        )
      )
    );

  console.log(`📊 Found ${recipesWithoutImages.length} recipes without images`);

  if (recipesWithoutImages.length === 0) {
    console.log("✅ No recipes need image backfilling!");
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const recipe of recipesWithoutImages) {
    try {
      console.log(`\n🔄 Processing: ${recipe.title} (ID: ${recipe.externalId})`);

      // Fetch from TheMealDB
      const url = `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${recipe.externalId}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.log(`❌ Failed to fetch from MealDB: ${response.status}`);
        failed++;
        continue;
      }

      const data = await response.json();
      const meal = data.meals?.[0];

      if (!meal) {
        console.log(`❌ Recipe not found in MealDB`);
        failed++;
        continue;
      }

      if (!meal.strMealThumb) {
        console.log(`⚠️  Recipe genuinely has no image in MealDB`);
        failed++;
        continue;
      }

      // Update recipe with image
      await db
        .update(recipes)
        .set({ imageUrl: meal.strMealThumb })
        .where(eq(recipes.id, recipe.id));

      console.log(`✅ Updated with image: ${meal.strMealThumb}`);
      updated++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`❌ Error processing ${recipe.title}:`, error);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Backfill Summary:");
  console.log(`   Total recipes: ${recipesWithoutImages.length}`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log("=".repeat(50));
}

// Run the backfill
backfillRecipeImages()
  .then(() => {
    console.log("\n🎉 Backfill complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Backfill failed:", error);
    process.exit(1);
  });
