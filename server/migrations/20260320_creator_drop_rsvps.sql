CREATE TABLE IF NOT EXISTS creator_drop_rsvps (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drop_id varchar NOT NULL REFERENCES creator_drops(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT creator_drop_rsvps_user_drop_idx UNIQUE (user_id, drop_id)
);

CREATE INDEX IF NOT EXISTS creator_drop_rsvps_user_idx
  ON creator_drop_rsvps (user_id);
CREATE INDEX IF NOT EXISTS creator_drop_rsvps_drop_idx
  ON creator_drop_rsvps (drop_id);
CREATE INDEX IF NOT EXISTS creator_drop_rsvps_drop_created_at_idx
  ON creator_drop_rsvps (drop_id, created_at);
