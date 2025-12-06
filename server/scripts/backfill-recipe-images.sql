-- Backfill missing images for MealDB recipes
-- This SQL identifies recipes that need images, you'll need to manually update them

-- Step 1: View all recipes without images from MealDB
SELECT
  id,
  title,
  external_source,
  external_id,
  image_url,
  CONCAT('https://www.themealdb.com/api/json/v1/1/lookup.php?i=', external_id) as mealdb_api_url
FROM recipes
WHERE external_source = 'mealdb'
  AND (image_url IS NULL OR image_url = '')
ORDER BY title;

-- Step 2: For a specific recipe, you can update manually:
-- UPDATE recipes
-- SET image_url = 'https://www.themealdb.com/images/media/meals/...'
-- WHERE id = 'recipe-uuid-here';

-- Step 3: Or delete recipes without images (they'll be re-saved with images when reviewed)
-- DELETE FROM recipes
-- WHERE external_source = 'mealdb'
--   AND (image_url IS NULL OR image_url = '');
