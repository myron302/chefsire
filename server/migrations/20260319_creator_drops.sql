CREATE TABLE IF NOT EXISTS creator_drops (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  description text,
  drop_type text NOT NULL DEFAULT 'collection_launch',
  visibility text NOT NULL DEFAULT 'public',
  scheduled_for timestamp NOT NULL,
  linked_collection_id varchar REFERENCES drink_collections(id) ON DELETE SET NULL,
  linked_challenge_id varchar REFERENCES drink_challenges(id) ON DELETE SET NULL,
  linked_promotion_id varchar REFERENCES drink_collection_promotions(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_drops_creator_idx
  ON creator_drops(creator_user_id);

CREATE INDEX IF NOT EXISTS creator_drops_visibility_idx
  ON creator_drops(visibility);

CREATE INDEX IF NOT EXISTS creator_drops_scheduled_for_idx
  ON creator_drops(scheduled_for);

CREATE INDEX IF NOT EXISTS creator_drops_published_scheduled_idx
  ON creator_drops(is_published, scheduled_for);

CREATE INDEX IF NOT EXISTS creator_drops_creator_scheduled_idx
  ON creator_drops(creator_user_id, scheduled_for);
