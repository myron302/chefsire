CREATE TABLE IF NOT EXISTS "drink_recipes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" varchar(200) NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "ingredients" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "instructions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "glassware" text,
  "method" text,
  "prep_time" integer,
  "serving_size" text,
  "difficulty" text,
  "spirit_type" text,
  "abv" text,
  "image" text,
  "category" text NOT NULL,
  "subcategory" text,
  "user_id" varchar REFERENCES "users"("id"),
  "source" varchar(50) NOT NULL DEFAULT 'chefsire',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "drink_recipes_slug_idx" ON "drink_recipes"("slug");
CREATE INDEX IF NOT EXISTS "drink_recipes_category_idx" ON "drink_recipes"("category");
CREATE INDEX IF NOT EXISTS "drink_recipes_source_idx" ON "drink_recipes"("source");
CREATE INDEX IF NOT EXISTS "drink_recipes_user_idx" ON "drink_recipes"("user_id");
