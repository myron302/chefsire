-- Create allergen management tables
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Family members table
CREATE TABLE IF NOT EXISTS family_members (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  relationship  TEXT NULL,
  date_of_birth TIMESTAMPTZ NULL,
  species       TEXT DEFAULT 'human',
  notes         TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allergen profiles table
CREATE TABLE IF NOT EXISTS allergen_profiles (
  id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id VARCHAR NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  allergen         TEXT NOT NULL,
  severity         TEXT NOT NULL,
  diagnosed_by     TEXT NULL,
  diagnosed_date   TIMESTAMPTZ NULL,
  notes            TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recipe allergens table
CREATE TABLE IF NOT EXISTS recipe_allergens (
  id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  VARCHAR NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  allergens  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User substitution preferences table
CREATE TABLE IF NOT EXISTS user_substitution_preferences (
  id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_ingredient TEXT NOT NULL,
  substitutes         JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason              TEXT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product allergens table
CREATE TABLE IF NOT EXISTS product_allergens (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode      TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  allergens    JSONB NOT NULL DEFAULT '[]'::jsonb,
  may_contain  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS family_members_user_idx ON family_members (user_id);
CREATE INDEX IF NOT EXISTS allergen_profiles_family_member_idx ON allergen_profiles (family_member_id);
CREATE INDEX IF NOT EXISTS allergen_profiles_allergen_idx ON allergen_profiles (allergen);
CREATE INDEX IF NOT EXISTS recipe_allergens_recipe_idx ON recipe_allergens (recipe_id);
CREATE INDEX IF NOT EXISTS user_sub_prefs_user_idx ON user_substitution_preferences (user_id);
CREATE INDEX IF NOT EXISTS user_sub_prefs_ingredient_idx ON user_substitution_preferences (original_ingredient);
CREATE INDEX IF NOT EXISTS product_allergens_barcode_idx ON product_allergens (barcode);
