-- Add external source tracking fields to recipes table
-- This allows us to save external recipes (from TheMealDB, Spoonacular, etc.)
-- and track their original source for deduplication

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS cuisine TEXT,
  ADD COLUMN IF NOT EXISTS meal_type TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Create index for efficient lookups by external source
CREATE INDEX IF NOT EXISTS idx_recipes_external_source_id
  ON recipes(external_source, external_id);

-- Add comment explaining the purpose
COMMENT ON COLUMN recipes.external_source IS 'Source of external recipe (mealdb, spoonacular, edamam, etc.)';
COMMENT ON COLUMN recipes.external_id IS 'Original ID from external API';
