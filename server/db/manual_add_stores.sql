-- enable UUID generator used by your schema helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- STORES table (user storefronts)
CREATE TABLE IF NOT EXISTS stores (
  id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      varchar NOT NULL REFERENCES users(id),
  username     text    NOT NULL,
  name         text    NOT NULL,
  theme        text    DEFAULT 'light',
  layout       jsonb,
  published    boolean DEFAULT false,
  created_at   timestamp DEFAULT now(),
  updated_at   timestamp DEFAULT now()
);

-- one store per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'stores_user_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX stores_user_unique_idx ON stores(user_id);
  END IF;
END$$;

-- public handle must be unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'stores_username_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX stores_username_unique_idx ON stores(username);
  END IF;
END$$;

-- helpful for queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'stores_published_idx'
  ) THEN
    CREATE INDEX stores_published_idx ON stores(published);
  END IF;
END$$;
