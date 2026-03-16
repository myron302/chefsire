ALTER TABLE drink_recipes
  ADD COLUMN IF NOT EXISTS challenge_slug varchar(200);

CREATE INDEX IF NOT EXISTS drink_recipes_challenge_slug_idx
  ON drink_recipes (challenge_slug);

CREATE TABLE IF NOT EXISTS drink_challenges (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(200) NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  theme text,
  original_drink_slug varchar(200),
  challenge_type text,
  starts_at timestamp NOT NULL,
  ends_at timestamp NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drink_challenges_active_idx ON drink_challenges (is_active);
CREATE INDEX IF NOT EXISTS drink_challenges_starts_at_idx ON drink_challenges (starts_at);
CREATE INDEX IF NOT EXISTS drink_challenges_ends_at_idx ON drink_challenges (ends_at);
CREATE INDEX IF NOT EXISTS drink_challenges_original_drink_slug_idx ON drink_challenges (original_drink_slug);

CREATE TABLE IF NOT EXISTS drink_challenge_submissions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id varchar NOT NULL REFERENCES drink_challenges(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drink_slug varchar(200) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT drink_challenge_submissions_unique_entry_idx UNIQUE (challenge_id, user_id, drink_slug)
);

CREATE INDEX IF NOT EXISTS drink_challenge_submissions_challenge_idx ON drink_challenge_submissions (challenge_id);
CREATE INDEX IF NOT EXISTS drink_challenge_submissions_user_idx ON drink_challenge_submissions (user_id);
CREATE INDEX IF NOT EXISTS drink_challenge_submissions_drink_slug_idx ON drink_challenge_submissions (drink_slug);
