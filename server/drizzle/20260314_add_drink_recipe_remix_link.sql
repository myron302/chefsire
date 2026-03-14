ALTER TABLE "drink_recipes"
ADD COLUMN IF NOT EXISTS "remixed_from_slug" varchar(200);

CREATE INDEX IF NOT EXISTS "drink_recipes_remixed_from_slug_idx"
ON "drink_recipes" ("remixed_from_slug");
