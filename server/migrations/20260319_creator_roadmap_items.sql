CREATE TABLE IF NOT EXISTS creator_roadmap_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  description text,
  item_type text NOT NULL DEFAULT 'roadmap',
  visibility text NOT NULL DEFAULT 'public',
  linked_collection_id varchar REFERENCES drink_collections(id) ON DELETE SET NULL,
  linked_challenge_id varchar REFERENCES drink_challenges(id) ON DELETE SET NULL,
  scheduled_for timestamp,
  released_at timestamp,
  status text NOT NULL DEFAULT 'upcoming',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_roadmap_items_creator_idx
  ON creator_roadmap_items (creator_user_id);
CREATE INDEX IF NOT EXISTS creator_roadmap_items_visibility_idx
  ON creator_roadmap_items (visibility);
CREATE INDEX IF NOT EXISTS creator_roadmap_items_status_idx
  ON creator_roadmap_items (status);
CREATE INDEX IF NOT EXISTS creator_roadmap_items_creator_status_idx
  ON creator_roadmap_items (creator_user_id, status);
CREATE INDEX IF NOT EXISTS creator_roadmap_items_scheduled_idx
  ON creator_roadmap_items (scheduled_for);
CREATE INDEX IF NOT EXISTS creator_roadmap_items_released_idx
  ON creator_roadmap_items (released_at);
