-- Step 1: Check if any recipes without images still exist
SELECT
  id,
  title,
  external_source,
  external_id,
  image_url,
  CASE
    WHEN image_url IS NULL THEN 'NULL'
    WHEN image_url = '' THEN 'EMPTY STRING'
    ELSE 'HAS VALUE'
  END as image_status
FROM recipes
WHERE external_source = 'mealdb'
ORDER BY
  CASE
    WHEN image_url IS NULL OR image_url = '' THEN 0
    ELSE 1
  END,
  created_at DESC
LIMIT 20;

-- Step 2: Count recipes with and without images
SELECT
  CASE
    WHEN image_url IS NULL THEN 'No Image (NULL)'
    WHEN image_url = '' THEN 'No Image (Empty)'
    ELSE 'Has Image'
  END as status,
  COUNT(*) as count
FROM recipes
WHERE external_source = 'mealdb'
GROUP BY
  CASE
    WHEN image_url IS NULL THEN 'No Image (NULL)'
    WHEN image_url = '' THEN 'No Image (Empty)'
    ELSE 'Has Image'
  END;
