CREATE TABLE IF NOT EXISTS creator_posts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  body text NOT NULL,
  post_type text NOT NULL DEFAULT 'update',
  visibility text NOT NULL DEFAULT 'public',
  linked_collection_id varchar REFERENCES drink_collections(id) ON DELETE SET NULL,
  linked_challenge_id varchar REFERENCES drink_challenges(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_posts_creator_idx ON creator_posts(creator_user_id);
CREATE INDEX IF NOT EXISTS creator_posts_visibility_idx ON creator_posts(visibility);
CREATE INDEX IF NOT EXISTS creator_posts_creator_created_at_idx ON creator_posts(creator_user_id, created_at);
CREATE INDEX IF NOT EXISTS creator_posts_visibility_created_at_idx ON creator_posts(visibility, created_at);
