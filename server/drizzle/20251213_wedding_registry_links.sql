-- Migration: Create wedding registry links table
CREATE TABLE IF NOT EXISTS wedding_registry_links (
  user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  registry_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wedding_registry_links_user_idx ON wedding_registry_links(user_id);
